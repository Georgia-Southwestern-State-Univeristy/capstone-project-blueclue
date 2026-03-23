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
    getCancellationStats,
    getReopenAnalytics,
    getCollaborationAnalytics,
    // New comprehensive dashboard endpoints
    getResolutionTime,
    getTicketVolume,
    getTechPerformanceDashboard,
    getCategoriesDashboard,
    getSLAComplianceDashboard,
    getAdditionalMetricsDashboard,
    getDashboardSummary,
    exportAnalytics,
    clearCache,
    getTicketsByFilter,
    getTicketTrend
} from '../controllers/analyticsController.js';
import { getTemplateAnalytics } from '../controllers/templateController.js';
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
 * @route   GET /api/analytics/cancellation-stats
 * @desc    Cancellation metrics: count, rate, trends, reasons, by category
 * @access  Management, Admin
 * @query   timeRange (7d | 30d | 90d | all)
 */
router.get('/cancellation-stats', getCancellationStats);

/**
 * @route   GET /api/analytics/reopens
 * @desc    Ticket reopen analytics and metrics
 * @access  Management, Admin
 * @query   days (default: 30) - Number of days to analyze
 */
router.get('/reopens', getReopenAnalytics);

/**
 * @route   GET /api/analytics/collaboration
 * @desc    Multi-technician collaboration analytics
 * @access  Management, Admin
 * @query   days (default: 30) - Number of days to analyze
 */
router.get('/collaboration', getCollaborationAnalytics);

// ============================================================================
// Comprehensive Analytics Dashboard Endpoints
// ============================================================================

/**
 * @route   GET /api/analytics/resolution-time
 * @desc    Get resolution time metrics with trends and breakdowns
 * @access  Technicians (own data), Management, Admin (all data)
 * @query   startDate, endDate, preset (today|week|month|quarter|year), category, techId
 */
router.get('/resolution-time', getResolutionTime);

/**
 * @route   GET /api/analytics/ticket-volume
 * @desc    Get ticket volume metrics with heatmap and trends
 * @access  Technicians (own data), Management, Admin (all data)
 * @query   startDate, endDate, preset, category
 */
router.get('/ticket-volume', getTicketVolume);

/**
 * @route   GET /api/analytics/tech-performance-dashboard
 * @desc    Get comprehensive technician performance with leaderboard
 * @access  Technicians (own data), Management, Admin (all data)
 * @query   startDate, endDate, preset, techId
 */
router.get('/tech-performance-dashboard', getTechPerformanceDashboard);

/**
 * @route   GET /api/analytics/categories-dashboard
 * @desc    Get issue category analysis with trends
 * @access  Management, Admin only
 * @query   startDate, endDate, preset
 */
router.get('/categories-dashboard', getCategoriesDashboard);

/**
 * @route   GET /api/analytics/sla-compliance
 * @desc    Get SLA compliance metrics and current breaches
 * @access  Management, Admin only
 * @query   startDate, endDate, preset, category
 */
router.get('/sla-compliance', getSLAComplianceDashboard);

/**
 * @route   GET /api/analytics/additional-metrics
 * @desc    Get additional metrics (reopen rate, cancellation, comments, etc.)
 * @access  Technicians, Management, Admin
 * @query   startDate, endDate, preset
 */
router.get('/additional-metrics', getAdditionalMetricsDashboard);

/**
 * @route   GET /api/analytics/dashboard-summary
 * @desc    Get complete dashboard summary with all metrics
 * @access  Technicians (limited), Management, Admin
 * @query   startDate, endDate, preset
 */
router.get('/dashboard-summary', getDashboardSummary);

/**
 * @route   GET /api/analytics/export
 * @desc    Export analytics data in CSV or JSON format
 * @access  Management, Admin only
 * @query   format (csv|json), type (summary|resolution-time|ticket-volume|tech-performance|categories|sla), startDate, endDate, preset
 */
router.get('/export', exportAnalytics);

/**
 * @route   POST /api/analytics/cache/clear
 * @desc    Clear analytics cache
 * @access  Management, Admin only
 */
router.post('/cache/clear', clearCache);

/**
 * @route   GET /api/analytics/tickets-by-filter
 * @desc    Get paginated list of tickets matching filters (for drill-down)
 * @access  Technicians (own data), Management, Admin (all data)
 * @query   startDate, endDate, preset, category, priority, status, techId, slaBreach, page, limit
 */
router.get('/tickets-by-filter', getTicketsByFilter);

/**
 * @route   GET /api/analytics/ticket-trend
 * @desc    Opened vs resolved tickets over time for trend chart
 * @access  Staff (technicians, management, admin)
 * @query   range (7d | 30d | 90d | 6m | 1y)
 */
router.get('/ticket-trend', getTicketTrend);

/**
 * @route   GET /api/analytics/template-usage
 * @desc    Get template usage analytics and effectiveness metrics
 * @access  Management, Admin only
 */
router.get('/template-usage', getTemplateAnalytics);

export default router;
