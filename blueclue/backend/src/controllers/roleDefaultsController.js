import CategoryAccess from '../models/CategoryAccess.js';
import { BadRequestError } from '../middleware/errorHandler.js';

/**
 * Get role-based default category access for a specific role
 * @route GET /api/roles/:role/defaults
 * @access Admin only
 */
export const getRoleDefaults = async (req, res) => {
        const { role } = req.params;
        
        // Validate role
        const validRoles = ['customer', 'technician', 'admin'];
        if (!validRoles.includes(role)) {
            throw new BadRequestError('Invalid role. Must be: customer, technician, or admin');
        }

        const defaults = await CategoryAccess.getRoleDefaults(role);

        res.status(200).json({
            success: true,
            role,
            defaults
        });
};

/**
 * Get user access summary (overrides vs defaults)
 * @route GET /api/users/:userId/access-summary
 * @access Admin only
 */
export const getUserAccessSummary = async (req, res) => {
        const { userId } = req.params;

        const summary = await CategoryAccess.getUserAccessSummary(parseInt(userId));

        res.status(200).json({
            success: true,
            user_id: parseInt(userId),
            overrides: summary.overrides,
            defaults: summary.defaults,
            total_access: summary.overrides.length + summary.defaults.length
        });
};

/**
 * Check if user has override for a specific category
 * @route GET /api/users/:userId/categories/:categoryId/override
 * @access Admin only
 */
export const getUserOverride = async (req, res) => {
        const { userId, categoryId } = req.params;

        const override = await CategoryAccess.getUserOverride(
            parseInt(userId), 
            parseInt(categoryId)
        );

        if (!override) {
            return res.status(200).json({
                success: true,
                has_override: false,
                message: 'User has no override for this category (using role defaults)'
            });
        }

        res.status(200).json({
            success: true,
            has_override: true,
            override
        });
};

/**
 * Get accessible categories for current user
 * @route GET /api/categories/accessible
 * @query access_level - Minimum access level required (view, edit, assign)
 * @access Authenticated users
 */
export const getAccessibleCategories = async (req, res) => {
        const userId = req.user.id;
        const accessLevel = req.query.access_level || 'view';

        // Validate access level
        const validLevels = ['view', 'edit', 'assign'];
        if (!validLevels.includes(accessLevel)) {
            throw new BadRequestError('Invalid access_level. Must be: view, edit, or assign');
        }

        const categories = await CategoryAccess.getUserAccessibleCategories(userId, accessLevel);

        res.status(200).json({
            success: true,
            access_level: accessLevel,
            categories
        });
};
