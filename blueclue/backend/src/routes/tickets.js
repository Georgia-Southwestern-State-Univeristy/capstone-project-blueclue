// src/routes/tickets.js
import express from 'express';
import {
    createTicket,
    getAllTickets,
    getTicketById,
    updateTicket,
    deleteTicket
} from '../controllers/ticketController.js';

const router = express.Router();

/**
 * @route   GET /api/tickets
 * @desc    Get all tickets
 * @access  Public
 */
router.get('/', getAllTickets);

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
