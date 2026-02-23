// src/routes/tickets.js
import express from 'express';
import {
    createTicket,
    getAllTickets,
    getMyAssignedTickets,
    getTicketById,
    updateTicket,
    deleteTicket,
    updateTicketStatus,
    bulkAssignTickets,
    assignTicket,
    reassignTicket
} from '../controllers/ticketController.js';
import { optionalAuth, authenticateToken } from '../middleware/auth.js';
import { checkPrivilege } from '../middleware/rbac.js';

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
 * @route   POST /api/tickets/bulk-assign
 * @desc    Bulk assign tickets to a technician
 * @access  Private (management/admin only)
 */
router.post('/bulk-assign', authenticateToken, bulkAssignTickets);

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
 * @access  Private (authenticated, respects category access)
 */
router.get('/:id', optionalAuth, getTicketById);

/**
 * @route   POST /api/tickets
 * @desc    Create a new ticket
 * @access  Public (allows guest submission)
 */
router.post('/', createTicket);

/**
 * @route   POST /api/tickets/:id/assign
 * @desc    Assign a single ticket to a technician
 * @access  Private (management/admin or CAN_ASSIGN_TICKETS)
 */
router.post('/:id/assign', authenticateToken, assignTicket);

/**
 * @route   PATCH /api/tickets/:id/reassign
 * @desc    Reassign an already-assigned ticket to a different technician
 * @access  Private (management/admin or CAN_ASSIGN_TICKETS)
 */
router.patch('/:id/reassign', authenticateToken, reassignTicket);

/**
 * @route   PATCH /api/tickets/:id/status
 * @desc    Update a ticket's status
 * @access  Private (authenticated users, respects category access)
 */
router.patch('/:id/status', authenticateToken, updateTicketStatus);

/**
 * @route   PUT /api/tickets/:id
 * @desc    Update a ticket
 * @access  Private (authenticated users, respects category access and assignment privileges)
 */
router.put('/:id', authenticateToken, updateTicket);

/**
 * @route   DELETE /api/tickets/:id
 * @desc    Delete a ticket (soft delete)
 * @access  Private (requires CAN_DELETE_TICKETS privilege or admin)
 */
router.delete('/:id', authenticateToken, checkPrivilege('CAN_DELETE_TICKETS'), deleteTicket);

export default router;
