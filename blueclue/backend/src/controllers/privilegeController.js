// src/controllers/privilegeController.js
import UserPrivilege from '../models/UserPrivilege.js';
import pool from '../config/database.js';
import { BadRequestError, ForbiddenError, NotFoundError, ConflictError } from '../middleware/errorHandler.js';

/**
 * Get all privileges for a specific user
 * GET /api/users/:id/privileges
 */
export const getUserPrivileges = async (req, res) => {
        const userId = parseInt(req.params.id);

        if (isNaN(userId)) {
            throw new BadRequestError('Invalid user ID');
        }

        // Check if requesting user has permission
        // Users can view their own privileges, admins/managers can view any
        if (req.user.id !== userId && req.user.role !== 'admin') {
            // Check if user has privilege management permission
            const canManage = await UserPrivilege.hasPrivilege(req.user.id, 'CAN_MANAGE_CATEGORIES');
            if (!canManage) {
                throw new ForbiddenError('Access denied. Cannot view other users privileges.');
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
};

/**
 * Grant a privilege to a user
 * POST /api/users/:id/privileges
 */
export const grantPrivilege = async (req, res) => {
        const userId = parseInt(req.params.id);
        const { privilege_type, value = 'true', notes } = req.body;

        if (isNaN(userId)) {
            throw new BadRequestError('Invalid user ID');
        }

        // Validation
        if (!privilege_type) {
            throw new BadRequestError('privilege_type is required');
        }

        // Verify the privilege type exists
        const privilegeTypeCheck = await pool.query(
            'SELECT * FROM privilege_types WHERE privilege_code = $1 AND is_active = true',
            [privilege_type]
        );

        if (privilegeTypeCheck.rows.length === 0) {
            throw new BadRequestError(`Invalid privilege type: ${privilege_type}`);
        }

        // Verify the target user exists
        const userCheck = await pool.query(
            'SELECT id, role, first_name, last_name FROM users WHERE id = $1',
            [userId]
        );

        if (userCheck.rows.length === 0) {
            throw new NotFoundError('User not found');
        }

        // Check if privilege already exists
        const existingPrivilege = await pool.query(
            'SELECT * FROM user_privileges WHERE user_id = $1 AND privilege_type = $2 AND is_active = true',
            [userId, privilege_type]
        );

        if (existingPrivilege.rows.length > 0) {
            throw new ConflictError('User already has this privilege');
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
};

/**
 * Revoke a privilege from a user
 * DELETE /api/users/:id/privileges/:privilegeId
 */
export const revokePrivilege = async (req, res) => {
        const userId = parseInt(req.params.id);
        const privilegeId = parseInt(req.params.privilegeId);

        if (isNaN(userId) || isNaN(privilegeId)) {
            throw new BadRequestError('Invalid user ID or privilege ID');
        }

        // Get the privilege to verify it belongs to the user
        const privilegeCheck = await pool.query(
            'SELECT * FROM user_privileges WHERE id = $1 AND user_id = $2',
            [privilegeId, userId]
        );

        if (privilegeCheck.rows.length === 0) {
            throw new NotFoundError('Privilege not found or does not belong to this user');
        }

        // Delete the privilege
        const deletedPrivilege = await UserPrivilege.delete(privilegeId);

        res.json({
            status: 'success',
            message: 'Privilege revoked successfully',
            data: deletedPrivilege
        });
};

/**
 * Get all available privilege types
 * GET /api/privileges/types
 */
export const getPrivilegeTypes = async (req, res) => {
        const result = await pool.query(
            'SELECT * FROM privilege_types WHERE is_active = true ORDER BY privilege_code'
        );

        res.json({
            status: 'success',
            data: result.rows
        });
};

/**
 * Get all users who have a specific privilege
 * GET /api/privileges/:privilegeType/users
 */
export const getUsersWithPrivilege = async (req, res) => {
        const { privilegeType } = req.params;

        if (!privilegeType) {
            throw new BadRequestError('Privilege type is required');
        }

        const users = await UserPrivilege.getUsersWithPrivilege(privilegeType);

        res.json({
            status: 'success',
            data: {
                privilege_type: privilegeType,
                users
            }
        });
};
