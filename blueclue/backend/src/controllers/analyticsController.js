// src/controllers/analyticsController.js
import pool from '../config/database.js';
import PriorityOverride from '../models/PriorityOverride.js';

/**
 * Get AI priority analytics overview
 * GET /api/analytics/ai-priority
 */
export const getAIPriorityAnalytics = async (req, res) => {
    try {
        // Get basic override statistics
        const overrideStats = await PriorityOverride.getStatistics();

        // Get analytics by confidence level
        const analyticsData = await PriorityOverride.getAnalytics();

        // Get AI accuracy by category
        const accuracyQuery = `
            SELECT * FROM v_ai_priority_accuracy
            WHERE ticket_count >= 5
            ORDER BY category, avg_resolution_hours
        `;
        const accuracyResult = await pool.query(accuracyQuery);

        // Get user override frequency
        const userOverrides = await PriorityOverride.getUserOverrideFrequency(20);

        // Calculate overall AI acceptance rate
        const acceptanceRate = overrideStats.total_overrides > 0
            ? (overrideStats.ai_accepted / overrideStats.total_overrides * 100).toFixed(2)
            : 0;

        // Get trend data (last 30 days)
        const trendQuery = `
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as override_count,
                AVG(ai_confidence) as avg_confidence,
                COUNT(CASE WHEN final_priority = ai_recommended_priority THEN 1 END) as ai_accepted_count,
                COUNT(CASE WHEN final_priority = user_priority THEN 1 END) as user_accepted_count
            FROM priority_overrides
            WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `;
        const trendResult = await pool.query(trendQuery);

        res.json({
            status: 'success',
            data: {
                overview: {
                    ...overrideStats,
                    acceptance_rate: parseFloat(acceptanceRate)
                },
                by_confidence: analyticsData,
                accuracy_by_category: accuracyResult.rows,
                user_overrides: userOverrides,
                trend_30_days: trendResult.rows
            }
        });

    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve analytics',
            error: error.message
        });
    }
};

/**
 * Get AI performance metrics
 * GET /api/analytics/ai-performance
 */
export const getAIPerformanceMetrics = async (req, res) => {
    try {
        const { category, startDate, endDate } = req.query;

        let whereClause = `WHERE ai_classified = true AND status IN ('resolved', 'closed')`;
        const params = [];
        let paramCounter = 1;

        if (category) {
            whereClause += ` AND category = $${paramCounter}`;
            params.push(category);
            paramCounter++;
        }

        if (startDate) {
            whereClause += ` AND created_at >= $${paramCounter}`;
            params.push(startDate);
            paramCounter++;
        }

        if (endDate) {
            whereClause += ` AND created_at <= $${paramCounter}`;
            params.push(endDate);
            paramCounter++;
        }

        // Calculate accuracy metrics
        const accuracyQuery = `
            SELECT 
                COUNT(*) as total_tickets,
                AVG(ai_confidence) as avg_confidence,
                AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as avg_resolution_hours,
                COUNT(CASE WHEN priority_overridden THEN 1 END) as overridden_count,
                COUNT(CASE WHEN ai_confidence >= 0.8 THEN 1 END) as high_confidence_count,
                COUNT(CASE WHEN ai_confidence >= 0.5 AND ai_confidence < 0.8 THEN 1 END) as medium_confidence_count,
                COUNT(CASE WHEN ai_confidence < 0.5 THEN 1 END) as low_confidence_count,
                
                -- Priority accuracy
                COUNT(CASE WHEN ai_recommended_priority = priority THEN 1 END) as priority_match_count,
                
                -- Resolution time by confidence
                AVG(CASE 
                    WHEN ai_confidence >= 0.8 
                    THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600 
                END) as avg_resolution_high_confidence,
                AVG(CASE 
                    WHEN ai_confidence < 0.8 
                    THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600 
                END) as avg_resolution_lower_confidence
                
            FROM tickets
            ${whereClause}
        `;

        const result = await pool.query(accuracyQuery, params);
        const metrics = result.rows[0];

        // Calculate derived metrics
        const priorityAccuracy = metrics.total_tickets > 0
            ? (metrics.priority_match_count / metrics.total_tickets * 100).toFixed(2)
            : 0;

        const overrideRate = metrics.total_tickets > 0
            ? (metrics.overridden_count / metrics.total_tickets * 100).toFixed(2)
            : 0;

        res.json({
            status: 'success',
            data: {
                ...metrics,
                priority_accuracy_percentage: parseFloat(priorityAccuracy),
                override_rate_percentage: parseFloat(overrideRate),
                total_tickets: parseInt(metrics.total_tickets),
                avg_confidence: parseFloat(metrics.avg_confidence?.toFixed(2) || 0),
                avg_resolution_hours: parseFloat(metrics.avg_resolution_hours?.toFixed(2) || 0),
                avg_resolution_high_confidence: parseFloat(metrics.avg_resolution_high_confidence?.toFixed(2) || 0),
                avg_resolution_lower_confidence: parseFloat(metrics.avg_resolution_lower_confidence?.toFixed(2) || 0)
            }
        });

    } catch (error) {
        console.error('Performance metrics error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve performance metrics',
            error: error.message
        });
    }
};

/**
 * Get category-specific insights
 * GET /api/analytics/category-insights
 */
export const getCategoryInsights = async (req, res) => {
    try {
        const query = `
            SELECT 
                category,
                COUNT(*) as total_tickets,
                AVG(ai_confidence) as avg_confidence,
                COUNT(CASE WHEN priority_overridden THEN 1 END) as override_count,
                AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as avg_resolution_hours,
                
                -- Priority distribution
                COUNT(CASE WHEN priority = 'critical' THEN 1 END) as critical_count,
                COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_count,
                COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium_count,
                COUNT(CASE WHEN priority = 'low' THEN 1 END) as low_count,
                
                -- AI performance
                ROUND(
                    COUNT(CASE WHEN ai_recommended_priority = priority THEN 1 END)::NUMERIC /
                    COUNT(*)::NUMERIC * 100,
                    2
                ) as ai_accuracy_percentage
                
            FROM tickets
            WHERE ai_classified = true
              AND status IN ('resolved', 'closed')
            GROUP BY category
            ORDER BY total_tickets DESC
        `;

        const result = await pool.query(query);

        res.json({
            status: 'success',
            data: result.rows
        });

    } catch (error) {
        console.error('Category insights error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve category insights',
            error: error.message
        });
    }
};

export default {
    getAIPriorityAnalytics,
    getAIPerformanceMetrics,
    getCategoryInsights
};
