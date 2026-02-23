// ============================================================================
// Audit Trail Controller
// ============================================================================
// Handles querying of privilege and category access audit logs
// Provides comprehensive audit trail for security and compliance

import pool from '../config/database.js';

// ============================================================================
// GET /api/audit/privileges
// Get audit log for privilege changes (admin/management only)
// ============================================================================
export const getPrivilegeAuditLog = async (req, res) => {
    try {
        const { user_id, table_name, action, limit = 100, offset = 0 } = req.query;
        const userRole = req.user.role;

        // Only admin and management can view audit logs
        if (userRole !== 'admin' && userRole !== 'management') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only administrators and management can view audit logs.'
            });
        }

        // Build query with filters
        let query = `
            SELECT 
                pal.*,
                u.username as affected_user,
                u.email as affected_email,
                cb.username as changed_by_username,
                cb.email as changed_by_email
            FROM privilege_audit_log pal
            LEFT JOIN users u ON pal.user_id = u.id
            LEFT JOIN users cb ON pal.changed_by = cb.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        // Filter by user_id
        if (user_id) {
            query += ` AND pal.user_id = $${paramCount}`;
            params.push(user_id);
            paramCount++;
        }

        // Filter by table_name
        if (table_name) {
            query += ` AND pal.table_name = $${paramCount}`;
            params.push(table_name);
            paramCount++;
        }

        // Filter by action
        if (action) {
            query += ` AND pal.action = $${paramCount}`;
            params.push(action);
            paramCount++;
        }

        // Order and pagination
        query += ` ORDER BY pal.changed_at DESC
                   LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, params);

        // Get total count for pagination
        let countQuery = `SELECT COUNT(*) FROM privilege_audit_log WHERE 1=1`;
        const countParams = [];
        let countParamIndex = 1;

        if (user_id) {
            countQuery += ` AND user_id = $${countParamIndex}`;
            countParams.push(user_id);
            countParamIndex++;
        }
        if (table_name) {
            countQuery += ` AND table_name = $${countParamIndex}`;
            countParams.push(table_name);
            countParamIndex++;
        }
        if (action) {
            countQuery += ` AND action = $${countParamIndex}`;
            countParams.push(action);
        }

        const countResult = await pool.query(countQuery, countParams);
        const totalCount = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                total: totalCount,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: (parseInt(offset) + result.rows.length) < totalCount
            }
        });

    } catch (error) {
        console.error('Error fetching privilege audit log:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch audit log',
            error: error.message
        });
    }
};

// ============================================================================
// GET /api/audit/privileges/user/:userId
// Get audit log for a specific user (admin/management only)
// ============================================================================
export const getUserAuditLog = async (req, res) => {
    try {
        const { userId } = req.params;
        const userRole = req.user.role;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        // Only admin and management can view audit logs
        if (userRole !== 'admin' && userRole !== 'management') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only administrators and management can view audit logs.'
            });
        }

        const query = `
            SELECT 
                pal.*,
                u.username as affected_user,
                u.first_name || ' ' || u.last_name as affected_user_fullname,
                u.email as affected_email,
                cb.username as changed_by_username,
                cb.first_name || ' ' || cb.last_name as changed_by_fullname
            FROM privilege_audit_log pal
            LEFT JOIN users u ON pal.user_id = u.id
            LEFT JOIN users cb ON pal.changed_by = cb.id
            WHERE pal.user_id = $1
            ORDER BY pal.changed_at DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await pool.query(query, [userId, limit, offset]);

        // Get total count
        const countResult = await pool.query(
            'SELECT COUNT(*) FROM privilege_audit_log WHERE user_id = $1',
            [userId]
        );
        const totalCount = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                total: totalCount,
                limit,
                offset,
                hasMore: (offset + result.rows.length) < totalCount
            }
        });

    } catch (error) {
        console.error('Error fetching user audit log:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user audit log',
            error: error.message
        });
    }
};

// ============================================================================
// GET /api/audit/privileges/recent
// Get recent privilege changes (last 24 hours) - admin/management only
// ============================================================================
export const getRecentAuditLog = async (req, res) => {
    try {
        const userRole = req.user.role;
        const hours = parseInt(req.query.hours) || 24;
        const limit = parseInt(req.query.limit) || 100;

        // Only admin and management can view audit logs
        if (userRole !== 'admin' && userRole !== 'management') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only administrators and management can view audit logs.'
            });
        }

        const query = `
            SELECT 
                pal.*,
                u.username as affected_user,
                u.email as affected_email,
                cb.username as changed_by_username,
                cb.first_name || ' ' || cb.last_name as changed_by_fullname
            FROM privilege_audit_log pal
            LEFT JOIN users u ON pal.user_id = u.id
            LEFT JOIN users cb ON pal.changed_by = cb.id
            WHERE pal.changed_at > NOW() - INTERVAL '${hours} hours'
            ORDER BY pal.changed_at DESC
            LIMIT $1
        `;

        const result = await pool.query(query, [limit]);

        res.json({
            success: true,
            data: result.rows,
            timeframe: `Last ${hours} hours`,
            count: result.rows.length
        });

    } catch (error) {
        console.error('Error fetching recent audit log:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch recent audit log',
            error: error.message
        });
    }
};

// ============================================================================
// GET /api/audit/privileges/summary
// Get audit summary statistics - admin/management only
// ============================================================================
export const getAuditSummary = async (req, res) => {
    try {
        const userRole = req.user.role;

        // Only admin and management can view audit logs
        if (userRole !== 'admin' && userRole !== 'management') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only administrators and management can view audit logs.'
            });
        }

        // Get summary statistics
        const summaryQuery = `
            SELECT 
                table_name,
                action,
                COUNT(*) as count,
                MAX(changed_at) as last_change
            FROM privilege_audit_log
            WHERE changed_at > NOW() - INTERVAL '30 days'
            GROUP BY table_name, action
            ORDER BY table_name, action
        `;

        const mostActiveQuery = `
            SELECT 
                cb.username,
                cb.first_name || ' ' || cb.last_name as fullname,
                COUNT(*) as change_count
            FROM privilege_audit_log pal
            JOIN users cb ON pal.changed_by = cb.id
            WHERE pal.changed_at > NOW() - INTERVAL '30 days'
            GROUP BY cb.id, cb.username, cb.first_name, cb.last_name
            ORDER BY change_count DESC
            LIMIT 10
        `;

        const [summaryResult, mostActiveResult] = await Promise.all([
            pool.query(summaryQuery),
            pool.query(mostActiveQuery)
        ]);

        res.json({
            success: true,
            summary: summaryResult.rows,
            mostActiveAdmins: mostActiveResult.rows,
            timeframe: 'Last 30 days'
        });

    } catch (error) {
        console.error('Error fetching audit summary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch audit summary',
            error: error.message
        });
    }
};
