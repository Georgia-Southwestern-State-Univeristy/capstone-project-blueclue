// ============================================================================
// Alert Rules Controller
// ============================================================================
// Manages security alert rules (CRUD operations)
// Admin-only access

import pool from '../config/database.js';

/**
 * GET /api/admin/alert-rules
 * Retrieve all alert rules
 */
export const getAllAlertRules = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                id,
                rule_name,
                rule_type,
                is_enabled,
                severity,
                parameters,
                description,
                created_by,
                updated_by,
                created_at,
                updated_at
             FROM alert_rules
             ORDER BY severity DESC, rule_name ASC`
        );

        res.json({
            success: true,
            rules: result.rows
        });
    } catch (error) {
        console.error('Error fetching alert rules:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch alert rules'
        });
    }
};

/**
 * GET /api/admin/alert-rules/:id
 * Retrieve a specific alert rule
 */
export const getAlertRuleById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT * FROM alert_rules WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Alert rule not found'
            });
        }

        res.json({
            success: true,
            rule: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching alert rule:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch alert rule'
        });
    }
};

/**
 * POST /api/admin/alert-rules
 * Create a new alert rule
 */
export const createAlertRule = async (req, res) => {
    try {
        const { rule_name, rule_type, is_enabled, severity, parameters, description } = req.body;
        const userId = req.user.id;

        // Validation
        if (!rule_name || !rule_type || !severity || !parameters) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: rule_name, rule_type, severity, parameters'
            });
        }

        const validSeverities = ['low', 'medium', 'high', 'critical'];
        if (!validSeverities.includes(severity)) {
            return res.status(400).json({
                success: false,
                message: `Invalid severity. Must be one of: ${validSeverities.join(', ')}`
            });
        }

        // Insert the new rule
        const result = await pool.query(
            `INSERT INTO alert_rules 
             (rule_name, rule_type, is_enabled, severity, parameters, description, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [rule_name, rule_type, is_enabled !== false, severity, JSON.stringify(parameters), description, userId]
        );

        res.status(201).json({
            success: true,
            message: 'Alert rule created successfully',
            rule: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating alert rule:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create alert rule'
        });
    }
};

/**
 * PATCH /api/admin/alert-rules/:id
 * Update an existing alert rule
 */
export const updateAlertRule = async (req, res) => {
    try {
        const { id } = req.params;
        const { rule_name, rule_type, is_enabled, severity, parameters, description } = req.body;
        const userId = req.user.id;

        // Check if rule exists
        const existing = await pool.query(
            `SELECT id FROM alert_rules WHERE id = $1`,
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Alert rule not found'
            });
        }

        // Validate severity if provided
        if (severity) {
            const validSeverities = ['low', 'medium', 'high', 'critical'];
            if (!validSeverities.includes(severity)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid severity. Must be one of: ${validSeverities.join(', ')}`
                });
            }
        }

        // Build dynamic update query
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (rule_name !== undefined) {
            updates.push(`rule_name = $${paramCount++}`);
            values.push(rule_name);
        }
        if (rule_type !== undefined) {
            updates.push(`rule_type = $${paramCount++}`);
            values.push(rule_type);
        }
        if (is_enabled !== undefined) {
            updates.push(`is_enabled = $${paramCount++}`);
            values.push(is_enabled);
        }
        if (severity !== undefined) {
            updates.push(`severity = $${paramCount++}`);
            values.push(severity);
        }
        if (parameters !== undefined) {
            updates.push(`parameters = $${paramCount++}`);
            values.push(JSON.stringify(parameters));
        }
        if (description !== undefined) {
            updates.push(`description = $${paramCount++}`);
            values.push(description);
        }

        // Add updated_by
        updates.push(`updated_by = $${paramCount++}`);
        values.push(userId);

        // Add id for WHERE clause
        values.push(id);

        const result = await pool.query(
            `UPDATE alert_rules 
             SET ${updates.join(', ')}
             WHERE id = $${paramCount}
             RETURNING *`,
            values
        );

        res.json({
            success: true,
            message: 'Alert rule updated successfully',
            rule: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating alert rule:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update alert rule'
        });
    }
};

/**
 * DELETE /api/admin/alert-rules/:id
 * Delete an alert rule
 */
export const deleteAlertRule = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if rule exists
        const existing = await pool.query(
            `SELECT id, rule_name FROM alert_rules WHERE id = $1`,
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Alert rule not found'
            });
        }

        // Delete the rule
        await pool.query(
            `DELETE FROM alert_rules WHERE id = $1`,
            [id]
        );

        res.json({
            success: true,
            message: `Alert rule "${existing.rows[0].rule_name}" deleted successfully`
        });
    } catch (error) {
        console.error('Error deleting alert rule:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete alert rule'
        });
    }
};

/**
 * PATCH /api/admin/alert-rules/:id/toggle
 * Quick enable/disable toggle for a rule
 */
export const toggleAlertRule = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await pool.query(
            `UPDATE alert_rules 
             SET is_enabled = NOT is_enabled,
                 updated_by = $2
             WHERE id = $1
             RETURNING id, rule_name, is_enabled`,
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Alert rule not found'
            });
        }

        const rule = result.rows[0];
        res.json({
            success: true,
            message: `Alert rule "${rule.rule_name}" ${rule.is_enabled ? 'enabled' : 'disabled'}`,
            rule
        });
    } catch (error) {
        console.error('Error toggling alert rule:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle alert rule'
        });
    }
};

export default {
    getAllAlertRules,
    getAlertRuleById,
    createAlertRule,
    updateAlertRule,
    deleteAlertRule,
    toggleAlertRule
};
