// src/controllers/categoryAccessController.js
import CategoryAccess from '../models/CategoryAccess.js';
import pool from '../config/database.js';

/**
 * Get all users with access to a category
 * GET /api/categories/:id/access
 */
export const getCategoryAccess = async (req, res) => {
    try {
        const categoryId = parseInt(req.params.id);

        if (isNaN(categoryId)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid category ID'
            });
        }

        // Verify category exists
        const categoryCheck = await pool.query(
            'SELECT id, name, display_name FROM categories WHERE id = $1',
            [categoryId]
        );

        if (categoryCheck.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Category not found'
            });
        }

        const users = await CategoryAccess.getCategoryUsers(categoryId);

        res.json({
            status: 'success',
            data: {
                category_id: categoryId,
                category_name: categoryCheck.rows[0].display_name,
                users
            }
        });
    } catch (error) {
        console.error('Error fetching category access:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch category access'
        });
    }
};

/**
 * Grant category access to a user
 * POST /api/categories/:id/access
 */
export const grantCategoryAccess = async (req, res) => {
    try {
        const categoryId = parseInt(req.params.id);
        const { user_id, access_level, notes } = req.body;

        if (isNaN(categoryId)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid category ID'
            });
        }

        // Validation
        if (!user_id) {
            return res.status(400).json({
                status: 'error',
                message: 'user_id is required'
            });
        }

        if (!access_level) {
            return res.status(400).json({
                status: 'error',
                message: 'access_level is required'
            });
        }

        // Validate access level
        const validAccessLevels = ['view', 'edit', 'assign'];
        if (!validAccessLevels.includes(access_level)) {
            return res.status(400).json({
                status: 'error',
                message: `Invalid access level. Must be one of: ${validAccessLevels.join(', ')}`
            });
        }

        // Verify category exists
        const categoryCheck = await pool.query(
            'SELECT * FROM categories WHERE id = $1',
            [categoryId]
        );

        if (categoryCheck.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Category not found'
            });
        }

        // Verify user exists
        const userCheck = await pool.query(
            'SELECT id, role, first_name, last_name FROM users WHERE id = $1',
            [user_id]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        // Grant the access
        const access = await CategoryAccess.grant({
            user_id,
            category_id: categoryId,
            access_level,
            granted_by: req.user.id,
            notes
        });

        res.status(201).json({
            status: 'success',
            message: 'Category access granted successfully',
            data: access
        });
    } catch (error) {
        console.error('Error granting category access:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to grant category access'
        });
    }
};

/**
 * Revoke category access from a user
 * DELETE /api/categories/:id/access/:accessId
 */
export const revokeCategoryAccess = async (req, res) => {
    try {
        const categoryId = parseInt(req.params.id);
        const accessId = parseInt(req.params.accessId);

        if (isNaN(categoryId) || isNaN(accessId)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid category ID or access ID'
            });
        }

        // Get the access record to verify it belongs to the category
        const accessCheck = await pool.query(
            'SELECT * FROM category_access WHERE id = $1 AND category_id = $2',
            [accessId, categoryId]
        );

        if (accessCheck.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Access record not found or does not belong to this category'
            });
        }

        // Delete the access record
        const deletedAccess = await CategoryAccess.delete(accessId);

        res.json({
            status: 'success',
            message: 'Category access revoked successfully',
            data: deletedAccess
        });
    } catch (error) {
        console.error('Error revoking category access:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to revoke category access'
        });
    }
};

/**
 * Get all category access for a specific user
 * GET /api/users/:id/category-access
 */
export const getUserCategoryAccess = async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        if (isNaN(userId)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid user ID'
            });
        }

        // Check if requesting user has permission
        if (req.user.id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied. Cannot view other users category access.'
            });
        }

        const access = await CategoryAccess.getUserCategoryAccess(userId);

        res.json({
            status: 'success',
            data: {
                user_id: userId,
                category_access: access
            }
        });
    } catch (error) {
        console.error('Error fetching user category access:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch category access'
        });
    }
};

/**
 * Bulk grant category access to multiple users
 * POST /api/categories/:id/access/bulk
 */
export const bulkGrantCategoryAccess = async (req, res) => {
    try {
        const categoryId = parseInt(req.params.id);
        const { user_ids, access_level, notes } = req.body;

        if (isNaN(categoryId)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid category ID'
            });
        }

        if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'user_ids array is required'
            });
        }

        if (!access_level) {
            return res.status(400).json({
                status: 'error',
                message: 'access_level is required'
            });
        }

        // Validate access level
        const validAccessLevels = ['view', 'edit', 'assign'];
        if (!validAccessLevels.includes(access_level)) {
            return res.status(400).json({
                status: 'error',
                message: `Invalid access level. Must be one of: ${validAccessLevels.join(', ')}`
            });
        }

        // Verify category exists
        const categoryCheck = await pool.query(
            'SELECT * FROM categories WHERE id = $1',
            [categoryId]
        );

        if (categoryCheck.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Category not found'
            });
        }

        // Grant access to all users
        const results = [];
        const errors = [];

        for (const userId of user_ids) {
            try {
                const access = await CategoryAccess.grant({
                    user_id: userId,
                    category_id: categoryId,
                    access_level,
                    granted_by: req.user.id,
                    notes
                });
                results.push(access);
            } catch (error) {
                errors.push({
                    user_id: userId,
                    error: error.message
                });
            }
        }

        res.status(201).json({
            status: 'success',
            message: `Category access granted to ${results.length} user(s)`,
            data: {
                granted: results,
                errors: errors.length > 0 ? errors : undefined
            }
        });
    } catch (error) {
        console.error('Error bulk granting category access:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to grant category access'
        });
    }
};
