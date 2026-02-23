// src/routes/analytics.js
import express from 'express';
import { 
    getAIPriorityAnalytics, 
    getAIPerformanceMetrics,
    getCategoryInsights 
} from '../controllers/analyticsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All analytics routes require authentication
router.use(authenticateToken);

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

export default router;
