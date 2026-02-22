// src/routes/categories.js
import express from 'express';
import {
    getCategoryAccess,
    grantCategoryAccess,
    revokeCategoryAccess,
    bulkGrantCategoryAccess
} from '../controllers/categoryAccessController.js';
import { getAccessibleCategories } from '../controllers/roleDefaultsController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   GET /api/categories/accessible
 * @desc    Get categories accessible to current user
 * @query   access_level - Minimum access level (view, edit, assign)
 * @access  Private (authenticated users)
 */
router.get(
    '/accessible',
    authenticateToken,
    getAccessibleCategories
);

/**
 * @route   GET /api/categories/:id/access
 * @desc    Get all users with access to a category
 * @access  Private (admin only)
 */
router.get(
    '/:id/access',
    authenticateToken,
    requireRole(['admin']),
    getCategoryAccess
);

/**
 * @route   POST /api/categories/:id/access
 * @desc    Grant category access to a user
 * @access  Private (admin only)
 */
router.post(
    '/:id/access',
    authenticateToken,
    requireRole(['admin']),
    grantCategoryAccess
);

/**
 * @route   POST /api/categories/:id/access/bulk
 * @desc    Bulk grant category access to multiple users
 * @access  Private (admin only)
 */
router.post(
    '/:id/access/bulk',
    authenticateToken,
    requireRole(['admin']),
    bulkGrantCategoryAccess
);

/**
 * @route   DELETE /api/categories/:id/access/:accessId
 * @desc    Revoke category access from a user
 * @access  Private (admin only)
 */
router.delete(
    '/:id/access/:accessId',
    authenticateToken,
    requireRole(['admin']),
    revokeCategoryAccess
);

export default router;
