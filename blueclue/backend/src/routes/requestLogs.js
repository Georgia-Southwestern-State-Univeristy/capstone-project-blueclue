// src/routes/requestLogs.js
/**
 * Request Logs Analytics Routes
 * ==============================
 * Admin and management endpoints for API performance monitoring.
 * 
 * All routes require:
 * - Authentication (valid JWT)
 * - Admin or Management role
 */

import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
    getSlowestEndpoints,
    getMostCalledEndpoints,
    getErrorAnalysis,
    getPerformanceSummary,
    refreshAnalytics,
    getEndpointDetails
} from '../controllers/requestLogsController.js';

const router = express.Router();

// Apply authentication and admin/management role to all routes
router.use(authenticateToken);
router.use(requireRole(['admin', 'management']));

/**
 * GET /api/admin/analytics/requests/slowest
 * Get top 10 slowest endpoints
 * Query params:
 *   - days: Number of days to analyze (default: 7)
 */
router.get('/slowest', getSlowestEndpoints);

/**
 * GET /api/admin/analytics/requests/most-called
 * Get top 10 most frequently called endpoints
 * Query params:
 *   - days: Number of days to analyze (default: 7)
 */
router.get('/most-called', getMostCalledEndpoints);

/**
 * GET /api/admin/analytics/requests/errors
 * Get error analysis (endpoints with highest error rates)
 * Query params:
 *   - days: Number of days to analyze (default: 7)
 */
router.get('/errors', getErrorAnalysis);

/**
 * GET /api/admin/analytics/requests/summary
 * Get overall performance summary with time series data
 * Query params:
 *   - days: Number of days to analyze (default: 7)
 */
router.get('/summary', getPerformanceSummary);

/**
 * GET /api/admin/analytics/requests/endpoint
 * Get detailed logs for a specific endpoint
 * Query params:
 *   - base_route: The base route pattern (e.g., /api/tickets/:id) [REQUIRED]
 *   - days: Number of days to analyze (default: 7)
 *   - limit: Maximum number of logs to return (default: 100)
 */
router.get('/endpoint', getEndpointDetails);

/**
 * POST /api/admin/analytics/requests/refresh
 * Manually refresh the materialized view analytics
 * Should be called after significant activity or before viewing dashboard
 */
router.post('/refresh', refreshAnalytics);

export default router;
