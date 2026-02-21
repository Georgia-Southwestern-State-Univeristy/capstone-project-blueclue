// src/controllers/privilegeController.js
import UserPrivilege from '../models/UserPrivilege.js';
import pool from '../config/database.js';

/**
 * Get all privileges for a specific user
 * GET /api/users/:id/privileges
 */
export const getUserPrivileges = async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        if (isNaN(userId)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid user ID'
            });
        }

        // Check if requesting user has permission
        // Users can view their own privileges, admins/managers can view any
        if (req.user.id !== userId && req.user.role !== 'admin') {
            // Check if user has privilege management permission
            const canManage = await UserPrivilege.hasPrivilege(req.user.id, 'CAN_MANAGE_CATEGORIES');
            if (!canManage) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Access denied. Cannot view other users privileges.'
                });
            }
        }

        const privileges = await UserPrivilege.getUserPrivileges(userId);

        res.json({
            status: 'success',
            data: {
                user_id: userId,
                privileges
            }
        });
    } catch (error) {
        console.error('Error fetching user privileges:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch user privileges'
        });
    }
};

/**
 * Grant a privilege to a user
 * POST /api/users/:id/privileges
 */
export const grantPrivilege = async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { privilege_type, value = 'true', notes } = req.body;

        if (isNaN(userId)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid user ID'
            });
        }

        // Validation
        if (!privilege_type) {
            return res.status(400).json({
                status: 'error',
                message: 'privilege_type is required'
            });
        }

        // Verify the privilege type exists
        const privilegeTypeCheck = await pool.query(
            'SELECT * FROM privilege_types WHERE privilege_code = $1 AND is_active = true',
            [privilege_type]
        );

        if (privilegeTypeCheck.rows.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: `Invalid privilege type: ${privilege_type}`
            });
        }

        // Verify the target user exists
        const userCheck = await pool.query(
            'SELECT id, role, first_name, last_name FROM users WHERE id = $1',
            [userId]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        // Check if privilege already exists
        const existingPrivilege = await pool.query(
            'SELECT * FROM user_privileges WHERE user_id = $1 AND privilege_type = $2 AND is_active = true',
            [userId, privilege_type]
        );

        if (existingPrivilege.rows.length > 0) {
            return res.status(409).json({
                status: 'error',
                message: 'User already has this privilege'
            });
        }

        // Grant the privilege
        const privilege = await UserPrivilege.grant({
            user_id: userId,
            privilege_type,
            value,
            granted_by: req.user.id,
            notes
        });

        res.status(201).json({
            status: 'success',
            message: 'Privilege granted successfully',
            data: privilege
        });
    } catch (error) {
        console.error('Error granting privilege:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to grant privilege'
        });
    }
};

/**
 * Revoke a privilege from a user
 * DELETE /api/users/:id/privileges/:privilegeId
 */
export const revokePrivilege = async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const privilegeId = parseInt(req.params.privilegeId);

        if (isNaN(userId) || isNaN(privilegeId)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid user ID or privilege ID'
            });
        }

        // Get the privilege to verify it belongs to the user
        const privilegeCheck = await pool.query(
            'SELECT * FROM user_privileges WHERE id = $1 AND user_id = $2',
            [privilegeId, userId]
        );

        if (privilegeCheck.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Privilege not found or does not belong to this user'
            });
        }

        // Delete the privilege
        const deletedPrivilege = await UserPrivilege.delete(privilegeId);

        res.json({
            status: 'success',
            message: 'Privilege revoked successfully',
            data: deletedPrivilege
        });
    } catch (error) {
        console.error('Error revoking privilege:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to revoke privilege'
        });
    }
};

/**
 * Get all available privilege types
 * GET /api/privileges/types
 */
export const getPrivilegeTypes = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM privilege_types WHERE is_active = true ORDER BY privilege_code'
        );

        res.json({
            status: 'success',
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching privilege types:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch privilege types'
        });
    }
};

/**
 * Get all users who have a specific privilege
 * GET /api/privileges/:privilegeType/users
 */
export const getUsersWithPrivilege = async (req, res) => {
    try {
        const { privilegeType } = req.params;

        if (!privilegeType) {
            return res.status(400).json({
                status: 'error',
                message: 'Privilege type is required'
            });
        }

        const users = await UserPrivilege.getUsersWithPrivilege(privilegeType);

        res.json({
            status: 'success',
            data: {
                privilege_type: privilegeType,
                users
            }
        });
    } catch (error) {
        console.error('Error fetching users with privilege:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch users'
        });
    }
};
