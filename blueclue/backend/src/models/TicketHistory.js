// src/models/TicketHistory.js
import pool from '../config/database.js';

class TicketHistory {
    /**
     * Log an activity entry to ticket_history
     * @param {number} ticketId - The ticket ID
     * @param {number|null} changedBy - The user ID who made the change
     * @param {string} changeType - e.g. 'ticket_assigned', 'ticket_reassigned', 'status_change'
     * @param {string|null} fieldName - The field that changed
     * @param {string|null} oldValue - Previous value
     * @param {string|null} newValue - New value
     * @param {string|null} comment - Optional note/comment
     * @param {object|null} changeDetails - JSONB with rich details (names, etc.)
     */
    static async log(ticketId, changedBy, changeType, fieldName = null, oldValue = null, newValue = null, comment = null, changeDetails = null) {
        const query = `
            INSERT INTO ticket_history (ticket_id, changed_by, change_type, field_name, old_value, new_value, comment, change_details)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;
        const result = await pool.query(query, [
            ticketId,
            changedBy,
            changeType,
            fieldName,
            oldValue,
            newValue,
            comment,
            changeDetails ? JSON.stringify(changeDetails) : null
        ]);
        return result.rows[0];
    }

    /**
     * Get recent assignment activity across ALL tickets.
     * Returns entries of type ticket_assigned, ticket_reassigned, ticket_unassigned
     * for the global assignment activity feed.
     * @param {number} limit - Max entries to return (default 50)
     * @returns {Array} Recent assignment history entries
     */
    static async getRecentActivity(limit = 50) {
        const query = `
            SELECT 
                th.*,
                u.first_name || ' ' || u.last_name AS changed_by_name,
                u.role AS changed_by_role,
                t.ticket_number,
                t.subject AS ticket_subject,
                nv.first_name || ' ' || nv.last_name AS new_value_name,
                ov.first_name || ' ' || ov.last_name AS old_value_name
            FROM ticket_history th
            LEFT JOIN users u ON th.changed_by = u.id
            LEFT JOIN tickets t ON th.ticket_id = t.id
            LEFT JOIN users nv ON nv.id = CASE WHEN th.new_value ~ '^[0-9]+$' THEN CAST(th.new_value AS INTEGER) ELSE NULL END
            LEFT JOIN users ov ON ov.id = CASE WHEN th.old_value ~ '^[0-9]+$' THEN CAST(th.old_value AS INTEGER) ELSE NULL END
            WHERE th.change_type IN ('ticket_assigned', 'ticket_reassigned', 'ticket_unassigned', 'assignment', 'ticket_cancelled')
            ORDER BY th.created_at DESC
            LIMIT $1
        `;
        const result = await pool.query(query, [limit]);
        return result.rows;
    }

    /**
     * Get all history entries for a ticket, with user names joined
     * @param {number} ticketId - The ticket ID
     * @returns {Array} History entries sorted by created_at DESC
     */
    static async getByTicketId(ticketId) {
        const query = `
            SELECT 
                th.*,
                u.first_name || ' ' || u.last_name AS changed_by_name,
                u.role AS changed_by_role
            FROM ticket_history th
            LEFT JOIN users u ON th.changed_by = u.id
            WHERE th.ticket_id = $1
            ORDER BY th.created_at DESC
        `;
        const result = await pool.query(query, [ticketId]);
        return result.rows;
    }
}

export default TicketHistory;
