// src/routes/tickets.js
import express from 'express';
import {
    createTicket,
    getAllTickets,
    getMyAssignedTickets,
    getAvailableTickets,
    requestTicketAssignment,
    getTicketById,
    updateTicket,
    deleteTicket,
    restoreTicket,
    getDeletedTickets,
    updateTicketStatus,
    bulkAssignTickets,
    assignTicket,
    reassignTicket,
    getTicketHistory,
    cancelTicket,
    reopenTicket
} from '../controllers/ticketController.js';
import {
    addCollaborator,
    removeCollaborator,
    transferPrimary,
    getCollaborators,
    getTechnicianWorkload
} from '../controllers/collaboratorController.js';
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
 * @route   GET /api/tickets/available
 * @desc    Get unassigned tickets in the technician's accessible categories
 * @access  Private (technician/admin only)
 */
router.get('/available', authenticateToken, getAvailableTickets);

/**
 * @route   POST /api/tickets/bulk-assign
 * @desc    Bulk assign tickets to a technician
 * @access  Private (management/admin only)
 */
router.post('/bulk-assign', authenticateToken, bulkAssignTickets);

/**
 * @route   GET /api/tickets/activity
 * @desc    Get recent assignment activity across all tickets
 * @access  Private (authenticated users)
 */
router.get('/activity', authenticateToken, async (req, res) => {
    try {
        const TicketHistory = (await import('../models/TicketHistory.js')).default;
        const limit = parseInt(req.query.limit) || 50;
        const activity = await TicketHistory.getRecentActivity(limit);

        res.status(200).json({
            status: 'success',
            count: activity.length,
            data: activity
        });
    } catch (error) {
        console.error('Get assignment activity error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve assignment activity',
            error: error.message
        });
    }
});

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
 * @route   GET /api/tickets/deleted
 * @desc    Get all soft-deleted tickets (management/admin only)
 * @access  Private (requires CAN_DELETE_TICKETS privilege or admin)
 */
router.get('/deleted', authenticateToken, checkPrivilege('CAN_DELETE_TICKETS'), getDeletedTickets);

/**
 * @route   GET /api/tickets/:id
 * @desc    Get a single ticket by ID
 * @access  Private (authenticated, respects category access)
 */
router.get('/:id', optionalAuth, getTicketById);

/**
 * @route   GET /api/tickets/:id/collaborators
 * @desc    Get all collaborators for a ticket
 * @access  Private (authenticated users)
 */
router.get('/:id/collaborators', authenticateToken, getCollaborators);

/**
 * @route   POST /api/tickets/:id/collaborators
 * @desc    Add a collaborator to a ticket
 * @access  Private (primary technician or management)
 */
router.post('/:id/collaborators', authenticateToken, addCollaborator);

/**
 * @route   DELETE /api/tickets/:id/collaborators/:userId
 * @desc    Remove a collaborator from a ticket
 * @access  Private (primary technician or management)
 */
router.delete('/:id/collaborators/:userId', authenticateToken, removeCollaborator);

/**
 * @route   PATCH /api/tickets/:id/transfer
 * @desc    Transfer primary assignment to another technician
 * @access  Private (current primary or management)
 */
router.patch('/:id/transfer', authenticateToken, transferPrimary);

/**
 * @route   POST /api/tickets/:id/request-assignment
 * @desc    Technician requests assignment to an unassigned ticket
 * @access  Private (technician only)
 */
router.post('/:id/request-assignment', authenticateToken, requestTicketAssignment);

/**
 * @route   GET /api/tickets/:id/history
 * @desc    Get ticket activity history / audit log
 * @access  Private (authenticated)
 */
router.get('/:id/history', authenticateToken, getTicketHistory);

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
 * @route   PATCH /api/tickets/:id/cancel
 * @desc    Cancel a ticket (customer can cancel their own open/pending tickets; staff can cancel any active ticket)
 * @access  Private (ticket owner or staff)
 */
router.patch('/:id/cancel', authenticateToken, cancelTicket);
 * @route   POST /api/tickets/:id/reopen
 * @desc    Reopen a closed or cancelled ticket (within 30 days)
 * @access  Private (ticket requester or management only)
 */
router.post('/:id/reopen', authenticateToken, reopenTicket);

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

/**
 * @route   PATCH /api/tickets/:id/restore
 * @desc    Restore a soft-deleted ticket
 * @access  Private (requires CAN_DELETE_TICKETS privilege or admin)
 */
router.patch('/:id/restore', authenticateToken, checkPrivilege('CAN_DELETE_TICKETS'), restoreTicket);

export default router;
