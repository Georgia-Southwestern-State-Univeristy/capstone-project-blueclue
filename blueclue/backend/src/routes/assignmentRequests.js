// src/routes/assignmentRequests.js
import express from 'express';
import {
    getPendingRequests,
    approveRequest,
    denyRequest
} from '../controllers/assignmentRequestController.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkRole } from '../middleware/rbac.js';

const router = express.Router();

// All routes require authentication + management-level role
const requireManager = [authenticateToken, checkRole('management', 'senior_technician', 'admin')];

/**
 * @route   GET /api/assignment-requests
 * @desc    Get assignment requests (filterable by status, defaults to pending)
 * @access  Private (management/senior_technician/admin)
 */
router.get('/', ...requireManager, getPendingRequests);

/**
 * @route   PATCH /api/assignment-requests/:id/approve
 * @desc    Approve an assignment request and assign the ticket
 * @access  Private (management/senior_technician/admin)
 */
router.patch('/:id/approve', ...requireManager, approveRequest);

/**
 * @route   PATCH /api/assignment-requests/:id/deny
 * @desc    Deny an assignment request with optional reason
 * @access  Private (management/senior_technician/admin)
 */
router.patch('/:id/deny', ...requireManager, denyRequest);

export default router;
