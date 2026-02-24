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

/**
 * Get collaboration analytics
 * GET /api/analytics/collaboration
 * @query {number} days - Number of days to analyze (default: 30)
 */
export const getCollaborationAnalytics = async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;

        // Overall collaboration statistics
        const overallStatsQuery = `
            SELECT 
                COUNT(DISTINCT tc.ticket_id) as total_collaborated_tickets,
                COUNT(DISTINCT CASE WHEN tc.role = 'primary' THEN tc.user_id END) as unique_primary_techs,
                COUNT(DISTINCT CASE WHEN tc.role = 'assisting' THEN tc.user_id END) as unique_assisting_techs,
                ROUND(AVG(collab_counts.count)::numeric, 2) as avg_collaborators_per_ticket,
                COUNT(DISTINCT CASE WHEN collab_counts.count >= 3 THEN tc.ticket_id END) as tickets_with_3plus_techs
            FROM ticket_collaborators tc
            JOIN (
                SELECT ticket_id, COUNT(*) as count
                FROM ticket_collaborators
                WHERE added_at >= NOW() - INTERVAL '${days} days'
                GROUP BY ticket_id
            ) collab_counts ON tc.ticket_id = collab_counts.ticket_id
            WHERE tc.added_at >= NOW() - INTERVAL '${days} days'
        `;
        
        const overallStats = await pool.query(overallStatsQuery);

        // Collaboration rate (% of tickets with collaborators)
        const collaborationRateQuery = `
            SELECT 
                COUNT(DISTINCT t.id) as total_tickets,
                COUNT(DISTINCT tc.ticket_id) as collaborated_tickets,
                ROUND((COUNT(DISTINCT tc.ticket_id)::numeric / NULLIF(COUNT(DISTINCT t.id), 0) * 100), 2) as collaboration_rate_percent
            FROM tickets t
            LEFT JOIN ticket_collaborators tc ON t.id = tc.ticket_id
            WHERE t.created_at >= NOW() - INTERVAL '${days} days'
        `;
        
        const collaborationRate = await pool.query(collaborationRateQuery);

        // Most collaborative technicians
        const mostCollaborativeQuery = `
            SELECT 
                u.id,
                u.first_name,
                u.last_name,
                u.email,
                COUNT(CASE WHEN tc.role = 'primary' THEN 1 END) as primary_count,
                COUNT(CASE WHEN tc.role = 'assisting' THEN 1 END) as assisting_count,
                COUNT(*) as total_collaborations
            FROM ticket_collaborators tc
            JOIN users u ON tc.user_id = u.id
            WHERE tc.added_at >= NOW() - INTERVAL '${days} days'
            GROUP BY u.id, u.first_name, u.last_name, u.email
            HAVING COUNT(*) >= 3
            ORDER BY total_collaborations DESC
            LIMIT 10
        `;
        
        const mostCollaborative = await pool.query(mostCollaborativeQuery);

        // Collaboration by category
        const categoryCollaborationQuery = `
            SELECT 
                t.category,
                COUNT(DISTINCT tc.ticket_id) as collaborated_tickets,
                COUNT(DISTINCT t.id) as total_tickets,
                ROUND((COUNT(DISTINCT tc.ticket_id)::numeric / NULLIF(COUNT(DISTINCT t.id), 0) * 100), 2) as collaboration_rate_percent,
                ROUND(AVG(collab_counts.count)::numeric, 2) as avg_techs_per_ticket
            FROM tickets t
            LEFT JOIN ticket_collaborators tc ON t.id = tc.ticket_id AND tc.added_at >= NOW() - INTERVAL '${days} days'
            LEFT JOIN (
                SELECT ticket_id, COUNT(*) as count
                FROM ticket_collaborators
                WHERE added_at >= NOW() - INTERVAL '${days} days'
                GROUP BY ticket_id
            ) collab_counts ON t.id = collab_counts.ticket_id
            WHERE t.created_at >= NOW() - INTERVAL '${days} days'
            GROUP BY t.category
            ORDER BY collaboration_rate_percent DESC
        `;
        
        const categoryCollaboration = await pool.query(categoryCollaborationQuery);

        // Resolution time comparison: collaborated vs non-collaborated
        const resolutionComparisonQuery = `
            SELECT 
                CASE 
                    WHEN tc.ticket_id IS NOT NULL THEN 'Collaborated'
                    ELSE 'Single Tech'
                END as ticket_type,
                COUNT(t.id) as ticket_count,
                ROUND(AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600)::numeric, 2) as avg_resolution_hours,
                ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600)::numeric, 2) as median_resolution_hours
            FROM tickets t
            LEFT JOIN ticket_collaborators tc ON t.id = tc.ticket_id AND tc.added_at >= NOW() - INTERVAL '${days} days'
            WHERE t.created_at >= NOW() - INTERVAL '${days} days'
              AND t.resolved_at IS NOT NULL
              AND t.status IN ('resolved', 'closed')
            GROUP BY 
                CASE 
                    WHEN tc.ticket_id IS NOT NULL THEN 'Collaborated'
                    ELSE 'Single Tech'
                END
        `;
        
        const resolutionComparison = await pool.query(resolutionComparisonQuery);

        // Collaboration over time (daily trend)
        const collaborationTrendQuery = `
            SELECT 
                DATE(tc.added_at) as date,
                COUNT(DISTINCT tc.ticket_id) as tickets_with_new_collaborators,
                COUNT(*) as total_collaborators_added
            FROM ticket_collaborators tc
            WHERE tc.added_at >= NOW() - INTERVAL '${days} days'
            GROUP BY DATE(tc.added_at)
            ORDER BY date DESC
        `;
        
        const collaborationTrend = await pool.query(collaborationTrendQuery);

        // Tickets needing collaboration (high priority or overdue with only 1 tech)
        const needsCollaborationQuery = `
            SELECT 
                t.id,
                t.ticket_number,
                t.title,
                t.priority,
                t.category,
                t.status,
                t.created_at,
                EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 3600 as age_hours,
                u.first_name as primary_tech_first_name,
                u.last_name as primary_tech_last_name,
                collab_count.count as current_collaborator_count
            FROM tickets t
            JOIN (
                SELECT ticket_id, COUNT(*) as count
                FROM ticket_collaborators
                WHERE role = 'primary'
                GROUP BY ticket_id
            ) collab_count ON t.id = collab_count.ticket_id
            LEFT JOIN ticket_collaborators tc ON t.id = tc.ticket_id AND tc.role = 'primary'
            LEFT JOIN users u ON tc.user_id = u.id
            WHERE collab_count.count = 1
              AND t.status NOT IN ('resolved', 'closed', 'cancelled')
              AND (
                  t.priority IN ('critical', 'high')
                  OR EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 3600 > 48
              )
            ORDER BY 
                CASE t.priority
                    WHEN 'critical' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'medium' THEN 3
                    WHEN 'low' THEN 4
                END,
                t.created_at ASC
            LIMIT 20
        `;
        
        const needsCollaboration = await pool.query(needsCollaborationQuery);

        // Response structure
        res.status(200).json({
            status: 'success',
            data: {
                time_period_days: days,
                overall: overallStats.rows[0],
                collaboration_rate: collaborationRate.rows[0],
                most_collaborative_techs: mostCollaborative.rows,
                by_category: categoryCollaboration.rows,
                resolution_comparison: resolutionComparison.rows,
                trend: collaborationTrend.rows,
                needs_collaboration: needsCollaboration.rows
            }
        });

    } catch (error) {
        console.error('Get collaboration analytics error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve collaboration analytics',
            error: error.message
        });
    }
};

export default {
    getAIPriorityAnalytics,
    getAIPerformanceMetrics,
    getCategoryInsights,
    getCollaborationAnalytics
};

// ============================================================================
// Dashboard Widget Endpoints (Issue #95)
// ============================================================================

/**
 * GET /api/analytics/assignment-stats
 * Returns assigned vs unassigned ticket counts and percentages
 */
export const getAssignmentStats = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                COUNT(*) AS total,
                COUNT(assigned_to) AS assigned,
                COUNT(*) - COUNT(assigned_to) AS unassigned,
                CASE WHEN COUNT(*) > 0
                    THEN ROUND(COUNT(assigned_to)::NUMERIC / COUNT(*)::NUMERIC * 100, 1)
                    ELSE 0
                END AS assigned_pct,
                CASE WHEN COUNT(*) > 0
                    THEN ROUND((COUNT(*) - COUNT(assigned_to))::NUMERIC / COUNT(*)::NUMERIC * 100, 1)
                    ELSE 0
                END AS unassigned_pct
            FROM tickets
            WHERE status NOT IN ('closed', 'cancelled')
        `);

        const row = result.rows[0];
        res.json({
            status: 'success',
            data: {
                total: parseInt(row.total),
                assigned: parseInt(row.assigned),
                unassigned: parseInt(row.unassigned),
                assigned_pct: parseFloat(row.assigned_pct),
                unassigned_pct: parseFloat(row.unassigned_pct)
            }
        });
    } catch (error) {
        console.error('Assignment stats error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to retrieve assignment stats', error: error.message });
    }
};

/**
 * GET /api/analytics/category-breakdown
 * Returns ticket counts by category with color codes
 */
export const getCategoryBreakdown = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                t.category,
                COALESCE(c.display_name, INITCAP(REPLACE(t.category::TEXT, '_', ' '))) AS display_name,
                c.color_code,
                COUNT(*) AS count,
                CASE WHEN SUM(COUNT(*)) OVER () > 0
                    THEN ROUND(COUNT(*)::NUMERIC / SUM(COUNT(*)) OVER ()::NUMERIC * 100, 1)
                    ELSE 0
                END AS percentage
            FROM tickets t
            LEFT JOIN categories c ON c.name = t.category
            WHERE t.status NOT IN ('closed', 'cancelled')
            GROUP BY t.category, c.display_name, c.color_code
            ORDER BY count DESC
        `);

        res.json({
            status: 'success',
            data: result.rows.map(r => ({
                category: r.category,
                display_name: r.display_name,
                color_code: r.color_code,
                count: parseInt(r.count),
                percentage: parseFloat(r.percentage)
            }))
        });
    } catch (error) {
        console.error('Category breakdown error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to retrieve category breakdown', error: error.message });
    }
};

/**
 * GET /api/analytics/overdue-tickets
 * Returns list of overdue tickets with days overdue and alert level
 */
export const getOverdueTickets = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                t.id,
                t.ticket_number,
                t.subject,
                t.priority,
                t.status,
                t.category,
                t.created_at,
                t.resolution_due_at,
                CONCAT(customer.first_name, ' ', customer.last_name) AS customer_name,
                CONCAT(assigned.first_name, ' ', assigned.last_name) AS assigned_to_name,
                EXTRACT(EPOCH FROM (NOW() - t.resolution_due_at)) / 86400 AS days_overdue
            FROM tickets t
            LEFT JOIN users customer ON t.customer_id = customer.id
            LEFT JOIN users assigned ON t.assigned_to = assigned.id
            WHERE t.resolution_due_at < NOW()
              AND t.status NOT IN ('resolved', 'closed', 'cancelled')
            ORDER BY t.resolution_due_at ASC
        `);

        res.json({
            status: 'success',
            count: result.rows.length,
            data: result.rows.map(r => {
                const daysOverdue = parseFloat(r.days_overdue) || 0;
                let alert_level = 'warning';  // default
                if (daysOverdue > 7) alert_level = 'critical';
                else if (daysOverdue > 3) alert_level = 'high';
                else if (daysOverdue > 1) alert_level = 'medium';

                return {
                    ...r,
                    days_overdue: Math.round(daysOverdue * 10) / 10,
                    alert_level
                };
            })
        });
    } catch (error) {
        console.error('Overdue tickets error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to retrieve overdue tickets', error: error.message });
    }
};

/**
 * GET /api/analytics/tech-workload
 * Returns per-technician workload: open ticket counts, avg resolution time, color grade
 */
export const getTechWorkload = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                u.id AS tech_id,
                CONCAT(u.first_name, ' ', u.last_name) AS tech_name,
                u.email,

                -- Active ticket count
                COUNT(t.id) FILTER (
                    WHERE t.status NOT IN ('resolved', 'closed', 'cancelled')
                ) AS open_tickets,

                -- Total ever assigned (including resolved)
                COUNT(t.id) AS total_assigned,

                -- Resolved in last 30 days
                COUNT(t.id) FILTER (
                    WHERE t.status IN ('resolved', 'closed')
                      AND t.resolved_at >= NOW() - INTERVAL '30 days'
                ) AS resolved_30d,

                -- Average resolution time (hours) for resolved tickets
                ROUND(
                    AVG(
                        EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600
                    ) FILTER (WHERE t.status IN ('resolved', 'closed') AND t.resolved_at IS NOT NULL),
                    1
                ) AS avg_resolution_hours,

                -- Priority breakdown of open tickets
                COUNT(t.id) FILTER (WHERE t.priority = 'critical' AND t.status NOT IN ('resolved', 'closed', 'cancelled')) AS critical_count,
                COUNT(t.id) FILTER (WHERE t.priority = 'high'     AND t.status NOT IN ('resolved', 'closed', 'cancelled')) AS high_count,
                COUNT(t.id) FILTER (WHERE t.priority = 'medium'   AND t.status NOT IN ('resolved', 'closed', 'cancelled')) AS medium_count,
                COUNT(t.id) FILTER (WHERE t.priority = 'low'      AND t.status NOT IN ('resolved', 'closed', 'cancelled')) AS low_count

            FROM users u
            LEFT JOIN tickets t ON t.assigned_to = u.id
            WHERE u.role IN ('technician', 'senior_technician')
              AND u.is_active = true
            GROUP BY u.id, u.first_name, u.last_name, u.email
            ORDER BY open_tickets DESC, u.last_name
        `);

        // Compute load grade: green (<5), yellow (5-9), orange (10-14), red (>=15)
        const data = result.rows.map(r => {
            const open = parseInt(r.open_tickets);
            let load_color = 'green';
            if (open >= 15) load_color = 'red';
            else if (open >= 10) load_color = 'orange';
            else if (open >= 5) load_color = 'yellow';

            return {
                ...r,
                open_tickets: open,
                total_assigned: parseInt(r.total_assigned),
                resolved_30d: parseInt(r.resolved_30d),
                avg_resolution_hours: r.avg_resolution_hours ? parseFloat(r.avg_resolution_hours) : null,
                critical_count: parseInt(r.critical_count),
                high_count: parseInt(r.high_count),
                medium_count: parseInt(r.medium_count),
                low_count: parseInt(r.low_count),
                load_color
            };
        });

        res.json({ status: 'success', count: data.length, data });
    } catch (error) {
        console.error('Tech workload error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to retrieve tech workload', error: error.message });
    }
};

/**
 * GET /api/analytics/escalations
 * Returns critical / high-priority tickets that are unresolved (simulated escalations)
 * In the absence of an explicit escalation table, we treat critical or high priority,
 * open-status tickets that have gone without response past their SLA as escalations.
 */
export const getEscalations = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                t.id,
                t.ticket_number,
                t.subject,
                t.priority,
                t.status,
                t.category,
                t.created_at,
                t.response_due_at,
                t.first_response_at,
                CONCAT(customer.first_name, ' ', customer.last_name) AS customer_name,
                CONCAT(assigned.first_name, ' ', assigned.last_name) AS assigned_to_name,
                t.assigned_to AS assigned_to_id,
                -- Time since ticket was created (hours)
                ROUND(EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 3600, 1) AS hours_since_created,
                -- Reason for appearing here
                CASE
                    WHEN t.priority = 'critical' AND t.first_response_at IS NULL
                         AND t.response_due_at < NOW()
                        THEN 'Critical SLA breach - no first response'
                    WHEN t.priority = 'critical'
                        THEN 'Critical priority - requires immediate attention'
                    WHEN t.priority = 'high' AND t.first_response_at IS NULL
                         AND t.response_due_at < NOW()
                        THEN 'High priority SLA breach - no first response'
                    WHEN t.priority = 'high' AND t.resolution_due_at < NOW()
                        THEN 'High priority - resolution overdue'
                    ELSE 'Elevated priority - review recommended'
                END AS escalation_reason
            FROM tickets t
            LEFT JOIN users customer ON t.customer_id = customer.id
            LEFT JOIN users assigned ON t.assigned_to = assigned.id
            WHERE t.status NOT IN ('resolved', 'closed', 'cancelled')
              AND t.priority IN ('critical', 'high')
            ORDER BY
                CASE t.priority WHEN 'critical' THEN 0 ELSE 1 END,
                t.created_at ASC
        `);

        res.json({ status: 'success', count: result.rows.length, data: result.rows });
    } catch (error) {
        console.error('Escalations error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to retrieve escalations', error: error.message });
    }
};

/**
 * GET /api/analytics/todays-actions
 * Returns a combined view of items requiring action today:
 *  - Tickets due today (resolution_due_at within today)
 *  - Overdue tickets
 *  - Unassigned high/critical tickets
 */
export const getTodaysActions = async (req, res) => {
    try {
        // Tickets with resolution due today
        const dueTodayResult = await pool.query(`
            SELECT
                t.id, t.ticket_number, t.subject, t.priority, t.status,
                t.resolution_due_at,
                CONCAT(assigned.first_name, ' ', assigned.last_name) AS assigned_to_name,
                'due_today' AS action_type,
                'Ticket resolution due today' AS action_label
            FROM tickets t
            LEFT JOIN users assigned ON t.assigned_to = assigned.id
            WHERE t.resolution_due_at >= CURRENT_DATE
              AND t.resolution_due_at < CURRENT_DATE + INTERVAL '1 day'
              AND t.status NOT IN ('resolved', 'closed', 'cancelled')
            ORDER BY t.resolution_due_at ASC
        `);

        // Overdue tickets (resolution past due)
        const overdueResult = await pool.query(`
            SELECT
                t.id, t.ticket_number, t.subject, t.priority, t.status,
                t.resolution_due_at,
                CONCAT(assigned.first_name, ' ', assigned.last_name) AS assigned_to_name,
                'overdue' AS action_type,
                'Overdue - requires immediate attention' AS action_label
            FROM tickets t
            LEFT JOIN users assigned ON t.assigned_to = assigned.id
            WHERE t.resolution_due_at < CURRENT_DATE
              AND t.status NOT IN ('resolved', 'closed', 'cancelled')
            ORDER BY t.resolution_due_at ASC
            LIMIT 20
        `);

        // Unassigned high/critical
        const unassignedUrgentResult = await pool.query(`
            SELECT
                t.id, t.ticket_number, t.subject, t.priority, t.status,
                t.created_at,
                NULL AS assigned_to_name,
                'unassigned_urgent' AS action_type,
                'Unassigned ' || INITCAP(t.priority::TEXT) || ' ticket' AS action_label
            FROM tickets t
            WHERE t.assigned_to IS NULL
              AND t.priority IN ('critical', 'high')
              AND t.status NOT IN ('resolved', 'closed', 'cancelled')
            ORDER BY
                CASE t.priority WHEN 'critical' THEN 0 ELSE 1 END,
                t.created_at ASC
            LIMIT 20
        `);

        const actions = [
            ...overdueResult.rows,
            ...unassignedUrgentResult.rows,
            ...dueTodayResult.rows
        ];

        res.json({
            status: 'success',
            count: actions.length,
            data: actions,
            summary: {
                due_today: dueTodayResult.rows.length,
                overdue: overdueResult.rows.length,
                unassigned_urgent: unassignedUrgentResult.rows.length
            }
        });
    } catch (error) {
        console.error('Todays actions error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to retrieve todays actions', error: error.message });
    }
};

/**
 * GET /api/analytics/top-requesters?timeRange=30d
 * Returns top users by ticket volume in the given time range
 * Accepted timeRange values: 7d, 30d, 90d, all  (default 30d)
 */
export const getTopRequesters = async (req, res) => {
    try {
        const { timeRange = '30d' } = req.query;

        // Map timeRange to interval
        const intervalMap = { '7d': '7 days', '30d': '30 days', '90d': '90 days' };
        const interval = intervalMap[timeRange]; // null for 'all'

        let whereClause = '';
        const params = [];
        if (interval) {
            whereClause = `AND t.created_at >= NOW() - $1::INTERVAL`;
            params.push(interval);
        }

        const result = await pool.query(`
            SELECT
                u.id AS user_id,
                CONCAT(u.first_name, ' ', u.last_name) AS user_name,
                u.email,
                COUNT(t.id) AS ticket_count,
                ROUND(
                    AVG(
                        EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600
                    ) FILTER (WHERE t.resolved_at IS NOT NULL),
                    1
                ) AS avg_resolution_hours,
                COUNT(t.id) FILTER (WHERE t.status NOT IN ('resolved', 'closed', 'cancelled')) AS open_ticket_count
            FROM users u
            JOIN tickets t ON t.customer_id = u.id
            WHERE 1=1 ${whereClause}
            GROUP BY u.id, u.first_name, u.last_name, u.email
            ORDER BY ticket_count DESC
            LIMIT 10
        `, params);

        res.json({
            status: 'success',
            time_range: timeRange,
            data: result.rows.map(r => ({
                ...r,
                ticket_count: parseInt(r.ticket_count),
                open_ticket_count: parseInt(r.open_ticket_count),
                avg_resolution_hours: r.avg_resolution_hours ? parseFloat(r.avg_resolution_hours) : null
            }))
        });
    } catch (error) {
        console.error('Top requesters error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to retrieve top requesters', error: error.message });
    }
};

/**
 * GET /api/analytics/cancellation-stats
 * Returns cancellation metrics: total cancelled, rate, trends, top reasons, by category
 */
export const getCancellationStats = async (req, res) => {
    try {
        const { timeRange = '30d' } = req.query;
        const intervalMap = { '7d': '7 days', '30d': '30 days', '90d': '90 days' };
        const interval = intervalMap[timeRange]; // null for 'all'

        let dateFilter = '';
        const params = [];
        if (interval) {
            dateFilter = `AND t.created_at >= NOW() - $1::INTERVAL`;
            params.push(interval);
        }

        // Overall cancellation counts and rate
        const overviewResult = await pool.query(`
            SELECT
                COUNT(*) AS total_tickets,
                COUNT(*) FILTER (WHERE t.status = 'cancelled') AS cancelled_count,
                CASE WHEN COUNT(*) > 0
                    THEN ROUND(
                        COUNT(*) FILTER (WHERE t.status = 'cancelled')::NUMERIC
                        / COUNT(*)::NUMERIC * 100, 1
                    )
                    ELSE 0
                END AS cancellation_rate
            FROM tickets t
            WHERE 1=1 ${dateFilter}
        `, params);

        const overview = overviewResult.rows[0];

        // Daily cancellation trend (last 30 days regardless of timeRange)
        const trendResult = await pool.query(`
            SELECT
                DATE(t.updated_at) AS date,
                COUNT(*) AS cancelled_count
            FROM tickets t
            WHERE t.status = 'cancelled'
              AND t.updated_at >= NOW() - INTERVAL '30 days'
            GROUP BY DATE(t.updated_at)
            ORDER BY date ASC
        `);

        // Top cancellation reasons from ticket history
        const reasonsResult = await pool.query(`
            SELECT
                COALESCE(
                    th.metadata->>'cancellation_reason',
                    'Unknown'
                ) AS reason,
                COUNT(*) AS count
            FROM ticket_history th
            WHERE th.change_type = 'ticket_cancelled'
              ${interval ? `AND th.created_at >= NOW() - $${params.length}::INTERVAL` : ''}
            GROUP BY reason
            ORDER BY count DESC
            LIMIT 10
        `, params);

        // Cancellations by category
        const byCategoryResult = await pool.query(`
            SELECT
                t.category,
                COUNT(*) AS total_in_category,
                COUNT(*) FILTER (WHERE t.status = 'cancelled') AS cancelled_in_category,
                CASE WHEN COUNT(*) > 0
                    THEN ROUND(
                        COUNT(*) FILTER (WHERE t.status = 'cancelled')::NUMERIC
                        / COUNT(*)::NUMERIC * 100, 1
                    )
                    ELSE 0
                END AS category_cancellation_rate
            FROM tickets t
            WHERE 1=1 ${dateFilter}
            GROUP BY t.category
            HAVING COUNT(*) FILTER (WHERE t.status = 'cancelled') > 0
            ORDER BY cancelled_in_category DESC
        `, params);

        res.json({
            status: 'success',
            data: {
                overview: {
                    total_tickets: parseInt(overview.total_tickets),
                    cancelled_count: parseInt(overview.cancelled_count),
                    cancellation_rate: parseFloat(overview.cancellation_rate)
                },
                trend_30_days: trendResult.rows.map(r => ({
                    date: r.date,
                    cancelled_count: parseInt(r.cancelled_count)
                })),
                top_reasons: reasonsResult.rows.map(r => ({
                    reason: r.reason,
                    count: parseInt(r.count)
                })),
                by_category: byCategoryResult.rows.map(r => ({
                    category: r.category,
                    total: parseInt(r.total_in_category),
                    cancelled: parseInt(r.cancelled_in_category),
                    rate: parseFloat(r.category_cancellation_rate)
                }))
            }
        });
    } catch (error) {
        console.error('Cancellation stats error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to retrieve cancellation stats', error: error.message });
    }
};

/**
 * GET /api/analytics/tech-performance
 * Returns per-technician performance metrics:
 *  - avg resolution time, first response time, tickets resolved (30d), satisfaction placeholder
 */
export const getTechPerformance = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                u.id AS tech_id,
                CONCAT(u.first_name, ' ', u.last_name) AS tech_name,
                u.email,

                -- Tickets resolved in last 30 days
                COUNT(t.id) FILTER (
                    WHERE t.status IN ('resolved', 'closed')
                      AND t.resolved_at >= NOW() - INTERVAL '30 days'
                ) AS resolved_30d,

                -- Total tickets ever assigned
                COUNT(t.id) AS total_assigned,

                -- Average resolution time (hours)
                ROUND(
                    AVG(
                        EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600
                    ) FILTER (WHERE t.resolved_at IS NOT NULL),
                    1
                ) AS avg_resolution_hours,

                -- Average first response time (hours)
                ROUND(
                    AVG(
                        EXTRACT(EPOCH FROM (t.first_response_at - t.created_at)) / 3600
                    ) FILTER (WHERE t.first_response_at IS NOT NULL),
                    1
                ) AS avg_first_response_hours,

                -- Currently open tickets
                COUNT(t.id) FILTER (
                    WHERE t.status NOT IN ('resolved', 'closed', 'cancelled')
                ) AS open_tickets,

                -- Resolution rate (resolved+closed / total)
                CASE WHEN COUNT(t.id) > 0
                    THEN ROUND(
                        COUNT(t.id) FILTER (WHERE t.status IN ('resolved', 'closed'))::NUMERIC
                        / COUNT(t.id)::NUMERIC * 100, 1
                    )
                    ELSE 0
                END AS resolution_rate

            FROM users u
            LEFT JOIN tickets t ON t.assigned_to = u.id
            WHERE u.role IN ('technician', 'senior_technician')
              AND u.is_active = true
            GROUP BY u.id, u.first_name, u.last_name, u.email
            ORDER BY resolved_30d DESC, u.last_name
        `);

        res.json({
            status: 'success',
            count: result.rows.length,
            data: result.rows.map(r => ({
                ...r,
                resolved_30d: parseInt(r.resolved_30d),
                total_assigned: parseInt(r.total_assigned),
                open_tickets: parseInt(r.open_tickets),
                avg_resolution_hours: r.avg_resolution_hours ? parseFloat(r.avg_resolution_hours) : null,
                avg_first_response_hours: r.avg_first_response_hours ? parseFloat(r.avg_first_response_hours) : null,
                resolution_rate: parseFloat(r.resolution_rate),
                satisfaction_score: null  // placeholder — no satisfaction data yet
            }))
        });
    } catch (error) {
        console.error('Tech performance error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to retrieve tech performance', error: error.message });
    }
};

/**
 * Get ticket reopen analytics
 * GET /api/analytics/reopens
 */
export const getReopenAnalytics = async (req, res) => {
    try {
        const { days = 30 } = req.query;

        // Overall reopen statistics
        const overallQuery = `
            SELECT 
                COUNT(*) FILTER (WHERE reopen_count > 0) as total_reopened_tickets,
                COUNT(*) FILTER (WHERE reopen_count >= 3) as high_reopen_tickets,
                COUNT(*) as total_closed_tickets,
                ROUND(
                    COUNT(*) FILTER (WHERE reopen_count > 0)::numeric / 
                    NULLIF(COUNT(*), 0) * 100, 
                    2
                ) as reopen_rate_percent,
                AVG(reopen_count) FILTER (WHERE reopen_count > 0) as avg_reopens_when_reopened
            FROM tickets
            WHERE closed_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
        `;
        const overallResult = await pool.query(overallQuery);

        // Reopen count distribution
        const distributionQuery = `
            SELECT 
                reopen_count,
                COUNT(*) as ticket_count,
                ROUND(
                    COUNT(*)::numeric / SUM(COUNT(*)) OVER() * 100,
                    2
                ) as percentage
            FROM tickets
            WHERE closed_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
              AND reopen_count > 0
            GROUP BY reopen_count
            ORDER BY reopen_count
        `;
        const distributionResult = await pool.query(distributionQuery);

        // Reopens by category
        const categoryQuery = `
            SELECT 
                category,
                COUNT(*) as total_tickets,
                COUNT(*) FILTER (WHERE reopen_count > 0) as reopened_tickets,
                AVG(reopen_count) as avg_reopen_count,
                ROUND(
                    COUNT(*) FILTER (WHERE reopen_count > 0)::numeric / 
                    NULLIF(COUNT(*), 0) * 100,
                    2
                ) as reopen_rate_percent
            FROM tickets
            WHERE closed_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
            GROUP BY category
            HAVING COUNT(*) >= 5
            ORDER BY reopen_rate_percent DESC
        `;
        const categoryResult = await pool.query(categoryQuery);

        // Tickets with high reopen counts (3+) - these need attention
        const highReopenQuery = `
            SELECT 
                t.id,
                t.ticket_number,
                t.subject,
                t.category,
                t.priority,
                t.status,
                t.reopen_count,
                t.last_reopened_at,
                c.first_name || ' ' || c.last_name as customer_name,
                c.email as customer_email,
                a.first_name || ' ' || a.last_name as assigned_tech_name
            FROM tickets t
            LEFT JOIN users c ON t.customer_id = c.id
            LEFT JOIN users a ON t.assigned_to = a.id
            WHERE t.reopen_count >= 3
            ORDER BY t.reopen_count DESC, t.last_reopened_at DESC
            LIMIT 20
        `;
        const highReopenResult = await pool.query(highReopenQuery);

        // Reopen trend over time (daily for the specified period)
        const trendQuery = `
            SELECT 
                DATE(last_reopened_at) as date,
                COUNT(*) as reopen_count,
                COUNT(DISTINCT id) as unique_tickets
            FROM tickets
            WHERE last_reopened_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
            GROUP BY DATE(last_reopened_at)
            ORDER BY date
        `;
        const trendResult = await pool.query(trendQuery);

        // Technician reopen rates
        const techQuery = `
            SELECT 
                u.id as tech_id,
                u.first_name || ' ' || u.last_name as tech_name,
                COUNT(*) as total_tickets_handled,
                COUNT(*) FILTER (WHERE t.reopen_count > 0) as reopened_tickets,
                ROUND(
                    COUNT(*) FILTER (WHERE t.reopen_count > 0)::numeric / 
                    NULLIF(COUNT(*), 0) * 100,
                    2
                ) as reopen_rate_percent,
                AVG(t.reopen_count) FILTER (WHERE t.reopen_count > 0) as avg_reopens
            FROM users u
            JOIN tickets t ON t.previous_assigned_tech = u.id OR t.assigned_to = u.id
            WHERE u.role IN ('technician', 'senior_technician', 'management')
              AND t.closed_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
            GROUP BY u.id, u.first_name, u.last_name
            HAVING COUNT(*) >= 5
            ORDER BY reopen_rate_percent DESC
            LIMIT 15
        `;
        const techResult = await pool.query(techQuery);

        res.json({
            status: 'success',
            data: {
                period_days: parseInt(days),
                overall: {
                    total_reopened_tickets: parseInt(overallResult.rows[0].total_reopened_tickets) || 0,
                    high_reopen_tickets: parseInt(overallResult.rows[0].high_reopen_tickets) || 0,
                    total_closed_tickets: parseInt(overallResult.rows[0].total_closed_tickets) || 0,
                    reopen_rate_percent: parseFloat(overallResult.rows[0].reopen_rate_percent) || 0,
                    avg_reopens_when_reopened: parseFloat(overallResult.rows[0].avg_reopens_when_reopened) || 0
                },
                distribution: distributionResult.rows.map(r => ({
                    reopen_count: parseInt(r.reopen_count),
                    ticket_count: parseInt(r.ticket_count),
                    percentage: parseFloat(r.percentage)
                })),
                by_category: categoryResult.rows.map(r => ({
                    category: r.category,
                    total_tickets: parseInt(r.total_tickets),
                    reopened_tickets: parseInt(r.reopened_tickets),
                    avg_reopen_count: parseFloat(r.avg_reopen_count),
                    reopen_rate_percent: parseFloat(r.reopen_rate_percent)
                })),
                high_reopen_tickets: highReopenResult.rows.map(r => ({
                    ...r,
                    reopen_count: parseInt(r.reopen_count)
                })),
                trend: trendResult.rows.map(r => ({
                    date: r.date,
                    reopen_count: parseInt(r.reopen_count),
                    unique_tickets: parseInt(r.unique_tickets)
                })),
                by_technician: techResult.rows.map(r => ({
                    tech_id: parseInt(r.tech_id),
                    tech_name: r.tech_name,
                    total_tickets_handled: parseInt(r.total_tickets_handled),
                    reopened_tickets: parseInt(r.reopened_tickets),
                    reopen_rate_percent: parseFloat(r.reopen_rate_percent),
                    avg_reopens: parseFloat(r.avg_reopens)
                }))
            }
        });
    } catch (error) {
        console.error('Reopen analytics error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: 'Failed to retrieve reopen analytics', 
            error: error.message 
        });
    }
};

