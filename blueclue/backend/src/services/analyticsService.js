// src/services/analyticsService.js
// Comprehensive analytics service with caching for the BlueClue ticket system

import pool from '../config/database.js';

// In-memory cache for analytics data
const analyticsCache = {
    data: {},
    timestamps: {},
    ttl: {
        daily: 5 * 60 * 1000,       // 5 minutes for daily data
        weekly: 15 * 60 * 1000,     // 15 minutes for weekly data
        monthly: 60 * 60 * 1000,    // 1 hour for monthly data
    }
};

/**
 * Check if cached data is still valid
 */
const isCacheValid = (key, ttlType = 'daily') => {
    if (!analyticsCache.data[key] || !analyticsCache.timestamps[key]) {
        return false;
    }
    const ttl = analyticsCache.ttl[ttlType] || analyticsCache.ttl.daily;
    return Date.now() - analyticsCache.timestamps[key] < ttl;
};

/**
 * Get cached data or execute query
 */
const getCachedOrFetch = async (cacheKey, queryFn, ttlType = 'daily') => {
    if (isCacheValid(cacheKey, ttlType)) {
        return analyticsCache.data[cacheKey];
    }
    
    const data = await queryFn();
    analyticsCache.data[cacheKey] = data;
    analyticsCache.timestamps[cacheKey] = Date.now();
    return data;
};

/**
 * Clear all analytics cache
 */
export const clearAnalyticsCache = () => {
    analyticsCache.data = {};
    analyticsCache.timestamps = {};
    return { status: 'success', message: 'Analytics cache cleared' };
};

/**
 * Parse date range from query parameters
 */
export const parseDateRange = (startDate, endDate, preset) => {
    const now = new Date();
    let start, end;
    
    if (preset) {
        end = new Date();
        switch (preset) {
            case 'today':
                start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                start = new Date(now.setDate(now.getDate() - 7));
                break;
            case 'month':
                start = new Date(now.setMonth(now.getMonth() - 1));
                break;
            case 'quarter':
                start = new Date(now.setMonth(now.getMonth() - 3));
                break;
            case 'year':
                start = new Date(now.setFullYear(now.getFullYear() - 1));
                break;
            default:
                start = new Date(now.setMonth(now.getMonth() - 1)); // Default to month
        }
    } else {
        start = startDate ? new Date(startDate) : new Date(now.setMonth(now.getMonth() - 1));
        end = endDate ? new Date(endDate) : new Date();
    }
    
    return { start, end };
};

/**
 * Get resolution time metrics
 */
export const getResolutionTimeMetrics = async (startDate, endDate, category = null, techId = null) => {
    const params = [startDate, endDate];
    let paramIndex = 3;
    
    let categoryFilter = '';
    let techFilter = '';
    
    if (category) {
        categoryFilter = `AND t.category = $${paramIndex}::ticket_category`;
        params.push(category);
        paramIndex++;
    }
    
    if (techId) {
        techFilter = `AND t.assigned_to = $${paramIndex}::integer`;
        params.push(parseInt(techId));
        paramIndex++;
    }
    
    // Overall resolution time metrics
    const overallQuery = `
        SELECT 
            COUNT(*) as total_resolved,
            ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::numeric, 2) as avg_resolution_hours,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::numeric, 2) as median_resolution_hours,
            ROUND(MIN(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::numeric, 2) as min_resolution_hours,
            ROUND(MAX(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::numeric, 2) as max_resolution_hours,
            ROUND(STDDEV(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::numeric, 2) as stddev_resolution_hours
        FROM tickets t
        WHERE t.status IN ('resolved', 'closed')
          AND t.resolved_at IS NOT NULL
          AND t.resolved_at BETWEEN $1::timestamp AND $2::timestamp
          AND t.deleted_at IS NULL
          ${categoryFilter}
          ${techFilter}
    `;
    
    // Resolution time by category
    const byCategoryQuery = `
        SELECT 
            t.category,
            COUNT(*) as count,
            ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::numeric, 2) as avg_hours,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::numeric, 2) as median_hours
        FROM tickets t
        WHERE t.status IN ('resolved', 'closed')
          AND t.resolved_at IS NOT NULL
          AND t.resolved_at BETWEEN $1::timestamp AND $2::timestamp
          AND t.deleted_at IS NULL
          ${techFilter}
        GROUP BY t.category
        ORDER BY avg_hours DESC
    `;
    
    // Resolution time by priority
    const byPriorityQuery = `
        SELECT 
            t.priority,
            COUNT(*) as count,
            ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::numeric, 2) as avg_hours,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::numeric, 2) as median_hours
        FROM tickets t
        WHERE t.status IN ('resolved', 'closed')
          AND t.resolved_at IS NOT NULL
          AND t.resolved_at BETWEEN $1::timestamp AND $2::timestamp
          AND t.deleted_at IS NULL
          ${categoryFilter}
          ${techFilter}
        GROUP BY t.priority
        ORDER BY 
            CASE t.priority
                WHEN 'critical' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 3
                WHEN 'low' THEN 4
            END
    `;
    
    // Resolution time trend (daily)
    const trendQuery = `
        SELECT 
            DATE(resolved_at) as date,
            COUNT(*) as count,
            ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::numeric, 2) as avg_hours
        FROM tickets t
        WHERE t.status IN ('resolved', 'closed')
          AND t.resolved_at IS NOT NULL
          AND t.resolved_at BETWEEN $1::timestamp AND $2::timestamp
          AND t.deleted_at IS NULL
          ${categoryFilter}
          ${techFilter}
        GROUP BY DATE(resolved_at)
        ORDER BY date
    `;
    
    // Compare with previous period
    const intervalMs = new Date(endDate) - new Date(startDate);
    const prevStart = new Date(new Date(startDate).getTime() - intervalMs);
    const prevEnd = new Date(startDate);
    
    const comparisonQuery = `
        SELECT 
            ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::numeric, 2) as avg_hours
        FROM tickets t
        WHERE t.status IN ('resolved', 'closed')
          AND t.resolved_at IS NOT NULL
          AND t.resolved_at BETWEEN $1::timestamp AND $2::timestamp
          AND t.deleted_at IS NULL
          ${categoryFilter}
          ${techFilter}
    `;
    
    const [overall, byCategory, byPriority, trend, prevPeriod] = await Promise.all([
        pool.query(overallQuery, params),
        pool.query(byCategoryQuery, techId ? [startDate, endDate, parseInt(techId)] : [startDate, endDate]),
        pool.query(byPriorityQuery, params),
        pool.query(trendQuery, params),
        pool.query(comparisonQuery, [prevStart, prevEnd, ...(category ? [category] : []), ...(techId ? [parseInt(techId)] : [])])
    ]);
    
    const currentAvg = parseFloat(overall.rows[0]?.avg_resolution_hours) || 0;
    const prevAvg = parseFloat(prevPeriod.rows[0]?.avg_hours) || 0;
    const percentChange = prevAvg > 0 ? ((currentAvg - prevAvg) / prevAvg * 100).toFixed(1) : null;
    
    return {
        overall: {
            total_resolved: parseInt(overall.rows[0]?.total_resolved) || 0,
            avg_resolution_hours: currentAvg,
            median_resolution_hours: parseFloat(overall.rows[0]?.median_resolution_hours) || 0,
            min_resolution_hours: parseFloat(overall.rows[0]?.min_resolution_hours) || 0,
            max_resolution_hours: parseFloat(overall.rows[0]?.max_resolution_hours) || 0,
            stddev_resolution_hours: parseFloat(overall.rows[0]?.stddev_resolution_hours) || 0,
        },
        by_category: byCategory.rows.map(r => ({
            category: r.category,
            count: parseInt(r.count),
            avg_hours: parseFloat(r.avg_hours) || 0,
            median_hours: parseFloat(r.median_hours) || 0
        })),
        by_priority: byPriority.rows.map(r => ({
            priority: r.priority,
            count: parseInt(r.count),
            avg_hours: parseFloat(r.avg_hours) || 0,
            median_hours: parseFloat(r.median_hours) || 0
        })),
        trend: trend.rows.map(r => ({
            date: r.date,
            count: parseInt(r.count),
            avg_hours: parseFloat(r.avg_hours) || 0
        })),
        comparison: {
            previous_period_avg_hours: prevAvg,
            current_period_avg_hours: currentAvg,
            percent_change: percentChange !== null ? parseFloat(percentChange) : null,
            trend_direction: percentChange !== null ? (percentChange < 0 ? 'improved' : percentChange > 0 ? 'increased' : 'stable') : null
        },
        // SLA goal indicator (configurable - default 24 hours)
        goal: {
            target_hours: 24,
            meets_goal: currentAvg <= 24,
            deviation_hours: parseFloat((currentAvg - 24).toFixed(2))
        }
    };
};

/**
 * Get ticket volume metrics
 */
export const getTicketVolumeMetrics = async (startDate, endDate, category = null, techId = null) => {
    const params = [startDate, endDate];
    let paramIndex = 3;
    
    let categoryFilter = '';
    let techFilter = '';
    
    if (category) {
        categoryFilter = `AND t.category = $${paramIndex}::ticket_category`;
        params.push(category);
        paramIndex++;
    }
    
    if (techId) {
        techFilter = `AND t.assigned_to = $${paramIndex}::integer`;
        params.push(parseInt(techId));
    }
    
    // Total tickets and by status
    const byStatusQuery = `
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'open') as open,
            COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
            COUNT(*) FILTER (WHERE status = 'waiting_on_customer') as waiting_on_customer,
            COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
            COUNT(*) FILTER (WHERE status = 'closed') as closed,
            COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
            COUNT(*) FILTER (WHERE status = 'reopened') as reopened
        FROM tickets t
        WHERE t.created_at BETWEEN $1::timestamp AND $2::timestamp
          AND t.deleted_at IS NULL
          ${categoryFilter}
          ${techFilter}
    `;
    
    // Volume trend (daily)
    const trendQuery = `
        SELECT 
            DATE(t.created_at) as date,
            COUNT(*) as created,
            COUNT(*) FILTER (WHERE t.resolved_at::date = DATE(t.created_at)) as resolved_same_day
        FROM tickets t
        WHERE t.created_at BETWEEN $1::timestamp AND $2::timestamp
          AND t.deleted_at IS NULL
          ${categoryFilter}
          ${techFilter}
        GROUP BY DATE(t.created_at)
        ORDER BY date
    `;
    
    // Busiest hours heatmap
    const heatmapQuery = `
        SELECT 
            EXTRACT(DOW FROM t.created_at) as day_of_week,
            EXTRACT(HOUR FROM t.created_at) as hour,
            COUNT(*) as count
        FROM tickets t
        WHERE t.created_at BETWEEN $1::timestamp AND $2::timestamp
          AND t.deleted_at IS NULL
          ${categoryFilter}
          ${techFilter}
        GROUP BY EXTRACT(DOW FROM t.created_at), EXTRACT(HOUR FROM t.created_at)
        ORDER BY day_of_week, hour
    `;
    
    // Month-over-month comparison (using $1 to maintain parameter sequence)
    const momQuery = `
        SELECT 
            TO_CHAR(t.created_at, 'YYYY-MM') as month,
            COUNT(*) as count
        FROM tickets t
        WHERE t.created_at >= GREATEST($1::timestamp, DATE_TRUNC('month', $2::timestamp) - INTERVAL '6 months')
          AND t.created_at <= $2::timestamp
          AND t.deleted_at IS NULL
          ${categoryFilter}
          ${techFilter}
        GROUP BY TO_CHAR(t.created_at, 'YYYY-MM')
        ORDER BY month
    `;
    
    const [byStatus, trend, heatmap, mom] = await Promise.all([
        pool.query(byStatusQuery, params),
        pool.query(trendQuery, params),
        pool.query(heatmapQuery, params),
        pool.query(momQuery, params)
    ]);
    
    // Process heatmap data into grid format
    const heatmapData = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (let day = 0; day < 7; day++) {
        const dayData = { day: day, dayName: dayNames[day], hours: [] };
        for (let hour = 0; hour < 24; hour++) {
            const found = heatmap.rows.find(r => parseInt(r.day_of_week) === day && parseInt(r.hour) === hour);
            dayData.hours.push({
                hour,
                count: found ? parseInt(found.count) : 0
            });
        }
        heatmapData.push(dayData);
    }
    
    // Find peak times
    let peakHour = { day: 0, hour: 0, count: 0 };
    heatmap.rows.forEach(r => {
        const count = parseInt(r.count);
        if (count > peakHour.count) {
            peakHour = {
                day: parseInt(r.day_of_week),
                dayName: dayNames[parseInt(r.day_of_week)],
                hour: parseInt(r.hour),
                count
            };
        }
    });
    
    const statusData = byStatus.rows[0] || {};
    
    return {
        total: parseInt(statusData.total) || 0,
        by_status: {
            open: parseInt(statusData.open) || 0,
            in_progress: parseInt(statusData.in_progress) || 0,
            waiting_on_customer: parseInt(statusData.waiting_on_customer) || 0,
            resolved: parseInt(statusData.resolved) || 0,
            closed: parseInt(statusData.closed) || 0,
            cancelled: parseInt(statusData.cancelled) || 0,
            reopened: parseInt(statusData.reopened) || 0
        },
        trend: trend.rows.map(r => ({
            date: r.date,
            created: parseInt(r.created),
            resolved_same_day: parseInt(r.resolved_same_day) || 0
        })),
        heatmap: heatmapData,
        peak_time: peakHour,
        month_over_month: mom.rows.map(r => ({
            month: r.month,
            count: parseInt(r.count)
        }))
    };
};

/**
 * Get technician performance metrics
 */
export const getTechnicianPerformance = async (startDate, endDate, techId = null) => {
    const params = [startDate, endDate];
    let techFilter = '';
    
    if (techId) {
        techFilter = `AND t.assigned_to = $3::integer`;
        params.push(parseInt(techId));
    }
    
    const query = `
        SELECT 
            u.id as tech_id,
            CONCAT(u.first_name, ' ', u.last_name) as tech_name,
            u.email,
            u.role,
            
            -- Tickets assigned in period
            COUNT(t.id) as total_assigned,
            
            -- Tickets resolved in period
            COUNT(t.id) FILTER (WHERE t.status IN ('resolved', 'closed') AND t.resolved_at BETWEEN $1::timestamp AND $2::timestamp) as resolved,
            
            -- Currently open
            COUNT(t.id) FILTER (WHERE t.status NOT IN ('resolved', 'closed', 'cancelled')) as open_tickets,
            
            -- Average resolution time
            ROUND(AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600) 
                FILTER (WHERE t.resolved_at IS NOT NULL)::numeric, 2) as avg_resolution_hours,
            
            -- Median resolution time
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600) 
                FILTER (WHERE t.resolved_at IS NOT NULL)::numeric, 2) as median_resolution_hours,
            
            -- First response time
            ROUND(AVG(EXTRACT(EPOCH FROM (t.first_response_at - t.created_at)) / 3600) 
                FILTER (WHERE t.first_response_at IS NOT NULL)::numeric, 2) as avg_first_response_hours,
            
            -- Reopen rate
            ROUND(COUNT(t.id) FILTER (WHERE t.reopen_count > 0)::numeric / 
                NULLIF(COUNT(t.id) FILTER (WHERE t.status IN ('resolved', 'closed')), 0) * 100, 2) as reopen_rate,
            
            -- Priority breakdown
            COUNT(t.id) FILTER (WHERE t.priority = 'critical') as critical_count,
            COUNT(t.id) FILTER (WHERE t.priority = 'high') as high_count,
            COUNT(t.id) FILTER (WHERE t.priority = 'medium') as medium_count,
            COUNT(t.id) FILTER (WHERE t.priority = 'low') as low_count
            
        FROM users u
        LEFT JOIN tickets t ON t.assigned_to = u.id 
            AND t.created_at BETWEEN $1::timestamp AND $2::timestamp
            AND t.deleted_at IS NULL
        WHERE u.role IN ('technician', 'senior_technician')
          AND u.is_active = true
          ${techFilter}
        GROUP BY u.id, u.first_name, u.last_name, u.email, u.role
        ORDER BY resolved DESC, avg_resolution_hours ASC NULLS LAST
    `;
    
    const result = await pool.query(query, params);
    
    // Calculate rankings
    const techs = result.rows.map((r, index) => ({
        rank: index + 1,
        tech_id: parseInt(r.tech_id),
        tech_name: r.tech_name,
        email: r.email,
        role: r.role,
        total_assigned: parseInt(r.total_assigned) || 0,
        resolved: parseInt(r.resolved) || 0,
        open_tickets: parseInt(r.open_tickets) || 0,
        avg_resolution_hours: parseFloat(r.avg_resolution_hours) || null,
        median_resolution_hours: parseFloat(r.median_resolution_hours) || null,
        avg_first_response_hours: parseFloat(r.avg_first_response_hours) || null,
        reopen_rate: parseFloat(r.reopen_rate) || 0,
        priority_breakdown: {
            critical: parseInt(r.critical_count) || 0,
            high: parseInt(r.high_count) || 0,
            medium: parseInt(r.medium_count) || 0,
            low: parseInt(r.low_count) || 0
        },
        satisfaction_score: null // Placeholder for future implementation
    }));
    
    // Calculate team averages
    const teamAvg = {
        avg_resolution_hours: techs.length > 0 
            ? parseFloat((techs.reduce((sum, t) => sum + (t.avg_resolution_hours || 0), 0) / techs.filter(t => t.avg_resolution_hours).length).toFixed(2)) || null
            : null,
        avg_first_response_hours: techs.length > 0
            ? parseFloat((techs.reduce((sum, t) => sum + (t.avg_first_response_hours || 0), 0) / techs.filter(t => t.avg_first_response_hours).length).toFixed(2)) || null
            : null,
        avg_resolved: techs.length > 0
            ? parseFloat((techs.reduce((sum, t) => sum + t.resolved, 0) / techs.length).toFixed(1))
            : 0
    };
    
    return {
        technicians: techs,
        team_averages: teamAvg,
        leaderboard: techs.slice(0, 10)
    };
};

/**
 * Get issue category analysis
 */
export const getCategoryAnalysis = async (startDate, endDate) => {
    const params = [startDate, endDate];
    
    // Category distribution
    const distributionQuery = `
        SELECT 
            t.category,
            COALESCE(c.display_name, INITCAP(REPLACE(t.category::TEXT, '_', ' '))) as display_name,
            c.color_code,
            COUNT(*) as count,
            ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER() * 100, 1) as percentage,
            ROUND(AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600) 
                FILTER (WHERE t.resolved_at IS NOT NULL)::numeric, 2) as avg_resolution_hours
        FROM tickets t
        LEFT JOIN categories c ON c.name = t.category
        WHERE t.created_at BETWEEN $1::timestamp AND $2::timestamp
          AND t.deleted_at IS NULL
        GROUP BY t.category, c.display_name, c.color_code
        ORDER BY count DESC
    `;
    
    // Category trend over time
    const trendQuery = `
        SELECT 
            DATE(t.created_at) as date,
            t.category,
            COUNT(*) as count
        FROM tickets t
        WHERE t.created_at BETWEEN $1::timestamp AND $2::timestamp
          AND t.deleted_at IS NULL
        GROUP BY DATE(t.created_at), t.category
        ORDER BY date, t.category
    `;
    
    // Compare with previous period for growth/decline
    const intervalMs = new Date(endDate) - new Date(startDate);
    const prevStart = new Date(new Date(startDate).getTime() - intervalMs);
    const prevEnd = new Date(startDate);
    
    const comparisonQuery = `
        WITH current_period AS (
            SELECT category, COUNT(*) as count
            FROM tickets
            WHERE created_at BETWEEN $1::timestamp AND $2::timestamp AND deleted_at IS NULL
            GROUP BY category
        ),
        previous_period AS (
            SELECT category, COUNT(*) as count
            FROM tickets
            WHERE created_at BETWEEN $3::timestamp AND $4::timestamp AND deleted_at IS NULL
            GROUP BY category
        )
        SELECT 
            COALESCE(c.category, p.category) as category,
            COALESCE(c.count, 0) as current_count,
            COALESCE(p.count, 0) as previous_count,
            CASE 
                WHEN COALESCE(p.count, 0) = 0 THEN NULL
                ELSE ROUND(((COALESCE(c.count, 0) - COALESCE(p.count, 0))::numeric / p.count) * 100, 1)
            END as percent_change
        FROM current_period c
        FULL OUTER JOIN previous_period p ON c.category = p.category
        ORDER BY current_count DESC NULLS LAST
    `;
    
    const [distribution, trend, comparison] = await Promise.all([
        pool.query(distributionQuery, params),
        pool.query(trendQuery, params),
        pool.query(comparisonQuery, [startDate, endDate, prevStart, prevEnd])
    ]);
    
    // Process trend data into category-wise series
    const trendByCategory = {};
    trend.rows.forEach(r => {
        if (!trendByCategory[r.category]) {
            trendByCategory[r.category] = [];
        }
        trendByCategory[r.category].push({
            date: r.date,
            count: parseInt(r.count)
        });
    });
    
    // Identify growing and declining categories
    const growingCategories = comparison.rows
        .filter(r => r.percent_change !== null && r.percent_change > 10)
        .map(r => ({ category: r.category, growth: parseFloat(r.percent_change) }));
    
    const decliningCategories = comparison.rows
        .filter(r => r.percent_change !== null && r.percent_change < -10)
        .map(r => ({ category: r.category, decline: parseFloat(r.percent_change) }));
    
    return {
        distribution: distribution.rows.map(r => ({
            category: r.category,
            display_name: r.display_name,
            color_code: r.color_code,
            count: parseInt(r.count),
            percentage: parseFloat(r.percentage),
            avg_resolution_hours: parseFloat(r.avg_resolution_hours) || null
        })),
        trend_by_category: trendByCategory,
        comparison: comparison.rows.map(r => ({
            category: r.category,
            current_count: parseInt(r.current_count),
            previous_count: parseInt(r.previous_count),
            percent_change: r.percent_change !== null ? parseFloat(r.percent_change) : null
        })),
        growing_categories: growingCategories,
        declining_categories: decliningCategories
    };
};

/**
 * Get SLA compliance metrics
 */
export const getSLACompliance = async (startDate, endDate, category = null) => {
    const params = [startDate, endDate];
    let categoryFilter = '';
    
    if (category) {
        categoryFilter = `AND t.category = $3::ticket_category`;
        params.push(category);
    }
    
    // SLA configuration (in hours) - could be moved to config
    const slaConfig = {
        response: { critical: 1, high: 4, medium: 8, low: 24 },
        resolution: { critical: 4, high: 24, medium: 48, low: 72 }
    };
    
    // Overall SLA compliance
    const complianceQuery = `
        SELECT 
            COUNT(*) as total,
            
            -- Response SLA
            COUNT(*) FILTER (WHERE t.first_response_at IS NOT NULL AND t.response_due_at IS NOT NULL 
                AND t.first_response_at <= t.response_due_at) as response_met,
            COUNT(*) FILTER (WHERE t.first_response_at IS NOT NULL AND t.response_due_at IS NOT NULL 
                AND t.first_response_at > t.response_due_at) as response_breached,
            COUNT(*) FILTER (WHERE t.response_due_at IS NOT NULL) as response_applicable,
            
            -- Resolution SLA
            COUNT(*) FILTER (WHERE t.resolved_at IS NOT NULL AND t.resolution_due_at IS NOT NULL 
                AND t.resolved_at <= t.resolution_due_at) as resolution_met,
            COUNT(*) FILTER (WHERE t.resolved_at IS NOT NULL AND t.resolution_due_at IS NOT NULL 
                AND t.resolved_at > t.resolution_due_at) as resolution_breached,
            COUNT(*) FILTER (WHERE t.resolution_due_at IS NOT NULL AND t.status IN ('resolved', 'closed')) as resolution_applicable,
            
            -- Average times
            ROUND(AVG(EXTRACT(EPOCH FROM (t.first_response_at - t.created_at)) / 3600) 
                FILTER (WHERE t.first_response_at IS NOT NULL)::numeric, 2) as avg_response_hours,
            ROUND(AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600) 
                FILTER (WHERE t.resolved_at IS NOT NULL)::numeric, 2) as avg_resolution_hours
            
        FROM tickets t
        WHERE t.created_at BETWEEN $1::timestamp AND $2::timestamp
          AND t.deleted_at IS NULL
          ${categoryFilter}
    `;
    
    // SLA breaches by category
    const breachesByCategoryQuery = `
        SELECT 
            t.category,
            COUNT(*) FILTER (WHERE t.first_response_at > t.response_due_at) as response_breaches,
            COUNT(*) FILTER (WHERE t.resolved_at > t.resolution_due_at) as resolution_breaches
        FROM tickets t
        WHERE t.created_at BETWEEN $1::timestamp AND $2::timestamp
          AND t.deleted_at IS NULL
          AND (t.response_due_at IS NOT NULL OR t.resolution_due_at IS NOT NULL)
        GROUP BY t.category
        HAVING COUNT(*) FILTER (WHERE t.first_response_at > t.response_due_at) > 0
            OR COUNT(*) FILTER (WHERE t.resolved_at > t.resolution_due_at) > 0
        ORDER BY (COUNT(*) FILTER (WHERE t.first_response_at > t.response_due_at) 
            + COUNT(*) FILTER (WHERE t.resolved_at > t.resolution_due_at)) DESC
    `;
    
    // SLA breach trend
    const trendQuery = `
        SELECT 
            DATE(t.created_at) as date,
            COUNT(*) FILTER (WHERE t.first_response_at > t.response_due_at) as response_breaches,
            COUNT(*) FILTER (WHERE t.resolved_at > t.resolution_due_at) as resolution_breaches
        FROM tickets t
        WHERE t.created_at BETWEEN $1::timestamp AND $2::timestamp
          AND t.deleted_at IS NULL
          ${categoryFilter}
        GROUP BY DATE(t.created_at)
        ORDER BY date
    `;
    
    // Currently breaching tickets
    const currentBreachesQuery = `
        SELECT 
            t.id,
            t.ticket_number,
            t.subject,
            t.priority,
            t.category,
            t.status,
            t.created_at,
            t.response_due_at,
            t.resolution_due_at,
            t.first_response_at,
            CONCAT(u.first_name, ' ', u.last_name) as assigned_to_name,
            CASE 
                WHEN t.first_response_at IS NULL AND t.response_due_at < NOW() THEN 'response'
                WHEN t.resolved_at IS NULL AND t.resolution_due_at < NOW() THEN 'resolution'
                ELSE 'both'
            END as breach_type,
            ROUND(GREATEST(
                COALESCE(EXTRACT(EPOCH FROM (NOW() - t.response_due_at)) / 3600, 0),
                COALESCE(EXTRACT(EPOCH FROM (NOW() - t.resolution_due_at)) / 3600, 0)
            )::numeric, 1) as hours_overdue
        FROM tickets t
        LEFT JOIN users u ON t.assigned_to = u.id
        WHERE t.status NOT IN ('resolved', 'closed', 'cancelled')
          AND t.deleted_at IS NULL
          AND (
              (t.first_response_at IS NULL AND t.response_due_at < NOW())
              OR (t.resolved_at IS NULL AND t.resolution_due_at < NOW())
          )
        ORDER BY hours_overdue DESC
        LIMIT 50
    `;
    
    const [compliance, breachesByCategory, trend, currentBreaches] = await Promise.all([
        pool.query(complianceQuery, params),
        pool.query(breachesByCategoryQuery, params.slice(0, 2)),
        pool.query(trendQuery, params),
        pool.query(currentBreachesQuery)
    ]);
    
    const data = compliance.rows[0] || {};
    const responseCompliance = data.response_applicable > 0 
        ? parseFloat((data.response_met / data.response_applicable * 100).toFixed(1))
        : null;
    const resolutionCompliance = data.resolution_applicable > 0
        ? parseFloat((data.resolution_met / data.resolution_applicable * 100).toFixed(1))
        : null;
    
    return {
        overall: {
            total_tickets: parseInt(data.total) || 0,
            response: {
                met: parseInt(data.response_met) || 0,
                breached: parseInt(data.response_breached) || 0,
                applicable: parseInt(data.response_applicable) || 0,
                compliance_rate: responseCompliance,
                avg_hours: parseFloat(data.avg_response_hours) || null
            },
            resolution: {
                met: parseInt(data.resolution_met) || 0,
                breached: parseInt(data.resolution_breached) || 0,
                applicable: parseInt(data.resolution_applicable) || 0,
                compliance_rate: resolutionCompliance,
                avg_hours: parseFloat(data.avg_resolution_hours) || null
            }
        },
        sla_targets: slaConfig,
        breaches_by_category: breachesByCategory.rows.map(r => ({
            category: r.category,
            response_breaches: parseInt(r.response_breaches),
            resolution_breaches: parseInt(r.resolution_breaches)
        })),
        trend: trend.rows.map(r => ({
            date: r.date,
            response_breaches: parseInt(r.response_breaches),
            resolution_breaches: parseInt(r.resolution_breaches)
        })),
        current_breaches: currentBreaches.rows.map(r => ({
            ...r,
            hours_overdue: parseFloat(r.hours_overdue) || 0
        }))
    };
};

/**
 * Get additional metrics (reopen rate, cancellation rate, comments, collaboration, peaks)
 */
export const getAdditionalMetrics = async (startDate, endDate) => {
    const params = [startDate, endDate];
    
    const metricsQuery = `
        SELECT 
            -- Reopen rate
            ROUND(COUNT(*) FILTER (WHERE reopen_count > 0)::numeric / 
                NULLIF(COUNT(*) FILTER (WHERE status IN ('resolved', 'closed')), 0) * 100, 2) as reopen_rate,
            COUNT(*) FILTER (WHERE reopen_count > 0) as reopened_count,
            
            -- Cancellation rate
            ROUND(COUNT(*) FILTER (WHERE status = 'cancelled')::numeric / 
                NULLIF(COUNT(*), 0) * 100, 2) as cancellation_rate,
            COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
            
            -- Total tickets
            COUNT(*) as total_tickets
            
        FROM tickets
        WHERE created_at BETWEEN $1::timestamp AND $2::timestamp
          AND deleted_at IS NULL
    `;
    
    // Average comments per ticket
    const commentsQuery = `
        SELECT 
            ROUND(AVG(comment_counts.count)::numeric, 2) as avg_comments_per_ticket,
            MAX(comment_counts.count) as max_comments
        FROM (
            SELECT t.id, COUNT(c.id) as count
            FROM tickets t
            LEFT JOIN ticket_comments c ON t.id = c.ticket_id AND c.deleted_at IS NULL
            WHERE t.created_at BETWEEN $1::timestamp AND $2::timestamp
              AND t.deleted_at IS NULL
            GROUP BY t.id
        ) comment_counts
    `;
    
    // Collaboration frequency
    const collaborationQuery = `
        SELECT 
            COUNT(DISTINCT tc.ticket_id) as collaborated_tickets,
            ROUND(COUNT(DISTINCT tc.ticket_id)::numeric / 
                NULLIF((SELECT COUNT(*) FROM tickets WHERE created_at BETWEEN $1::timestamp AND $2::timestamp AND deleted_at IS NULL), 0) * 100, 2) as collaboration_rate
        FROM ticket_collaborators tc
        JOIN tickets t ON tc.ticket_id = t.id
        WHERE t.created_at BETWEEN $1::timestamp AND $2::timestamp
          AND t.deleted_at IS NULL
    `;
    
    // Peak request times
    const peakTimesQuery = `
        SELECT 
            EXTRACT(HOUR FROM created_at) as hour,
            COUNT(*) as count
        FROM tickets
        WHERE created_at BETWEEN $1::timestamp AND $2::timestamp
          AND deleted_at IS NULL
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY count DESC
        LIMIT 5
    `;
    
    const [metrics, comments, collaboration, peakTimes] = await Promise.all([
        pool.query(metricsQuery, params),
        pool.query(commentsQuery, params),
        pool.query(collaborationQuery, params),
        pool.query(peakTimesQuery, params)
    ]);
    
    const metricsData = metrics.rows[0] || {};
    const commentsData = comments.rows[0] || {};
    const collabData = collaboration.rows[0] || {};
    
    return {
        reopen: {
            rate: parseFloat(metricsData.reopen_rate) || 0,
            count: parseInt(metricsData.reopened_count) || 0
        },
        cancellation: {
            rate: parseFloat(metricsData.cancellation_rate) || 0,
            count: parseInt(metricsData.cancelled_count) || 0
        },
        comments: {
            avg_per_ticket: parseFloat(commentsData.avg_comments_per_ticket) || 0,
            max_on_single_ticket: parseInt(commentsData.max_comments) || 0
        },
        collaboration: {
            collaborated_tickets: parseInt(collabData.collaborated_tickets) || 0,
            collaboration_rate: parseFloat(collabData.collaboration_rate) || 0
        },
        peak_hours: peakTimes.rows.map(r => ({
            hour: parseInt(r.hour),
            count: parseInt(r.count),
            label: `${parseInt(r.hour)}:00 - ${parseInt(r.hour) + 1}:00`
        })),
        total_tickets: parseInt(metricsData.total_tickets) || 0
    };
};

/**
 * Generate export data in specified format
 */
export const generateExportData = async (type, startDate, endDate, format = 'csv') => {
    let data;
    let filename;
    
    switch (type) {
        case 'summary':
            const [resTime, volume, techPerf, categories, sla, additional] = await Promise.all([
                getResolutionTimeMetrics(startDate, endDate),
                getTicketVolumeMetrics(startDate, endDate),
                getTechnicianPerformance(startDate, endDate),
                getCategoryAnalysis(startDate, endDate),
                getSLACompliance(startDate, endDate),
                getAdditionalMetrics(startDate, endDate)
            ]);
            data = { resolution_time: resTime, volume, technician_performance: techPerf, categories, sla, additional };
            filename = `analytics-summary-${startDate}-to-${endDate}`;
            break;
            
        case 'resolution-time':
            data = await getResolutionTimeMetrics(startDate, endDate);
            filename = `resolution-time-${startDate}-to-${endDate}`;
            break;
            
        case 'ticket-volume':
            data = await getTicketVolumeMetrics(startDate, endDate);
            filename = `ticket-volume-${startDate}-to-${endDate}`;
            break;
            
        case 'tech-performance':
            data = await getTechnicianPerformance(startDate, endDate);
            filename = `tech-performance-${startDate}-to-${endDate}`;
            break;
            
        case 'categories':
            data = await getCategoryAnalysis(startDate, endDate);
            filename = `categories-${startDate}-to-${endDate}`;
            break;
            
        case 'sla':
            data = await getSLACompliance(startDate, endDate);
            filename = `sla-compliance-${startDate}-to-${endDate}`;
            break;
            
        default:
            throw new Error(`Unknown export type: ${type}`);
    }
    
    if (format === 'csv') {
        return {
            filename: `${filename}.csv`,
            content: convertToCSV(data, type),
            contentType: 'text/csv'
        };
    } else if (format === 'json') {
        return {
            filename: `${filename}.json`,
            content: JSON.stringify(data, null, 2),
            contentType: 'application/json'
        };
    }
    
    throw new Error(`Unsupported format: ${format}`);
};

/**
 * Convert data to CSV format
 */
const convertToCSV = (data, type) => {
    let csv = '';
    
    switch (type) {
        case 'summary':
            csv += 'BlueClue Analytics Summary Report\n';
            csv += `Generated: ${new Date().toISOString()}\n\n`;
            
            // Resolution Time Summary
            csv += 'Resolution Time Metrics\n';
            csv += `Average Resolution Hours,${data.resolution_time.overall.avg_resolution_hours}\n`;
            csv += `Median Resolution Hours,${data.resolution_time.overall.median_resolution_hours}\n`;
            csv += `Total Resolved,${data.resolution_time.overall.total_resolved}\n\n`;
            
            // Volume Summary  
            csv += 'Ticket Volume\n';
            csv += `Total Tickets,${data.volume.total}\n`;
            csv += `Open,${data.volume.by_status.open}\n`;
            csv += `In Progress,${data.volume.by_status.in_progress}\n`;
            csv += `Resolved,${data.volume.by_status.resolved}\n`;
            csv += `Closed,${data.volume.by_status.closed}\n`;
            csv += `Cancelled,${data.volume.by_status.cancelled}\n\n`;
            
            // SLA Summary
            csv += 'SLA Compliance\n';
            csv += `Response SLA Met,${data.sla.overall.response.compliance_rate}%\n`;
            csv += `Resolution SLA Met,${data.sla.overall.resolution.compliance_rate}%\n\n`;
            
            // Additional Metrics
            csv += 'Additional Metrics\n';
            csv += `Reopen Rate,${data.additional.reopen.rate}%\n`;
            csv += `Cancellation Rate,${data.additional.cancellation.rate}%\n`;
            csv += `Avg Comments per Ticket,${data.additional.comments.avg_per_ticket}\n`;
            csv += `Collaboration Rate,${data.additional.collaboration.collaboration_rate}%\n`;
            break;
            
        case 'tech-performance':
            csv += 'Technician,Resolved,Open,Avg Resolution Hours,Avg First Response Hours,Reopen Rate\n';
            data.technicians.forEach(t => {
                csv += `"${t.tech_name}",${t.resolved},${t.open_tickets},${t.avg_resolution_hours || 'N/A'},${t.avg_first_response_hours || 'N/A'},${t.reopen_rate}%\n`;
            });
            break;
            
        case 'categories':
            csv += 'Category,Count,Percentage,Avg Resolution Hours\n';
            data.distribution.forEach(c => {
                csv += `"${c.display_name}",${c.count},${c.percentage}%,${c.avg_resolution_hours || 'N/A'}\n`;
            });
            break;
            
        default:
            csv = JSON.stringify(data);
    }
    
    return csv;
};

export default {
    clearAnalyticsCache,
    parseDateRange,
    getResolutionTimeMetrics,
    getTicketVolumeMetrics,
    getTechnicianPerformance,
    getCategoryAnalysis,
    getSLACompliance,
    getAdditionalMetrics,
    generateExportData
};
