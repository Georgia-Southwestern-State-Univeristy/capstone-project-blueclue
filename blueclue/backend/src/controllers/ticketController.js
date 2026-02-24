// src/controllers/ticketController.js
import Ticket from '../models/Ticket.js';
import AIClassification from '../models/AIClassification.js';
import PriorityOverride from '../models/PriorityOverride.js';
import AIConfiguration from '../models/AIConfiguration.js';
import UserPrivilege from '../models/UserPrivilege.js';
import CategoryAccess from '../models/CategoryAccess.js';
import TicketHistory from '../models/TicketHistory.js';
import Notification from '../models/Notification.js';
import { classifyTicketWithFallback } from '../services/aiService.js';
import { calculateFinalPriority, explainPriorityDecision } from '../services/priorityService.js';
import pool from '../config/database.js';
import { sendTicketConfirmation, sendTicketStatusUpdate, sendTicketAssignment } from '../services/emailService.js';
import { emitNotificationToUser, emitUnreadCountToUser, broadcastNotification } from '../services/socketService.js';

// Helper function to check if user is a technician (any level)
const isTechnician = (role) => {
    return ['technician', 'senior_technician', 'management'].includes(role);
};

// Valid ticket statuses (must match database enum)
const VALID_STATUSES = ['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'];

// Valid status transitions (business rules)
const VALID_TRANSITIONS = {
    'open': ['in_progress', 'waiting_on_customer', 'resolved', 'closed'],
    'in_progress': ['waiting_on_customer', 'resolved', 'open'],
    'waiting_on_customer': ['in_progress', 'resolved', 'open'],
    'resolved': ['closed', 'in_progress', 'open', 'waiting_on_customer'], // Allow reopening and status changes
    'closed': [] // Cannot transition from closed - final state
};

/**
 * Auto-deny all pending assignment requests for a ticket.
 * Called whenever a ticket gets assigned/reassigned through any code path.
 * Notifies each affected technician via socket.
 */
const autoDenyPendingRequests = async (ticketId, reviewerId, reason, io) => {
    try {
        // Find all pending requests for this ticket
        const pendingResult = await pool.query(
            `SELECT ar.id, ar.requested_by, t.subject AS ticket_title
             FROM ticket_assignment_requests ar
             JOIN tickets t ON ar.ticket_id = t.id
             WHERE ar.ticket_id = $1 AND ar.status = 'pending'`,
            [ticketId]
        );

        if (pendingResult.rows.length === 0) return;

        // Bulk-deny all pending requests
        await pool.query(
            `UPDATE ticket_assignment_requests
             SET status = 'denied', reviewed_by = $1, reviewed_at = NOW()
             WHERE ticket_id = $2 AND status = 'pending'`,
            [reviewerId, ticketId]
        );

        // Notify each affected technician
        for (const row of pendingResult.rows) {
            try {
                const ticketLabel = row.ticket_title || `#${ticketId}`;
                const notification = await Notification.create({
                    user_id: row.requested_by,
                    type: 'assignment',
                    message: `Your assignment request for "${ticketLabel}" was automatically denied: ${reason}`,
                    ticket_id: ticketId
                });
                if (io) {
                    emitNotificationToUser(io, row.requested_by, notification);
                    const unreadCount = await Notification.getUnreadCount(row.requested_by);
                    emitUnreadCountToUser(io, row.requested_by, unreadCount);
                }
            } catch (notifErr) {
                console.error(`Failed to notify tech ${row.requested_by} about auto-deny:`, notifErr.message);
            }
        }

        console.log(`Auto-denied ${pendingResult.rows.length} pending request(s) for ticket ${ticketId}`);
    } catch (err) {
        console.error('autoDenyPendingRequests error:', err.message);
    }
};

/**
 * Create a new ticket
 * POST /api/tickets
 */
export const createTicket = async (req, res) => {
    try {
        const { subject, description, customer_id, priority, category } = req.body;

        // Validation
        if (!subject || subject.trim() === '') {
            return res.status(400).json({
                status: 'error',
                message: 'Subject is required'
            });
        }

        if (!description || description.trim() === '') {
            return res.status(400).json({
                status: 'error',
                message: 'Description is required'
            });
        }

        // Require customer_id (authenticated users only)
        if (!customer_id) {
            return res.status(400).json({
                status: 'error',
                message: 'Customer ID is required. Please log in to create a ticket.'
            });
        }

        // Combine subject and description for AI classification
        const ticketText = `${subject.trim()}. ${description.trim()}`;

        // Get AI classification with fallback to manual or default values
        const aiResult = await classifyTicketWithFallback(ticketText, {
            category: category || 'general',
            priority: priority || 'low'
        });

        // Store user-selected priority (if provided)
        const userPriority = priority || null;
        
        // Store AI-predicted priority (if AI was successful)
        const aiPriority = aiResult.aiClassified ? aiResult.priority : null;

        // Use AI classification for category if not provided by user
        const finalCategory = category || aiResult.category;
        
        // Get AI configuration for priority calculation
        const priorityConfig = await AIConfiguration.getPriorityWeights();
        
        // Calculate final priority using weighted algorithm
        const priorityCalculation = calculateFinalPriority({
            userPriority,
            aiPriority: aiPriority || 'low',
            aiConfidence: aiResult.confidence || 0,
            config: priorityConfig
        });

        const finalPriority = priorityCalculation.finalPriority;
        const priorityExplanation = explainPriorityDecision(
            priorityCalculation, 
            userPriority, 
            aiPriority
        );

        // Create ticket with AI classification metadata and priority tracking
        const ticket = await Ticket.create({
            subject: subject.trim(),
            description: description.trim(),
            customer_id: customer_id,
            priority: finalPriority,
            user_priority: userPriority,
            ai_priority: aiPriority,
            ai_recommended_priority: aiPriority, // Store original AI recommendation
            priority_overridden: userPriority && userPriority !== finalPriority,
            priority_calculation_method: priorityCalculation.metadata.method,
            category: finalCategory,
            ai_classified: aiResult.aiClassified,
            ai_confidence: aiResult.confidence,
            ai_fallback_used: aiResult.fallbackUsed,
            ai_keywords_matched: aiResult.aiClassified ? {
                category_keywords: aiResult.category_keywords || [],
                priority_keywords: aiResult.priority_keywords || []
            } : null
        });

        // Save AI classification to ai_classifications table
        if (aiResult.aiClassified) {
            await AIClassification.create({
                ticket_id: ticket.id,
                predicted_category: aiResult.category,
                predicted_priority: aiResult.priority,
                confidence: aiResult.confidence,
                keywords_matched: {
                    category_keywords: aiResult.category_keywords || [],
                    priority_keywords: aiResult.priority_keywords || []
                },
                fallback_used: aiResult.fallbackUsed
            });

            // Track priority override if it occurred
            if (userPriority && priorityCalculation.metadata.method !== 'ai_direct') {
                await PriorityOverride.create({
                    ticket_id: ticket.id,
                    user_id: customer_id,
                    user_priority: userPriority,
                    ai_recommended_priority: aiPriority,
                    final_priority: finalPriority,
                    ai_confidence: aiResult.confidence,
                    confidence_level: priorityCalculation.metadata.confidenceLevel,
                    significant_difference: priorityCalculation.metadata.significantDifference || false
                });
            }
        }

        // Add AI classification info to response
        const response = {
            status: 'success',
            message: 'Ticket created successfully',
            data: ticket,
            ai_classification: {
                used: aiResult.aiClassified,
                confidence: aiResult.confidence,
                fallback_used: aiResult.fallbackUsed,
                category: finalCategory,
                user_priority: userPriority,
                ai_priority: aiPriority,
                final_priority: finalPriority,
                priority_explanation: priorityExplanation,
                priority_calculation: priorityCalculation.metadata
            }
        };

        // Include warning if priority confirmation needed
        if (priorityCalculation.requiresConfirmation && priorityCalculation.warning) {
            response.priority_warning = priorityCalculation.warning;
        }

        // Include warning if AI service failed
        if (!aiResult.aiClassified && aiResult.error) {
            response.ai_classification.warning = `AI service unavailable: ${aiResult.error}`;
        }

        // Send ticket confirmation email if user has notifications enabled
        try {
            const customerResult = await pool.query(
                'SELECT email, first_name, email_notifications FROM users WHERE id = $1',
                [customer_id]
            );
            
            if (customerResult.rows[0] && customerResult.rows[0].email_notifications) {
                await sendTicketConfirmation(
                    customerResult.rows[0].email,
                    customerResult.rows[0].first_name,
                    ticket,
                    customer_id
                );
                console.log(`✅ Ticket confirmation email sent to ${customerResult.rows[0].email}`);
            }
        } catch (emailError) {
            // Log email error but don't fail the ticket creation
            console.error('Failed to send ticket confirmation email:', emailError.message);
        }

        res.status(201).json(response);

    } catch (error) {
        console.error('Create ticket error:', error);
        
        if (error.code === '23503') {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid user ID or category'
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Failed to create ticket',
            error: error.message
        });
    }
};

/**
 * Get all tickets
 * GET /api/tickets
 * For customers/guests: returns only their tickets
 * For technicians/admins: returns tickets based on category access
 */
export const getAllTickets = async (req, res) => {
    try {
        let tickets;
        
        // Check if user is authenticated and is a customer or guest
        if (req.user && req.user.role === 'customer') {
            // Filter tickets by customer_id for customers
            tickets = await Ticket.getByCustomerId(req.user.id);
        } else if (req.user && req.user.role === 'guest') {
            // Filter tickets by email for guests (they don't have customer_id)
            tickets = await Ticket.getByEmail(req.user.email);
        } else if (req.user && req.user.role === 'admin') {
            // Admins can see all tickets
            tickets = await Ticket.getAll();
        } else if (req.user && isTechnician(req.user.role)) {
            // Check if technician has CAN_VIEW_ALL_TICKETS privilege
            const canViewAll = await UserPrivilege.hasPrivilege(req.user.id, 'CAN_VIEW_ALL_TICKETS');
            
            if (canViewAll) {
                tickets = await Ticket.getAll();
            } else {
                // Filter by accessible categories
                const accessibleCategories = await CategoryAccess.getUserAccessibleCategories(req.user.id, 'view');
                
                if (accessibleCategories.length === 0) {
                    return res.status(200).json({
                        status: 'success',
                        count: 0,
                        data: [],
                        message: 'No category access. Contact administrator.'
                    });
                }
                
                // Get category names from IDs
                const categoryQuery = `
                    SELECT name FROM categories WHERE id = ANY($1::int[])
                `;
                const categoryResult = await pool.query(categoryQuery, [accessibleCategories]);
                const categoryNames = categoryResult.rows.map(row => row.name);
                
                // Filter tickets by accessible categories
                const ticketsQuery = `
                    SELECT t.*, 
                           c.first_name || ' ' || c.last_name as customer_name,
                           c.email as customer_email,
                           a.first_name || ' ' || a.last_name as assigned_to_name
                    FROM tickets t
                    JOIN users c ON t.customer_id = c.id
                    LEFT JOIN users a ON t.assigned_to = a.id
                    WHERE t.category = ANY($1::ticket_category[])
                    ORDER BY t.created_at DESC
                `;
                const ticketsResult = await pool.query(ticketsQuery, [categoryNames]);
                tickets = ticketsResult.rows;
            }
        } else {
            // Unauthenticated users get no tickets
            tickets = [];
        }

        res.status(200).json({
            status: 'success',
            count: tickets.length,
            data: tickets
        });

    } catch (error) {
        console.error('Get all tickets error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve tickets',
            error: error.message
        });
    }
};

/**
 * Get tickets assigned to the logged-in technician
 * GET /api/tickets/assigned/me
 * For technicians: returns only their assigned tickets (filtered by category access)
 * For admins: returns all tickets
 */
export const getMyAssignedTickets = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                status: 'error',
                message: 'Authentication required'
            });
        }

        let tickets;

        // Check if user is a technician
        if (isTechnician(req.user.role)) {
            // Get tickets assigned to this technician
            let assignedTickets = await Ticket.getByTechnicianId(req.user.id);
            
            // Check if technician has CAN_VIEW_ALL_TICKETS privilege
            const canViewAll = await UserPrivilege.hasPrivilege(req.user.id, 'CAN_VIEW_ALL_TICKETS');
            
            if (!canViewAll) {
                // Filter by accessible categories
                const accessibleCategories = await CategoryAccess.getUserAccessibleCategories(req.user.id, 'view');
                
                if (accessibleCategories.length > 0) {
                    // Get category names from IDs
                    const categoryQuery = `SELECT name FROM categories WHERE id = ANY($1::int[])`;
                    const categoryResult = await pool.query(categoryQuery, [accessibleCategories]);
                    const categoryNames = categoryResult.rows.map(row => row.name);
                    
                    // Filter assigned tickets by accessible categories
                    tickets = assignedTickets.filter(ticket => categoryNames.includes(ticket.category));
                } else {
                    tickets = [];
                }
            } else {
                tickets = assignedTickets;
            }
        } else if (req.user.role === 'admin') {
            // Admins can see all tickets
            tickets = await Ticket.getAll();
        } else {
            // Other roles cannot access this endpoint
            return res.status(403).json({
                status: 'error',
                message: 'Access denied. Only technicians and admins can view assigned tickets.'
            });
        }

        res.status(200).json({
            status: 'success',
            count: tickets.length,
            data: tickets
        });

    } catch (error) {
        console.error('Get assigned tickets error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve assigned tickets',
            error: error.message
        });
    }
};

/**
 * Get a single ticket by ID
 * GET /api/tickets/:id
 */
export const getTicketById = async (req, res) => {
    try {
        const { id } = req.params;

        if (isNaN(id)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid ticket ID'
            });
        }

        const ticket = await Ticket.getById(parseInt(id));

        if (!ticket) {
            return res.status(404).json({
                status: 'error',
                message: 'Ticket not found'
            });
        }

        // Check category access for technicians
        if (req.user && isTechnician(req.user.role)) {
            const canViewAll = await UserPrivilege.hasPrivilege(req.user.id, 'CAN_VIEW_ALL_TICKETS');
            
            if (!canViewAll) {
                // Get category ID from ticket
                const categoryQuery = `SELECT id FROM categories WHERE name = $1`;
                const categoryResult = await pool.query(categoryQuery, [ticket.category]);
                
                if (categoryResult.rows.length > 0) {
                    const categoryId = categoryResult.rows[0].id;
                    const hasAccess = await CategoryAccess.hasAccess(req.user.id, categoryId, 'view');
                    
                    if (!hasAccess) {
                        return res.status(403).json({
                            status: 'error',
                            message: 'Access denied. No permission to view this category.'
                        });
                    }
                }
            }
        }
        
        // Customers can only view their own tickets
        if (req.user && req.user.role === 'customer' && ticket.customer_id !== req.user.id) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied. You can only view your own tickets.'
            });
        }

        res.status(200).json({
            status: 'success',
            data: ticket
        });

    } catch (error) {
        console.error('Get ticket by ID error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve ticket',
            error: error.message
        });
    }
};

/**
 * Update a ticket
 * PUT /api/tickets/:id
 */
export const updateTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (isNaN(id)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid ticket ID'
            });
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'No fields to update'
            });
        }

        if (updates.subject !== undefined && updates.subject.trim() === '') {
            return res.status(400).json({
                status: 'error',
                message: 'Subject cannot be empty'
            });
        }

        if (updates.description !== undefined && updates.description.trim() === '') {
            return res.status(400).json({
                status: 'error',
                message: 'Description cannot be empty'
            });
        }

        if (updates.subject) updates.subject = updates.subject.trim();
        if (updates.description) updates.description = updates.description.trim();

        // Get existing ticket for permission checks
        const existingTicket = await Ticket.getById(parseInt(id));
        if (!existingTicket) {
            return res.status(404).json({
                status: 'error',
                message: 'Ticket not found'
            });
        }

        // Check if user is trying to change assignment
        if (updates.assigned_to !== undefined && req.user) {
            // Admins and management can always change assignments
            if (req.user.role !== 'admin' && req.user.role !== 'management') {
                const canAssign = await UserPrivilege.hasPrivilege(req.user.id, 'CAN_ASSIGN_TICKETS');
                if (!canAssign) {
                    return res.status(403).json({
                        status: 'error',
                        message: 'Access denied. You do not have permission to assign tickets.'
                    });
                }
            }
        }

        // Check category access for technicians
        if (req.user && isTechnician(req.user.role)) {
            const canEditAny = await UserPrivilege.hasPrivilege(req.user.id, 'CAN_EDIT_ANY_TICKET');
            
            if (!canEditAny) {
                // Get category ID from ticket
                const categoryQuery = `SELECT id FROM categories WHERE name = $1`;
                const categoryResult = await pool.query(categoryQuery, [existingTicket.category]);
                
                if (categoryResult.rows.length > 0) {
                    const categoryId = categoryResult.rows[0].id;
                    const hasAccess = await CategoryAccess.hasAccess(req.user.id, categoryId, 'edit');
                    
                    if (!hasAccess) {
                        return res.status(403).json({
                            status: 'error',
                            message: 'Access denied. No permission to edit tickets in this category.'
                        });
                    }
                }
            }
        }

        // Automatically set resolved_at when status changes to resolved or closed
        if (updates.status === 'resolved' || updates.status === 'closed') {
            if (!updates.resolved_at) {
                updates.resolved_at = new Date();
            }
        }

        const ticket = await Ticket.update(parseInt(id), updates);

        if (!ticket) {
            return res.status(404).json({
                status: 'error',
                message: 'Ticket not found'
            });
        }

        // Log assignment change to ticket history
        if (updates.assigned_to !== undefined && updates.assigned_to !== existingTicket.assigned_to) {
            try {
                const assignerName = req.user ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'System' : 'System';
                const isUnassign = updates.assigned_to === null;

                if (isUnassign) {
                    // Unassign — look up the previous assignee name
                    let prevName = null;
                    if (existingTicket.assigned_to) {
                        const prevResult = await pool.query(
                            'SELECT first_name, last_name FROM users WHERE id = $1',
                            [existingTicket.assigned_to]
                        );
                        if (prevResult.rows[0]) {
                            prevName = `${prevResult.rows[0].first_name} ${prevResult.rows[0].last_name}`;
                        }
                    }
                    await TicketHistory.log(
                        parseInt(id),
                        req.user ? req.user.id : null,
                        'ticket_unassigned',
                        'assigned_to',
                        existingTicket.assigned_to ? existingTicket.assigned_to.toString() : null,
                        null,
                        null,
                        {
                            action: 'unassign',
                            previous_assignee_name: prevName,
                            unassigned_by_name: assignerName,
                            ticket_number: existingTicket.ticket_number
                        }
                    );
                } else if (existingTicket.assigned_to) {
                    // Reassignment via general update
                    let prevName = null;
                    const prevResult = await pool.query(
                        'SELECT first_name, last_name FROM users WHERE id = $1',
                        [existingTicket.assigned_to]
                    );
                    if (prevResult.rows[0]) {
                        prevName = `${prevResult.rows[0].first_name} ${prevResult.rows[0].last_name}`;
                    }
                    let newName = null;
                    const newResult = await pool.query(
                        'SELECT first_name, last_name FROM users WHERE id = $1',
                        [updates.assigned_to]
                    );
                    if (newResult.rows[0]) {
                        newName = `${newResult.rows[0].first_name} ${newResult.rows[0].last_name}`;
                    }
                    await TicketHistory.log(
                        parseInt(id),
                        req.user ? req.user.id : null,
                        'ticket_reassigned',
                        'assigned_to',
                        existingTicket.assigned_to.toString(),
                        updates.assigned_to.toString(),
                        null,
                        {
                            action: 'reassign',
                            previous_assignee_name: prevName,
                            assigned_to_name: newName,
                            assigned_by_name: assignerName,
                            ticket_number: existingTicket.ticket_number
                        }
                    );
                } else {
                    // Fresh assignment via general update
                    let newName = null;
                    const newResult = await pool.query(
                        'SELECT first_name, last_name FROM users WHERE id = $1',
                        [updates.assigned_to]
                    );
                    if (newResult.rows[0]) {
                        newName = `${newResult.rows[0].first_name} ${newResult.rows[0].last_name}`;
                    }
                    await TicketHistory.log(
                        parseInt(id),
                        req.user ? req.user.id : null,
                        'ticket_assigned',
                        'assigned_to',
                        'unassigned',
                        updates.assigned_to.toString(),
                        null,
                        {
                            action: 'assign',
                            assigned_to_name: newName,
                            assigned_by_name: assignerName,
                            ticket_number: existingTicket.ticket_number
                        }
                    );
                }
            } catch (histErr) {
                console.error('Failed to log assignment history in updateTicket:', histErr.message);
            }
        }

        // Auto-deny pending assignment requests if ticket was just assigned
        if (updates.assigned_to !== undefined && updates.assigned_to !== existingTicket.assigned_to && updates.assigned_to !== null) {
            const io = req.app.get('io');
            await autoDenyPendingRequests(
                parseInt(id),
                req.user ? req.user.id : null,
                'Ticket was assigned through another action',
                io
            );
        }

        // Send assignment notification if ticket was assigned to a technician
        if (updates.assigned_to !== undefined && updates.assigned_to !== existingTicket.assigned_to) {
            try {
                // Fetch technician email and notification preference
                const techResult = await pool.query(
                    'SELECT email, first_name, last_name, email_notifications FROM users WHERE id = $1',
                    [updates.assigned_to]
                );
                
                if (techResult.rows[0] && techResult.rows[0].email_notifications) {
                    // Fetch requester name
                    const requesterResult = await pool.query(
                        'SELECT first_name, last_name FROM users WHERE id = $1',
                        [ticket.customer_id]
                    );
                    
                    const techName = `${techResult.rows[0].first_name} ${techResult.rows[0].last_name}`;
                    const requesterName = requesterResult.rows[0] 
                        ? `${requesterResult.rows[0].first_name} ${requesterResult.rows[0].last_name}`
                        : 'Unknown';
                    
                    await sendTicketAssignment(
                        techResult.rows[0].email,
                        techName,
                        ticket,
                        requesterName,
                        updates.assigned_to
                    );
                    console.log(`✅ Assignment notification sent to ${techResult.rows[0].email}`);
                }
            } catch (emailError) {
                // Log email error but don't fail the assignment
                console.error('Failed to send assignment notification:', emailError.message);
            }
        }

        res.status(200).json({
            status: 'success',
            message: 'Ticket updated successfully',
            data: ticket
        });

    } catch (error) {
        console.error('Update ticket error:', error);

        if (error.code === '23503') {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid category'
            });
        }

        if (error.message === 'No valid fields to update') {
            return res.status(400).json({
                status: 'error',
                message: error.message
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Failed to update ticket',
            error: error.message
        });
    }
};

/**
 * Delete a ticket (soft delete)
 * DELETE /api/tickets/:id
 */
export const deleteTicket = async (req, res) => {
    try {
        const { id } = req.params;

        if (isNaN(id)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid ticket ID'
            });
        }

        const ticket = await Ticket.delete(parseInt(id));

        if (!ticket) {
            return res.status(404).json({
                status: 'error',
                message: 'Ticket not found'
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Ticket deleted successfully',
            data: ticket
        });

    } catch (error) {
        console.error('Delete ticket error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete ticket',
            error: error.message
        });
    }
};

/**
 * Bulk assign tickets to a technician
 * POST /api/tickets/bulk-assign
 */
export const bulkAssignTickets = async (req, res) => {
    try {
        const { ticket_ids, technician_id, note } = req.body;
        const io = req.app.get('io');

        // Validation
        if (!ticket_ids || !Array.isArray(ticket_ids) || ticket_ids.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'ticket_ids must be a non-empty array'
            });
        }

        if (!technician_id) {
            return res.status(400).json({
                status: 'error',
                message: 'technician_id is required'
            });
        }

        // Verify technician exists and is active
        const techResult = await pool.query(
            `SELECT id, first_name, last_name, email, role, email_notifications
             FROM users WHERE id = $1 AND role IN ('technician', 'senior_technician') AND is_active = true`,
            [technician_id]
        );

        if (techResult.rows.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid technician. User does not exist or is not an active technician.'
            });
        }

        const technician = techResult.rows[0];
        const techName = `${technician.first_name} ${technician.last_name}`;

        // Check permission: management and admin can bulk-assign
        if (req.user && !['management', 'admin'].includes(req.user.role)) {
            const canAssign = await UserPrivilege.hasPrivilege(req.user.id, 'CAN_ASSIGN_TICKETS');
            if (!canAssign) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Access denied. You do not have permission to assign tickets.'
                });
            }
        }

        // Validate technician has category access for each ticket
        const ticketsResult = await pool.query(
            `SELECT t.id, t.category FROM tickets t WHERE t.id = ANY($1::int[])`,
            [ticket_ids]
        );
        const ticketCategories = [...new Set(ticketsResult.rows.map(t => t.category).filter(Boolean))];

        if (ticketCategories.length > 0) {
            const catResult = await pool.query(
                `SELECT id, name FROM categories WHERE name = ANY($1::ticket_category[])`,
                [ticketCategories]
            );
            const deniedCategories = [];
            for (const cat of catResult.rows) {
                const hasAccess = await CategoryAccess.hasAccess(technician_id, cat.id, 'view');
                if (!hasAccess) {
                    deniedCategories.push(cat.name);
                }
            }
            if (deniedCategories.length > 0) {
                return res.status(403).json({
                    status: 'error',
                    message: `Technician does not have access to categories: ${deniedCategories.join(', ')}`
                });
            }
        }

        // Bulk update all tickets
        const updateQuery = `
            UPDATE tickets
            SET assigned_to = $1, 
                status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ANY($2::int[])
            RETURNING *
        `;
        const updateResult = await pool.query(updateQuery, [technician_id, ticket_ids]);

        const updatedCount = updateResult.rows.length;

        // Log assignment activity for each ticket
        const assignerName = req.user ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'System' : 'System';
        for (const ticket of updateResult.rows) {
            try {
                await TicketHistory.log(
                    ticket.id,
                    req.user ? req.user.id : null,
                    'ticket_assigned',
                    'assigned_to',
                    'unassigned',
                    technician_id.toString(),
                    note || null,
                    {
                        action: 'bulk_assign',
                        assigned_to_name: techName,
                        assigned_by_name: assignerName,
                        ticket_number: ticket.ticket_number
                    }
                );
            } catch (histErr) {
                console.error(`Failed to log history for ticket ${ticket.id}:`, histErr.message);
            }
        }

        // Send assignment notification email for each ticket (non-blocking)
        if (technician.email_notifications) {
            for (const ticket of updateResult.rows) {
                try {
                    const requesterResult = await pool.query(
                        'SELECT first_name, last_name FROM users WHERE id = $1',
                        [ticket.customer_id]
                    );
                    const requesterName = requesterResult.rows[0]
                        ? `${requesterResult.rows[0].first_name} ${requesterResult.rows[0].last_name}`
                        : 'Unknown';

                    await sendTicketAssignment(
                        technician.email,
                        techName,
                        ticket,
                        requesterName,
                        technician_id
                    );
                } catch (emailError) {
                    console.error(`Failed to send assignment email for ticket ${ticket.id}:`, emailError.message);
                }
            }
        }

        // Create in-app notifications for each assigned ticket
        for (const ticket of updateResult.rows) {
            try {
                const notification = await Notification.create({
                    user_id: technician_id,
                    type: 'assignment',
                    message: `You have been assigned to ticket #${ticket.ticket_number}: ${ticket.subject}`,
                    ticket_id: ticket.id
                });

                // Emit real-time notification via WebSocket
                if (io) {
                    emitNotificationToUser(io, technician_id, notification);
                }
            } catch (notifError) {
                console.error(`Failed to create in-app notification for ticket ${ticket.id}:`, notifError.message);
            }
        }

        // Emit updated unread count once after all notifications
        if (io && updateResult.rows.length > 0) {
            try {
                const unreadCount = await Notification.getUnreadCount(technician_id);
                emitUnreadCountToUser(io, technician_id, unreadCount);
            } catch (countError) {
                console.error('Failed to update unread count:', countError.message);
            }
        }

        // Auto-deny pending assignment requests for each ticket in the bulk
        for (const ticket of updateResult.rows) {
            await autoDenyPendingRequests(
                ticket.id,
                req.user ? req.user.id : null,
                'Ticket was bulk-assigned to another technician',
                io
            );
        }

        res.status(200).json({
            status: 'success',
            message: `${updatedCount} ticket(s) assigned to ${techName}`,
            data: {
                assigned_count: updatedCount,
                technician: { id: technician.id, name: techName },
                ticket_ids: updateResult.rows.map(t => t.id)
            }
        });

    } catch (error) {
        console.error('Bulk assign tickets error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to assign tickets',
            error: error.message
        });
    }
};

/**
 * Assign a single ticket to a technician
 * POST /api/tickets/:id/assign
 */
export const assignTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const { technician_id, note } = req.body;

        if (isNaN(id)) {
            return res.status(400).json({ status: 'error', message: 'Invalid ticket ID' });
        }

        if (!technician_id) {
            return res.status(400).json({ status: 'error', message: 'technician_id is required' });
        }

        // Check assigner privileges
        if (req.user && !['management', 'admin'].includes(req.user.role)) {
            const canAssign = await UserPrivilege.hasPrivilege(req.user.id, 'CAN_ASSIGN_TICKETS');
            if (!canAssign) {
                return res.status(403).json({ status: 'error', message: 'Access denied. You do not have permission to assign tickets.' });
            }
        }

        // Get the ticket
        const ticket = await Ticket.getById(parseInt(id));
        if (!ticket) {
            return res.status(404).json({ status: 'error', message: 'Ticket not found' });
        }

        // Check if already assigned (suggest reassign instead)
        if (ticket.assigned_to) {
            return res.status(409).json({
                status: 'error',
                message: 'Ticket is already assigned. Use PATCH /api/tickets/:id/reassign to reassign.',
                current_assignee: ticket.assigned_to_name
            });
        }

        // Verify technician exists and is active
        const techResult = await pool.query(
            `SELECT id, first_name, last_name, email, role, email_notifications
             FROM users WHERE id = $1 AND role IN ('technician', 'senior_technician') AND is_active = true`,
            [technician_id]
        );
        if (techResult.rows.length === 0) {
            return res.status(400).json({ status: 'error', message: 'Invalid technician. User does not exist or is not an active technician.' });
        }

        const technician = techResult.rows[0];
        const techName = `${technician.first_name} ${technician.last_name}`;

        // Validate technician has access to this ticket's category
        const categoryQuery = `SELECT id FROM categories WHERE name = $1`;
        const categoryResult = await pool.query(categoryQuery, [ticket.category]);
        if (categoryResult.rows.length > 0) {
            const categoryId = categoryResult.rows[0].id;
            const hasAccess = await CategoryAccess.hasAccess(technician_id, categoryId, 'view');
            if (!hasAccess) {
                return res.status(403).json({
                    status: 'error',
                    message: `Technician does not have access to the '${ticket.category}' category.`
                });
            }
        }

        // Assign the ticket
        const updatedTicket = await Ticket.update(parseInt(id), {
            assigned_to: technician_id,
            status: ticket.status === 'open' ? 'in_progress' : ticket.status
        });

        // Log assignment activity
        const assignerName = req.user ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'System' : 'System';
        try {
            await TicketHistory.log(
                parseInt(id),
                req.user ? req.user.id : null,
                'ticket_assigned',
                'assigned_to',
                'unassigned',
                technician_id.toString(),
                note || null,
                {
                    action: 'assign',
                    assigned_to_name: techName,
                    assigned_by_name: assignerName,
                    ticket_number: ticket.ticket_number
                }
            );
        } catch (histErr) {
            console.error('Failed to log assignment history:', histErr.message);
        }

        // Auto-deny pending assignment requests for this ticket
        const io = req.app.get('io');
        await autoDenyPendingRequests(
            parseInt(id),
            req.user ? req.user.id : null,
            'Ticket was directly assigned to another technician',
            io
        );

        // Send assignment notification
        if (technician.email_notifications) {
            try {
                const requesterResult = await pool.query(
                    'SELECT first_name, last_name FROM users WHERE id = $1',
                    [ticket.customer_id]
                );
                const requesterName = requesterResult.rows[0]
                    ? `${requesterResult.rows[0].first_name} ${requesterResult.rows[0].last_name}`
                    : 'Unknown';
                await sendTicketAssignment(technician.email, techName, updatedTicket, requesterName, technician_id);
            } catch (emailError) {
                console.error('Failed to send assignment notification:', emailError.message);
            }
        }

        // Create in-app notification for the assigned technician
        try {
            const notification = await Notification.create({
                user_id: technician_id,
                type: 'assignment',
                message: `You have been assigned to ticket #${ticket.ticket_number}: ${ticket.subject}`,
                ticket_id: parseInt(id)
            });

            // Emit real-time notification via WebSocket
            if (io) {
                emitNotificationToUser(io, technician_id, notification);
                const unreadCount = await Notification.getUnreadCount(technician_id);
                emitUnreadCountToUser(io, technician_id, unreadCount);
            }
        } catch (notifError) {
            console.error('Failed to create in-app notification:', notifError.message);
        }

        res.status(200).json({
            status: 'success',
            message: `Ticket #${id} assigned to ${techName}`,
            data: updatedTicket,
            assignment: {
                technician: { id: technician.id, name: techName },
                note: note || null,
                assigned_by: req.user ? req.user.id : null
            }
        });

    } catch (error) {
        console.error('Assign ticket error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to assign ticket', error: error.message });
    }
};

/**
 * Reassign an already-assigned ticket to a different technician
 * PATCH /api/tickets/:id/reassign
 */
export const reassignTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const { technician_id, note } = req.body;

        if (isNaN(id)) {
            return res.status(400).json({ status: 'error', message: 'Invalid ticket ID' });
        }

        if (!technician_id) {
            return res.status(400).json({ status: 'error', message: 'technician_id is required' });
        }

        // Check assigner privileges
        if (req.user && !['management', 'admin'].includes(req.user.role)) {
            const canAssign = await UserPrivilege.hasPrivilege(req.user.id, 'CAN_ASSIGN_TICKETS');
            if (!canAssign) {
                return res.status(403).json({ status: 'error', message: 'Access denied. You do not have permission to reassign tickets.' });
            }
        }

        // Get the ticket
        const ticket = await Ticket.getById(parseInt(id));
        if (!ticket) {
            return res.status(404).json({ status: 'error', message: 'Ticket not found' });
        }

        // Store previous assignee info for response
        const previousAssignee = ticket.assigned_to
            ? { id: ticket.assigned_to, name: ticket.assigned_to_name }
            : null;

        // Verify new technician exists and is active
        const techResult = await pool.query(
            `SELECT id, first_name, last_name, email, role, email_notifications
             FROM users WHERE id = $1 AND role IN ('technician', 'senior_technician') AND is_active = true`,
            [technician_id]
        );
        if (techResult.rows.length === 0) {
            return res.status(400).json({ status: 'error', message: 'Invalid technician. User does not exist or is not an active technician.' });
        }

        const technician = techResult.rows[0];
        const techName = `${technician.first_name} ${technician.last_name}`;

        // Cannot reassign to the same person
        if (ticket.assigned_to === technician_id) {
            return res.status(400).json({
                status: 'error',
                message: `Ticket is already assigned to ${techName}.`
            });
        }

        // Validate technician has access to this ticket's category
        const categoryQuery = `SELECT id FROM categories WHERE name = $1`;
        const categoryResult = await pool.query(categoryQuery, [ticket.category]);
        if (categoryResult.rows.length > 0) {
            const categoryId = categoryResult.rows[0].id;
            const hasAccess = await CategoryAccess.hasAccess(technician_id, categoryId, 'view');
            if (!hasAccess) {
                return res.status(403).json({
                    status: 'error',
                    message: `Technician does not have access to the '${ticket.category}' category.`
                });
            }
        }

        // Reassign the ticket
        const updatedTicket = await Ticket.update(parseInt(id), {
            assigned_to: technician_id
        });

        // Log reassignment activity
        const reassignerName = req.user ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'System' : 'System';
        try {
            await TicketHistory.log(
                parseInt(id),
                req.user ? req.user.id : null,
                'ticket_reassigned',
                'assigned_to',
                previousAssignee ? previousAssignee.id.toString() : 'unassigned',
                technician_id.toString(),
                note || null,
                {
                    action: 'reassign',
                    previous_assignee_name: previousAssignee ? previousAssignee.name : null,
                    assigned_to_name: techName,
                    assigned_by_name: reassignerName,
                    ticket_number: ticket.ticket_number
                }
            );
        } catch (histErr) {
            console.error('Failed to log reassignment history:', histErr.message);
        }

        // Auto-deny pending assignment requests for this ticket
        const io = req.app.get('io');
        await autoDenyPendingRequests(
            parseInt(id),
            req.user ? req.user.id : null,
            'Ticket was reassigned to another technician',
            io
        );

        // Send assignment notification to new technician
        if (technician.email_notifications) {
            try {
                const requesterResult = await pool.query(
                    'SELECT first_name, last_name FROM users WHERE id = $1',
                    [ticket.customer_id]
                );
                const requesterName = requesterResult.rows[0]
                    ? `${requesterResult.rows[0].first_name} ${requesterResult.rows[0].last_name}`
                    : 'Unknown';
                await sendTicketAssignment(technician.email, techName, updatedTicket, requesterName, technician_id);
            } catch (emailError) {
                console.error('Failed to send reassignment notification:', emailError.message);
            }
        }

        // Create in-app notification for the reassigned technician
        try {
            const notification = await Notification.create({
                user_id: technician_id,
                type: 'assignment',
                message: `Ticket #${ticket.ticket_number} has been reassigned to you: ${ticket.subject}`,
                ticket_id: parseInt(id)
            });

            // Emit real-time notification via WebSocket
            if (io) {
                emitNotificationToUser(io, technician_id, notification);
                const unreadCount = await Notification.getUnreadCount(technician_id);
                emitUnreadCountToUser(io, technician_id, unreadCount);
            }
        } catch (notifError) {
            console.error('Failed to create in-app notification:', notifError.message);
        }

        res.status(200).json({
            status: 'success',
            message: `Ticket #${id} reassigned to ${techName}`,
            data: updatedTicket,
            reassignment: {
                previous_assignee: previousAssignee,
                new_assignee: { id: technician.id, name: techName },
                note: note || null,
                reassigned_by: req.user ? req.user.id : null
            }
        });

    } catch (error) {
        console.error('Reassign ticket error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to reassign ticket', error: error.message });
    }
};

/**
 * Get ticket history / activity log
 * GET /api/tickets/:id/history
 */
export const getTicketHistory = async (req, res) => {
    try {
        const { id } = req.params;

        if (isNaN(id)) {
            return res.status(400).json({ status: 'error', message: 'Invalid ticket ID' });
        }

        // Verify ticket exists
        const ticket = await Ticket.getById(parseInt(id));
        if (!ticket) {
            return res.status(404).json({ status: 'error', message: 'Ticket not found' });
        }

        const history = await TicketHistory.getByTicketId(parseInt(id));

        res.status(200).json({
            status: 'success',
            count: history.length,
            data: history
        });

    } catch (error) {
        console.error('Get ticket history error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to get ticket history', error: error.message });
    }
};

/**
 * Update ticket status
 * PATCH /api/tickets/:id/status
 */
export const updateTicketStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Validate ticket ID
        if (isNaN(id)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid ticket ID'
            });
        }

        // Validate status is provided
        if (!status) {
            return res.status(400).json({
                status: 'error',
                message: 'Status is required'
            });
        }

        // Validate status is a valid value
        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).json({
                status: 'error',
                message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
                validStatuses: VALID_STATUSES
            });
        }

        // Check if ticket exists
        const existingTicket = await Ticket.getById(parseInt(id));
        if (!existingTicket) {
            return res.status(404).json({
                status: 'error',
                message: 'Ticket not found'
            });
        }

        // Check if status is actually changing
        if (existingTicket.status === status) {
            return res.status(400).json({
                status: 'error',
                message: `Ticket is already in '${status}' status`
            });
        }

        // Validate status transition
        const currentStatus = existingTicket.status;
        const allowedTransitions = VALID_TRANSITIONS[currentStatus];
        
        if (!allowedTransitions.includes(status)) {
            return res.status(400).json({
                status: 'error',
                message: `Invalid status transition from '${currentStatus}' to '${status}'`,
                currentStatus: currentStatus,
                requestedStatus: status,
                allowedTransitions: allowedTransitions
            });
        }

        // Prepare update data
        const updateData = { status };

        // Handle resolved_at timestamp based on status
        if (status === 'resolved' || status === 'closed') {
            // Set resolved_at when moving to resolved/closed
            updateData.resolved_at = new Date();
        } else if (existingTicket.status === 'resolved' || existingTicket.status === 'closed') {
            // Clear resolved_at when moving away from resolved/closed
            updateData.resolved_at = null;
        }

        // Update the ticket status
        const updatedTicket = await Ticket.update(parseInt(id), updateData);

        // Send status change notification email if user has notifications enabled
        try {
            const customerResult = await pool.query(
                'SELECT email, first_name, email_notifications FROM users WHERE id = $1',
                [updatedTicket.customer_id]
            );
            
            if (customerResult.rows[0] && customerResult.rows[0].email_notifications) {
                await sendTicketStatusUpdate(
                    customerResult.rows[0].email,
                    customerResult.rows[0].first_name,
                    updatedTicket,
                    existingTicket.status,
                    status,
                    updatedTicket.customer_id
                );
                console.log(`✅ Status update email sent to ${customerResult.rows[0].email}`);
            }
        } catch (emailError) {
            // Log email error but don't fail the status update
            console.error('Failed to send status update email:', emailError.message);
        }

        res.status(200).json({
            status: 'success',
            message: 'Ticket status updated successfully',
            data: updatedTicket,
            previousStatus: existingTicket.status,
            newStatus: status
        });

    } catch (error) {
        console.error('Update ticket status error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update ticket status',
            error: error.message
        });
    }
};

/**
 * Get available (unassigned) tickets for a technician
 * Only returns tickets in categories the technician has access to
 * GET /api/tickets/available
 */
export const getAvailableTickets = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                status: 'error',
                message: 'Authentication required'
            });
        }

        if (!isTechnician(req.user.role) && req.user.role !== 'admin') {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied. Only technicians and admins can view available tickets.'
            });
        }

        let categoryFilter = '';
        let queryParams = [];

        if (req.user.role !== 'admin') {
            // Check if technician has CAN_VIEW_ALL_TICKETS privilege
            const canViewAll = await UserPrivilege.hasPrivilege(req.user.id, 'CAN_VIEW_ALL_TICKETS');

            if (!canViewAll) {
                // Get accessible categories for this technician
                const accessibleCategories = await CategoryAccess.getUserAccessibleCategories(req.user.id, 'view');

                if (accessibleCategories.length === 0) {
                    return res.status(200).json({
                        status: 'success',
                        count: 0,
                        data: [],
                        message: 'No category access. Contact administrator.'
                    });
                }

                // Get category names from IDs
                const categoryQuery = `SELECT name FROM categories WHERE id = ANY($1::int[])`;
                const categoryResult = await pool.query(categoryQuery, [accessibleCategories]);
                const categoryNames = categoryResult.rows.map(row => row.name);

                categoryFilter = `AND t.category = ANY($1::ticket_category[])`;
                queryParams = [categoryNames];
            }
        }

        const ticketsQuery = `
            SELECT t.*, 
                   c.first_name || ' ' || c.last_name as customer_name,
                   c.email as customer_email,
                   EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 86400 as age_days
            FROM tickets t
            LEFT JOIN users c ON t.customer_id = c.id
            WHERE t.assigned_to IS NULL
              AND t.status NOT IN ('closed', 'cancelled', 'resolved')
              ${categoryFilter}
            ORDER BY 
                CASE t.priority
                    WHEN 'critical' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'medium' THEN 3
                    WHEN 'low' THEN 4
                END,
                t.created_at ASC
        `;

        const result = await pool.query(ticketsQuery, queryParams);

        res.status(200).json({
            status: 'success',
            count: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        console.error('Get available tickets error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve available tickets',
            error: error.message
        });
    }
};

/**
 * Request assignment of a ticket to the current technician.
 * Creates a pending entry in ticket_assignment_requests for management review.
 * POST /api/tickets/:id/request-assignment
 */
export const requestTicketAssignment = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                status: 'error',
                message: 'Authentication required'
            });
        }

        if (!isTechnician(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied. Only technicians can request ticket assignments.'
            });
        }

        const { id } = req.params;
        const { note } = req.body;

        // Fetch the ticket
        const ticket = await Ticket.getById(id);
        if (!ticket) {
            return res.status(404).json({
                status: 'error',
                message: 'Ticket not found'
            });
        }

        // Ensure the ticket is unassigned
        if (ticket.assigned_to) {
            return res.status(409).json({
                status: 'error',
                message: 'This ticket is already assigned to another technician.'
            });
        }

        // Ensure the ticket is not closed/cancelled/resolved
        if (['closed', 'cancelled', 'resolved'].includes(ticket.status)) {
            return res.status(400).json({
                status: 'error',
                message: `Cannot request assignment for a ticket with status: ${ticket.status}`
            });
        }

        // Check if technician has access to this ticket's category
        const canViewAll = await UserPrivilege.hasPrivilege(req.user.id, 'CAN_VIEW_ALL_TICKETS');
        if (!canViewAll) {
            const categoryQuery = `SELECT id FROM categories WHERE name = $1`;
            const categoryResult = await pool.query(categoryQuery, [ticket.category]);

            if (categoryResult.rows.length > 0) {
                const categoryId = categoryResult.rows[0].id;
                const hasAccess = await CategoryAccess.hasAccess(req.user.id, categoryId, 'view');
                if (!hasAccess) {
                    return res.status(403).json({
                        status: 'error',
                        message: 'You do not have access to tickets in this category.'
                    });
                }
            }
        }

        // Check for an existing pending request from this technician for this ticket
        const existingCheck = await pool.query(
            `SELECT id FROM ticket_assignment_requests
             WHERE ticket_id = $1 AND requested_by = $2 AND status = 'pending'`,
            [id, req.user.id]
        );
        if (existingCheck.rows.length > 0) {
            return res.status(409).json({
                status: 'error',
                message: 'You already have a pending request for this ticket.'
            });
        }

        // Insert a pending assignment request
        const insertQuery = `
            INSERT INTO ticket_assignment_requests (ticket_id, requested_by, note, status)
            VALUES ($1, $2, $3, 'pending')
            RETURNING *
        `;
        const result = await pool.query(insertQuery, [id, req.user.id, note || null]);
        const request = result.rows[0];

        // Record in ticket history
        await TicketHistory.log(
            id,
            req.user.id,
            'assignment_requested',
            'assigned_to',
            null,
            req.user.id.toString(),
            note || 'Technician requested assignment (pending approval)',
            { assignment_type: 'request', request_id: request.id, technician_name: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() }
        );

        // Notify all management/admin users about the new request
        try {
            const techName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'A technician';
            const mgmtResult = await pool.query(
                `SELECT id FROM users WHERE role IN ('management', 'admin', 'senior_technician') AND id != $1`,
                [req.user.id]
            );
            const io = req.app.get('io');
            for (const mgr of mgmtResult.rows) {
                const notification = await Notification.create({
                    user_id: mgr.id,
                    type: 'assignment',
                    message: `${techName} requested assignment to ticket #${ticket.ticket_number || id}: ${ticket.subject}`,
                    ticket_id: parseInt(id)
                });
                if (io) {
                    emitNotificationToUser(io, mgr.id, notification);
                    const unreadCount = await Notification.getUnreadCount(mgr.id);
                    emitUnreadCountToUser(io, mgr.id, unreadCount);
                }
            }
        } catch (notifError) {
            console.error('Failed to send assignment request notifications:', notifError);
        }

        res.status(201).json({
            status: 'success',
            message: 'Assignment request submitted. Awaiting management approval.',
            data: request
        });

    } catch (error) {
        console.error('Request ticket assignment error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to request ticket assignment',
            error: error.message
        });
    }
};
