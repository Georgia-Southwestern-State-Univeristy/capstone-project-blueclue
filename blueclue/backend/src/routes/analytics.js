// src/routes/analytics.js
import express from 'express';
import { 
    getAIPriorityAnalytics, 
    getAIPerformanceMetrics,
    getCategoryInsights,
    getAssignmentStats,
    getCategoryBreakdown,
    getOverdueTickets,
    getTechWorkload,
    getEscalations,
    getTodaysActions,
    getTopRequesters,
    getTechPerformance,
    getReopenAnalytics
} from '../controllers/analyticsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All analytics routes require authentication
router.use(authenticateToken);

// --- Existing AI analytics ---

/**
 * @route   GET /api/analytics/ai-priority
 * @desc    Get AI priority analytics overview
 * @access  Management, Admin
 */
router.get('/ai-priority', getAIPriorityAnalytics);

/**
 * @route   GET /api/analytics/ai-performance
 * @desc    Get AI performance metrics with optional filters
 * @access  Management, Admin
 * @query   category, startDate, endDate
 */
router.get('/ai-performance', getAIPerformanceMetrics);

/**
 * @route   GET /api/analytics/category-insights
 * @desc    Get category-specific AI insights
 * @access  Management, Admin
 */
router.get('/category-insights', getCategoryInsights);

// --- Dashboard widget endpoints (Issue #95) ---

/**
 * @route   GET /api/analytics/assignment-stats
 * @desc    Assigned vs unassigned ticket counts and percentages
 * @access  Management, Admin
 */
router.get('/assignment-stats', getAssignmentStats);

/**
 * @route   GET /api/analytics/category-breakdown
 * @desc    Tickets broken down by category with color codes
 * @access  Management, Admin
 */
router.get('/category-breakdown', getCategoryBreakdown);

/**
 * @route   GET /api/analytics/overdue-tickets
 * @desc    List of overdue tickets with days overdue and alert level
 * @access  Management, Admin
 */
router.get('/overdue-tickets', getOverdueTickets);

/**
 * @route   GET /api/analytics/tech-workload
 * @desc    Per-technician workload heatmap data
 * @access  Management, Admin
 */
router.get('/tech-workload', getTechWorkload);

/**
 * @route   GET /api/analytics/escalations
 * @desc    Critical/high-priority tickets needing attention
 * @access  Management, Admin
 */
router.get('/escalations', getEscalations);

/**
 * @route   GET /api/analytics/todays-actions
 * @desc    Combined view of today's priority items
 * @access  Management, Admin
 */
router.get('/todays-actions', getTodaysActions);

/**
 * @route   GET /api/analytics/top-requesters
 * @desc    Top 10 users by ticket volume
 * @access  Management, Admin
 * @query   timeRange (7d | 30d | 90d | all)
 */
router.get('/top-requesters', getTopRequesters);

/**
 * @route   GET /api/analytics/tech-performance
 * @desc    Per-technician performance metrics table
 * @access  Management, Admin
 */
router.get('/tech-performance', getTechPerformance);

/**
 * @route   GET /api/analytics/reopens
 * @desc    Ticket reopen analytics and metrics
 * @access  Management, Admin
 * @query   days (default: 30) - Number of days to analyze
 */
router.get('/reopens', getReopenAnalytics);

export default router;
