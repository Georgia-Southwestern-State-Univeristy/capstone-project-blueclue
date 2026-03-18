// src/controllers/assignmentRequestController.js
import pool from '../config/database.js';
import Ticket from '../models/Ticket.js';
import TicketHistory from '../models/TicketHistory.js';
import Notification from '../models/Notification.js';
import { emitNotificationToUser, emitUnreadCountToUser } from '../services/socketService.js';
import { sendTicketAssignment } from '../services/emailService.js';
import { BadRequestError, NotFoundError, ConflictError } from '../middleware/errorHandler.js';

/**
 * Get assignment requests (filterable by status).
 * Defaults to pending requests. Management/admin only.
 * GET /api/assignment-requests
 */
export const getPendingRequests = async (req, res) => {
    const { status = 'pending', page = 1, limit = 25 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Validate status filter
    const validStatuses = ['pending', 'approved', 'denied', 'all'];
    if (!validStatuses.includes(status)) {
        throw new BadRequestError(`Invalid status filter. Must be one of: ${validStatuses.join(', ')}`);
    }

        // --- 24-hour expiration: auto-deny requests older than 24 hours ---
        try {
            const expiredResult = await pool.query(
                `UPDATE ticket_assignment_requests
                 SET status = 'denied', reviewed_at = NOW()
                 WHERE status = 'pending' AND created_at < NOW() - INTERVAL '24 hours'
                 RETURNING id, requested_by, ticket_id`
            );

            // Notify each tech whose request expired
            if (expiredResult.rows.length > 0) {
                const io = req.app.get('io');
                for (const row of expiredResult.rows) {
                    try {
                        const ticketResult = await pool.query(
                            `SELECT subject FROM tickets WHERE id = $1`, [row.ticket_id]
                        );
                        const ticketLabel = ticketResult.rows[0]?.subject || `#${row.ticket_id}`;
                        const notification = await Notification.create({
                            user_id: row.requested_by,
                            type: 'assignment',
                            message: `Your assignment request for "${ticketLabel}" has expired after 24 hours without review.`,
                            ticket_id: row.ticket_id
                        });
                        if (io) {
                            emitNotificationToUser(io, row.requested_by, notification);
                            const unreadCount = await Notification.getUnreadCount(row.requested_by);
                            emitUnreadCountToUser(io, row.requested_by, unreadCount);
                        }
                    } catch (notifErr) {
                        console.error(`Failed to notify tech ${row.requested_by} about expiration:`, notifErr.message);
                    }
                }
                console.log(`Auto-expired ${expiredResult.rows.length} assignment request(s)`);
            }
        } catch (expireErr) {
            console.error('Failed to expire old requests:', expireErr.message);
        }

        let whereClause = '';
        const params = [];

        if (status !== 'all') {
            whereClause = 'WHERE ar.status = $1';
            params.push(status);
        }

        const countQuery = `
            SELECT COUNT(*) FROM ticket_assignment_requests ar
            ${whereClause}
        `;
        const countResult = await pool.query(countQuery, params);
        const totalCount = parseInt(countResult.rows[0].count);

        const dataQuery = `
            SELECT
                ar.id,
                ar.ticket_id,
                ar.requested_by,
                ar.note,
                ar.status,
                ar.reviewed_by,
                ar.reviewed_at,
                ar.created_at,
                t.subject AS ticket_title,
                t.category AS ticket_category,
                t.priority AS ticket_priority,
                t.status AS ticket_status,
                t.created_at AS ticket_created_at,
                requester.first_name AS requester_first_name,
                requester.last_name AS requester_last_name,
                requester.email AS requester_email,
                requester.role AS requester_role,
                reviewer.first_name AS reviewer_first_name,
                reviewer.last_name AS reviewer_last_name,
                (SELECT COUNT(*) FROM tickets wt
                 WHERE wt.assigned_to = ar.requested_by
                   AND wt.status NOT IN ('closed', 'cancelled', 'resolved')
                ) AS requester_workload,
                EXTRACT(EPOCH FROM (ar.created_at + INTERVAL '24 hours' - NOW())) AS expires_in_seconds
            FROM ticket_assignment_requests ar
            JOIN tickets t ON ar.ticket_id = t.id
            JOIN users requester ON ar.requested_by = requester.id
            LEFT JOIN users reviewer ON ar.reviewed_by = reviewer.id
            ${whereClause}
            ORDER BY
                CASE ar.status
                    WHEN 'pending' THEN 0
                    WHEN 'approved' THEN 1
                    WHEN 'denied' THEN 2
                END,
                ar.created_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;
        params.push(parseInt(limit), offset);

        const result = await pool.query(dataQuery, params);

    res.status(200).json({
        status: 'success',
        data: result.rows,
        count: totalCount,
        page: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit))
    });
};

/**
 * Approve an assignment request — assigns the ticket to the requesting technician.
 * PATCH /api/assignment-requests/:id/approve
 */
export const approveRequest = async (req, res) => {
    const client = await pool.connect();

    await client.query('BEGIN');

    const { id } = req.params;

    // Fetch the request
    const requestResult = await client.query(
        `SELECT ar.*, t.status AS ticket_status, t.assigned_to AS ticket_assigned_to
         FROM ticket_assignment_requests ar
         JOIN tickets t ON ar.ticket_id = t.id
         WHERE ar.id = $1`,
        [id]
    );

    if (requestResult.rows.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        throw new NotFoundError('Assignment request not found');
    }

    const request = requestResult.rows[0];

    if (request.status !== 'pending') {
        await client.query('ROLLBACK');
        client.release();
        throw new ConflictError(`This request has already been ${request.status}.`);
    }

    // Check if the ticket was already assigned in the meantime
    if (request.ticket_assigned_to) {
        await client.query('ROLLBACK');
        client.release();
        throw new ConflictError('This ticket has already been assigned to another technician.');
    }

    // Check if the ticket is still in a valid status
    if (['closed', 'cancelled', 'resolved'].includes(request.ticket_status)) {
        await client.query('ROLLBACK');
        client.release();
        throw new BadRequestError(`Cannot assign a ticket with status: ${request.ticket_status}`);
    }

        // 1. Update the request status to approved
        await client.query(
            `UPDATE ticket_assignment_requests
             SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()
             WHERE id = $2`,
            [req.user.id, id]
        );

        // 2. Assign the ticket
        await client.query(
            `UPDATE tickets SET assigned_to = $1, updated_at = NOW() WHERE id = $2`,
            [request.requested_by, request.ticket_id]
        );

        // 3. Record in ticket_assignments
        await client.query(
            `INSERT INTO ticket_assignments (ticket_id, user_id, role, assigned_by, notes)
             VALUES ($1, $2, 'primary', $3, 'Approved assignment request')
             ON CONFLICT (ticket_id, user_id)
             DO UPDATE SET unassigned_at = NULL, assigned_at = CURRENT_TIMESTAMP,
                           assigned_by = $3, notes = 'Approved assignment request'`,
            [request.ticket_id, request.requested_by, req.user.id]
        );

        // 4. Auto-update ticket status to in_progress if currently open
        if (request.ticket_status === 'open') {
            await client.query(
                `UPDATE tickets SET status = 'in_progress', updated_at = NOW() WHERE id = $1`,
                [request.ticket_id]
            );
        }

        // 5. Deny all other pending requests for the same ticket
        await client.query(
            `UPDATE ticket_assignment_requests
             SET status = 'denied', reviewed_by = $1, reviewed_at = NOW()
             WHERE ticket_id = $2 AND id != $3 AND status = 'pending'`,
            [req.user.id, request.ticket_id, id]
        );

        await client.query('COMMIT');

        // Log to ticket history (outside transaction — non-critical)
        try {
            await TicketHistory.log(
                request.ticket_id,
                req.user.id,
                'ticket_assigned',
                'assigned_to',
                null,
                request.requested_by.toString(),
                `Assignment request approved by ${req.user.first_name || ''} ${req.user.last_name || ''}`.trim(),
                { assignment_type: 'request_approved', request_id: parseInt(id), approved_by: req.user.id }
            );

            if (request.ticket_status === 'open') {
                await TicketHistory.log(
                    request.ticket_id,
                    req.user.id,
                    'status_change',
                    'status',
                    'open',
                    'in_progress',
                    'Auto-updated when assignment request was approved'
                );
            }
        } catch (historyError) {
            console.error('Failed to log ticket history:', historyError);
        }

        // Send email notification (non-critical)
        try {
            const techResult = await pool.query(
                `SELECT first_name, last_name, email FROM users WHERE id = $1`,
                [request.requested_by]
            );
            if (techResult.rows.length > 0) {
                const tech = techResult.rows[0];
                const ticket = await Ticket.getById(request.ticket_id);
                await sendTicketAssignment(ticket, `${tech.first_name} ${tech.last_name}`);
            }
        } catch (emailError) {
            console.error('Failed to send assignment email:', emailError);
        }

        // Fetch the updated request for response
        const updatedResult = await pool.query(
            `SELECT ar.*,
                    requester.first_name AS requester_first_name,
                    requester.last_name AS requester_last_name,
                    t.subject AS ticket_title
             FROM ticket_assignment_requests ar
             JOIN users requester ON ar.requested_by = requester.id
             JOIN tickets t ON ar.ticket_id = t.id
             WHERE ar.id = $1`,
            [id]
        );

        // Notify the requesting technician that their request was approved
        try {
            const reviewerName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'Management';
            const ticketLabel = updatedResult.rows[0]?.ticket_title || `#${request.ticket_id}`;
            const notification = await Notification.create({
                user_id: request.requested_by,
                type: 'assignment',
                message: `Your assignment request for "${ticketLabel}" has been approved by ${reviewerName}. The ticket is now assigned to you.`,
                ticket_id: request.ticket_id
            });
            const io = req.app.get('io');
            if (io) {
                emitNotificationToUser(io, request.requested_by, notification);
                const unreadCount = await Notification.getUnreadCount(request.requested_by);
                emitUnreadCountToUser(io, request.requested_by, unreadCount);
            }
        } catch (notifError) {
            console.error('Failed to send approval notification to tech:', notifError);
        }

    res.status(200).json({
        status: 'success',
        message: 'Assignment request approved. Ticket has been assigned.',
        data: updatedResult.rows[0]
    });

    await client.query('COMMIT');
    client.release();
};

/**
 * Deny an assignment request.
 * PATCH /api/assignment-requests/:id/deny
 */
export const denyRequest = async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    // Fetch the request
    const requestResult = await pool.query(
        `SELECT * FROM ticket_assignment_requests WHERE id = $1`,
        [id]
    );

    if (requestResult.rows.length === 0) {
        throw new NotFoundError('Assignment request not found');
    }

    const request = requestResult.rows[0];

    if (request.status !== 'pending') {
        throw new ConflictError(`This request has already been ${request.status}.`);
    }

        // Update the request to denied
        const updateResult = await pool.query(
            `UPDATE ticket_assignment_requests
             SET status = 'denied', reviewed_by = $1, reviewed_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [req.user.id, id]
        );

        // Log to ticket history
        try {
            await TicketHistory.log(
                request.ticket_id,
                req.user.id,
                'assignment_denied',
                'assigned_to',
                request.requested_by.toString(),
                null,
                reason || `Assignment request denied by ${req.user.first_name || ''} ${req.user.last_name || ''}`.trim(),
                { assignment_type: 'request_denied', request_id: parseInt(id), denied_by: req.user.id, reason: reason || null }
            );
        } catch (historyError) {
            console.error('Failed to log ticket history:', historyError);
        }

        // Fetch enriched response
        const enrichedResult = await pool.query(
            `SELECT ar.*,
                    requester.first_name AS requester_first_name,
                    requester.last_name AS requester_last_name,
                    t.subject AS ticket_title
             FROM ticket_assignment_requests ar
             JOIN users requester ON ar.requested_by = requester.id
             JOIN tickets t ON ar.ticket_id = t.id
             WHERE ar.id = $1`,
            [id]
        );

        // Notify the requesting technician that their request was denied
        try {
            const reviewerName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'Management';
            const ticketLabel = enrichedResult.rows[0]?.ticket_title || `#${request.ticket_id}`;
            const denyMsg = reason
                ? `Your assignment request for "${ticketLabel}" was denied by ${reviewerName}. Reason: ${reason}`
                : `Your assignment request for "${ticketLabel}" was denied by ${reviewerName}.`;
            const notification = await Notification.create({
                user_id: request.requested_by,
                type: 'assignment',
                message: denyMsg,
                ticket_id: request.ticket_id
            });
            const io = req.app.get('io');
            if (io) {
                emitNotificationToUser(io, request.requested_by, notification);
                const unreadCount = await Notification.getUnreadCount(request.requested_by);
                emitUnreadCountToUser(io, request.requested_by, unreadCount);
            }
        } catch (notifError) {
            console.error('Failed to send denial notification to tech:', notifError);
        }

    res.status(200).json({
        status: 'success',
        message: 'Assignment request denied.',
        data: enrichedResult.rows[0]
    });
};
