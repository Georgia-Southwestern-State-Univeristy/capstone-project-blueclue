// src/controllers/ticketController.js
import Ticket from '../models/Ticket.js';

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

        if (!customer_id) {
            return res.status(400).json({
                status: 'error',
                message: 'customer_id (user ID) is required'
            });
        }

        // Create ticket
        const ticket = await Ticket.create({
            subject: subject.trim(),
            description: description.trim(),
            customer_id,
            priority: priority || 'low',
            category: category || 'general'
        });

        res.status(201).json({
            status: 'success',
            message: 'Ticket created successfully',
            data: ticket
        });

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
 */
export const getAllTickets = async (req, res) => {
    try {
        const tickets = await Ticket.getAll();

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
