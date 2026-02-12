// src/routes/tickets.js
import express from 'express';
import {
    createTicket,
    getAllTickets,
    getMyAssignedTickets,
    getTicketById,
    updateTicket,
    deleteTicket,
    updateTicketStatus
} from '../controllers/ticketController.js';
import { optionalAuth, authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   GET /api/tickets
 * @desc    Get all tickets (filtered by customer_id for customers/guests)
 * @access  Public (optionalAuth - filters based on user role)
 */
router.get('/', optionalAuth, getAllTickets);

/**
 * @route   GET /api/tickets/assigned/me
 * @desc    Get tickets assigned to the logged-in technician
 * @access  Private (technician/admin only)
 */
router.get('/assigned/me', authenticateToken, getMyAssignedTickets);

/**
 * @route   GET /api/tickets/timeline
 * @desc    Get all tickets for timeline display (no filtering)
 * @access  Public
 */
router.get('/timeline', async (req, res) => {
    try {
        const Ticket = (await import('../models/Ticket.js')).default;
        const tickets = await Ticket.getAll();
        
        res.status(200).json({
            status: 'success',
            count: tickets.length,
            data: tickets
        });
    } catch (error) {
        console.error('Get timeline tickets error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve timeline tickets',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/tickets/:id
 * @desc    Get a single ticket by ID
 * @access  Public
 */
router.get('/:id', getTicketById);

/**
 * @route   POST /api/tickets
 * @desc    Create a new ticket
 * @access  Public
 */
router.post('/', createTicket);

/**
 * @route   PATCH /api/tickets/:id/status
 * @desc    Update a ticket's status
 * @access  Public
 */
router.patch('/:id/status', updateTicketStatus);

/**
 * @route   PUT /api/tickets/:id
 * @desc    Update a ticket
 * @access  Public
 */
router.put('/:id', updateTicket);

/**
 * @route   DELETE /api/tickets/:id
 * @desc    Delete a ticket (soft delete)
 * @access  Public
 */
router.delete('/:id', deleteTicket);

export default router;
