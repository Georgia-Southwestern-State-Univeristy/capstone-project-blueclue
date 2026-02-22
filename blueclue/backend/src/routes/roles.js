import express from 'express';
import { 
    getRoleDefaults, 
    getUserAccessSummary, 
    getUserOverride 
} from '../controllers/roleDefaultsController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireRole('admin'));

/**
 * @route GET /api/roles/:role/defaults
 * @desc Get default category access for a role
 * @access Admin only
 */
router.get('/:role/defaults', getRoleDefaults);

/**
 * @route GET /api/users/:userId/access-summary
 * @desc Get user's access summary (overrides vs defaults)
 * @access Admin only
 */
router.get('/users/:userId/access-summary', getUserAccessSummary);

/**
 * @route GET /api/users/:userId/categories/:categoryId/override
 * @desc Check if user has override for specific category
 * @access Admin only
 */
router.get('/users/:userId/categories/:categoryId/override', getUserOverride);

export default router;
