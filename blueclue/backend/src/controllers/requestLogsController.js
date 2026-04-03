// src/controllers/requestLogsController.js
/**
 * Request Logs Analytics Controller
 * ==================================
 * Provides performance monitoring and analytics for API endpoints.
 * 
 * Endpoints:
 * - GET /api/admin/analytics/requests/slowest - Top 10 slowest endpoints
 * - GET /api/admin/analytics/requests/most-called - Top 10 most used endpoints
 * - GET /api/admin/analytics/requests/errors - Error analysis
 * - GET /api/admin/analytics/requests/summary - Overall system performance
 * - POST /api/admin/analytics/requests/refresh - Refresh materialized view
 */

import pool from '../config/database.js';

/**
 * Get top 10 slowest endpoints
 * Uses materialized view for performance
 */
export async function getSlowestEndpoints(req, res) {
    try {
        const { days = 7 } = req.query;
        
        const query = `
            SELECT 
                base_route,
                total_requests,
                avg_response_time_ms,
                median_response_time_ms,
                p95_response_time_ms,
                p99_response_time_ms,
                max_response_time_ms,
                error_count
            FROM request_logs_analytics
            ORDER BY p95_response_time_ms DESC
            LIMIT 10
        `;
        
        const result = await pool.query(query);
        
        res.json({
            success: true,
            data: result.rows,
            metadata: {
                timeframe_days: parseInt(days),
                generated_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error fetching slowest endpoints:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch slowest endpoints',
            message: error.message
        });
    }
}

/**
 * Get top 10 most called endpoints
 */
export async function getMostCalledEndpoints(req, res) {
    try {
        const { days = 7 } = req.query;
        
        const query = `
            SELECT 
                base_route,
                total_requests,
                avg_response_time_ms,
                median_response_time_ms,
                p95_response_time_ms,
                error_count,
                last_request_at
            FROM request_logs_analytics
            ORDER BY total_requests DESC
            LIMIT 10
        `;
        
        const result = await pool.query(query);
        
        res.json({
            success: true,
            data: result.rows,
            metadata: {
                timeframe_days: parseInt(days),
                generated_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error fetching most called endpoints:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch most called endpoints',
            message: error.message
        });
    }
}

/**
 * Get error analysis
 */
export async function getErrorAnalysis(req, res) {
    try {
        const { days = 7 } = req.query;
        
        // Get endpoints with highest error rates
        const query = `
            SELECT 
                base_route,
                total_requests,
                error_count,
                ROUND((error_count::DECIMAL / total_requests * 100)::NUMERIC, 2) as error_rate_percent,
                avg_response_time_ms
            FROM request_logs_analytics
            WHERE error_count > 0
            ORDER BY error_rate_percent DESC, error_count DESC
            LIMIT 10
        `;
        
        const result = await pool.query(query);
        
        // Get error breakdown by status code
        const statusQuery = `
            SELECT 
                status_code,
                COUNT(*) as count,
                AVG(response_time_ms)::INTEGER as avg_response_time_ms
            FROM request_logs
            WHERE status_code >= 400
                AND timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
            GROUP BY status_code
            ORDER BY count DESC
        `;
        
        const statusResult = await pool.query(statusQuery);
        
        res.json({
            success: true,
            data: {
                endpoints_with_errors: result.rows,
                error_breakdown_by_status: statusResult.rows
            },
            metadata: {
                timeframe_days: parseInt(days),
                generated_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error fetching error analysis:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch error analysis',
            message: error.message
        });
    }
}

/**
 * Get overall performance summary
 */
export async function getPerformanceSummary(req, res) {
    try {
        const { days = 7 } = req.query;
        
        // Overall statistics
        const summaryQuery = `
            SELECT 
                COUNT(*) as total_requests,
                AVG(response_time_ms)::INTEGER as avg_response_time_ms,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_time_ms)::INTEGER as median_response_time_ms,
                PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms)::INTEGER as p95_response_time_ms,
                PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time_ms)::INTEGER as p99_response_time_ms,
                MAX(response_time_ms) as max_response_time_ms,
                MIN(response_time_ms) as min_response_time_ms,
                COUNT(*) FILTER (WHERE status_code >= 400) as error_count,
                COUNT(*) FILTER (WHERE status_code >= 500) as server_error_count,
                COUNT(DISTINCT base_route) as unique_endpoints,
                COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as unique_users
            FROM request_logs
            WHERE timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
        `;
        
        const summaryResult = await pool.query(summaryQuery);
        
        // Requests per day
        const timeSeriesQuery = `
            SELECT 
                DATE(timestamp) as date,
                COUNT(*) as request_count,
                AVG(response_time_ms)::INTEGER as avg_response_time_ms,
                COUNT(*) FILTER (WHERE status_code >= 400) as error_count
            FROM request_logs
            WHERE timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
            GROUP BY DATE(timestamp)
            ORDER BY date DESC
        `;
        
        const timeSeriesResult = await pool.query(timeSeriesQuery);
        
        // Method distribution
        const methodQuery = `
            SELECT 
                method,
                COUNT(*) as count,
                AVG(response_time_ms)::INTEGER as avg_response_time_ms
            FROM request_logs
            WHERE timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
            GROUP BY method
            ORDER BY count DESC
        `;
        
        const methodResult = await pool.query(methodQuery);
        
        res.json({
            success: true,
            data: {
                summary: summaryResult.rows[0],
                requests_per_day: timeSeriesResult.rows,
                method_distribution: methodResult.rows
            },
            metadata: {
                timeframe_days: parseInt(days),
                generated_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error fetching performance summary:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch performance summary',
            message: error.message
        });
    }
}

/**
 * Refresh materialized view
 * Should be called periodically or after significant data changes
 */
export async function refreshAnalytics(req, res) {
    try {
        await pool.query('REFRESH MATERIALIZED VIEW request_logs_analytics');
        
        res.json({
            success: true,
            message: 'Analytics view refreshed successfully',
            refreshed_at: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error refreshing analytics view:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to refresh analytics view',
            message: error.message
        });
    }
}

/**
 * Get detailed logs for a specific endpoint
 */
export async function getEndpointDetails(req, res) {
    try {
        const { base_route, days = 7, limit = 100 } = req.query;
        
        if (!base_route) {
            return res.status(400).json({
                success: false,
                error: 'base_route query parameter is required'
            });
        }
        
        const query = `
            SELECT 
                id,
                endpoint,
                method,
                status_code,
                response_time_ms,
                user_id,
                error_message,
                timestamp
            FROM request_logs
            WHERE base_route = $1
                AND timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
            ORDER BY timestamp DESC
            LIMIT ${parseInt(limit)}
        `;
        
        const result = await pool.query(query, [base_route]);
        
        res.json({
            success: true,
            data: result.rows,
            metadata: {
                base_route,
                timeframe_days: parseInt(days),
                total_results: result.rows.length,
                generated_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error fetching endpoint details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch endpoint details',
            message: error.message
        });
    }
}

export default {
    getSlowestEndpoints,
    getMostCalledEndpoints,
    getErrorAnalysis,
    getPerformanceSummary,
    refreshAnalytics,
    getEndpointDetails
};
