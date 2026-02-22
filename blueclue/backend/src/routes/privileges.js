// src/routes/privileges.js
import express from 'express';
import {
    getUserPrivileges,
    grantPrivilege,
    revokePrivilege,
    getPrivilegeTypes,
    getUsersWithPrivilege
} from '../controllers/privilegeController.js';
import {
    getUserCategoryAccess
} from '../controllers/categoryAccessController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { checkPrivilege, checkAnyPrivilege } from '../middleware/rbac.js';

const router = express.Router();

/**
 * @route   GET /api/privileges/types
 * @desc    Get all available privilege types
 * @access  Private (authenticated users)
 */
router.get('/types', authenticateToken, getPrivilegeTypes);

/**
 * @route   GET /api/privileges/:privilegeType/users
 * @desc    Get all users with a specific privilege
 * @access  Private (admin or users with CAN_MANAGE_CATEGORIES)
 */
router.get(
    '/:privilegeType/users',
    authenticateToken,
    requireRole(['admin']),
    getUsersWithPrivilege
);

/**
 * @route   GET /api/users/:id/privileges
 * @desc    Get privileges for a specific user
 * @access  Private (user themselves, admin, or users with CAN_MANAGE_CATEGORIES)
 */
router.get('/users/:id/privileges', authenticateToken, getUserPrivileges);

/**
 * @route   POST /api/users/:id/privileges
 * @desc    Grant a privilege to a user
 * @access  Private (admin only)
 */
router.post(
    '/users/:id/privileges',
    authenticateToken,
    requireRole(['admin']),
    grantPrivilege
);

/**
 * @route   DELETE /api/users/:id/privileges/:privilegeId
 * @desc    Revoke a privilege from a user
 * @access  Private (admin only)
 */
router.delete(
    '/users/:id/privileges/:privilegeId',
    authenticateToken,
    requireRole(['admin']),
    revokePrivilege
);

/**
 * @route   GET /api/users/:id/category-access
 * @desc    Get category access for a specific user
 * @access  Private (user themselves or admin)
 */
router.get('/users/:id/category-access', authenticateToken, getUserCategoryAccess);

export default router;
