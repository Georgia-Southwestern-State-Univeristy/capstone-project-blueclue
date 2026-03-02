import express from 'express';
import {
  requestUpdate,
  getUpdateRequests,
  fulfillUpdateRequest,
  requestExtension,
  cancelUpdateRequest,
  getTechStats,
  getResponseTimeAnalytics
} from '../controllers/updateRequestController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Request update on a specific ticket (management only)
router.post('/tickets/:id/request-update', authenticateToken, requestUpdate);

// Get update requests (filtered by user role)
router.get('/update-requests', authenticateToken, getUpdateRequests);

// Fulfill an update request
router.post('/update-requests/:id/fulfill', authenticateToken, fulfillUpdateRequest);

// Request deadline extension
router.post('/update-requests/:id/request-extension', authenticateToken, requestExtension);

// Cancel an update request
router.delete('/update-requests/:id', authenticateToken, cancelUpdateRequest);

// Get technician statistics
router.get('/update-requests/stats/:techId', authenticateToken, getTechStats);

// Get response time analytics (management only)
router.get('/update-requests/analytics/response-times', authenticateToken, getResponseTimeAnalytics);

export default router;
