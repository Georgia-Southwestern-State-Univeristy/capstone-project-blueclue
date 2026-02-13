// src/controllers/ticketController.js
import Ticket from '../models/Ticket.js';
import AIClassification from '../models/AIClassification.js';
import { classifyTicketWithFallback } from '../services/aiService.js';
import pool from '../config/database.js';

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
 * Create a new ticket
 * POST /api/tickets
 */
export const createTicket = async (req, res) => {
    try {
        const { subject, description, customer_id, guest_email, guest_name, priority, category } = req.body;

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

        // Require either customer_id (authenticated) OR guest_email + guest_name
        if (!customer_id && (!guest_email || !guest_name)) {
            return res.status(400).json({
                status: 'error',
                message: 'Either customer_id or guest information (email and name) is required'
            });
        }

        // Handle guest users: find or create a guest customer record
        let finalCustomerId = customer_id;
        if (!customer_id && guest_email) {
            // Import User model for guest user lookup/creation
            const User = (await import('../models/User.js')).default;
            
            // Check if guest user already exists
            let guestUser = await User.getByEmail(guest_email);
            
            if (!guestUser) {
                // Create a new guest user record
                const nameParts = guest_name.trim().split(' ');
                const firstName = nameParts[0] || 'Guest';
                const lastName = nameParts.slice(1).join(' ') || 'User';
                
                const createUserQuery = `
                    INSERT INTO users (email, first_name, last_name, username, role, password_hash, is_active, is_guest)
                    VALUES ($1, $2, $3, $4, 'customer', '', true, true)
                    RETURNING id, email, first_name, last_name, role
                `;
                const username = `guest_${guest_email.split('@')[0]}_${Date.now()}`;
                const createResult = await pool.query(createUserQuery, [
                    guest_email,
                    firstName,
                    lastName,
                    username
                ]);
                guestUser = createResult.rows[0];
            }
            
            finalCustomerId = guestUser.id;
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
        
        // Final priority: user selection takes precedence, then AI, then default
        const finalPriority = userPriority || aiPriority || 'low';

        // Create ticket with AI classification metadata
        const ticket = await Ticket.create({
            subject: subject.trim(),
            description: description.trim(),
            customer_id: finalCustomerId,
            priority: finalPriority,
            user_priority: userPriority,
            ai_priority: aiPriority,
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
                final_priority: finalPriority
            }
        };

        // Include warning if AI service failed
        if (!aiResult.aiClassified && aiResult.error) {
            response.ai_classification.warning = `AI service unavailable: ${aiResult.error}`;
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
 * For technicians/admins: returns all tickets
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
        } else {
            // Return all tickets for technicians/admins or unauthenticated users
            tickets = await Ticket.getAll();
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
 * For technicians: returns only their assigned tickets
 * For other roles: returns all tickets
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
        if (req.user.role === 'technician') {
            // Get only tickets assigned to this technician
            tickets = await Ticket.getByTechnicianId(req.user.id);
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
