// src/routes/ring.js
import express from 'express';
import {
  sendRingRequest,
  getIncomingRingRequests,
  respondToRingRequest,
  getRingMetrics,
  getTicketRingHistory
} from '../controllers/ringController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   GET /api/ring-requests
 * @desc    Get incoming ring requests for the logged-in technician
 * @access  Private (technician only)
 */
router.get('/ring-requests', authenticateToken, getIncomingRingRequests);

/**
 * @route   POST /api/ring-requests/:id/respond
 * @desc    Respond to a ring request (accept or decline)
 * @access  Private (target technician only)
 */
router.post('/ring-requests/:id/respond', authenticateToken, respondToRingRequest);

/**
 * @route   GET /api/ring-requests/metrics
 * @desc    Get ring request metrics for the logged-in technician
 * @access  Private (technician only)
 */
router.get('/ring-requests/metrics', authenticateToken, getRingMetrics);

/**
 * @route   POST /api/tickets/:id/ring
 * @desc    Send a ring request to another technician for help
 * @access  Private (assigned technician/collaborator only)
 */
router.post('/tickets/:id/ring', authenticateToken, sendRingRequest);

/**
 * @route   GET /api/tickets/:id/ring-history
 * @desc    Get ring request history for a ticket
 * @access  Private (authenticated users)
 */
router.get('/tickets/:id/ring-history', authenticateToken, getTicketRingHistory);

export default router;
