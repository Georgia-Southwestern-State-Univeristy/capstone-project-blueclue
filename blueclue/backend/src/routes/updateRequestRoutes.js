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

// All routes require authentication
router.use(authenticateToken);

// Request update on a specific ticket (management only)
router.post('/tickets/:id/request-update', requestUpdate);

// Get update requests (filtered by user role)
router.get('/update-requests', getUpdateRequests);

// Fulfill an update request
router.post('/update-requests/:id/fulfill', fulfillUpdateRequest);

// Request deadline extension
router.post('/update-requests/:id/request-extension', requestExtension);

// Cancel an update request
router.delete('/update-requests/:id', cancelUpdateRequest);

// Get technician statistics
router.get('/update-requests/stats/:techId', getTechStats);

// Get response time analytics (management only)
router.get('/update-requests/analytics/response-times', getResponseTimeAnalytics);

export default router;
