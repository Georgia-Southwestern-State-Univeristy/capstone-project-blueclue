// ============================================================================
// RBAC (Role-Based Access Control) Middleware
// ============================================================================
// Middleware for checking user privileges and category access permissions

import UserPrivilege from '../models/UserPrivilege.js';
import CategoryAccess from '../models/CategoryAccess.js';
import { UnauthorizedError, ForbiddenError, BadRequestError, InternalServerError } from './errorHandler.js';

/**
 * Check if user has a specific privilege
 * Must be used AFTER authenticateToken middleware
 * 
 * @param {string} privilegeType - Required privilege code (e.g., 'CAN_ASSIGN_TICKETS')
 * @param {object} options - Optional configuration { allowAdmin: true }
 * @returns {Function} Middleware function
 * 
 * @example
 * router.delete('/tickets/:id', authenticateToken, checkPrivilege('CAN_DELETE_TICKETS'), deleteTicket);
 */
export const checkPrivilege = (privilegeType, options = {}) => {
    const { allowAdmin = true } = options;

    return async (req, res, next) => {
        try {
            if (!req.user) {
                return next(new UnauthorizedError('Authentication required'));
            }

            // Admins and management bypass privilege checks (if enabled)
            if (allowAdmin && (req.user.role === 'admin' || req.user.role === 'management')) {
                return next();
            }

            const hasPrivilege = await UserPrivilege.hasPrivilege(req.user.id, privilegeType);

            if (!hasPrivilege) {
                return next(new ForbiddenError(`Access denied. Required privilege: ${privilegeType}`, { required_privilege: privilegeType }));
            }

            next();
        } catch (error) {
            next(new InternalServerError('Error checking user privileges'));
        }
    };
};

/**
 * Check if user has access to a specific category
 * Must be used AFTER authenticateToken middleware
 * 
 * @param {string|function} categoryIdOrGetter - Category ID or function to get category ID from request
 * @param {string} accessLevel - Required access level ('view', 'edit', 'assign')
 * @param {object} options - Optional configuration { allowAdmin: true, bypassPrivilege: 'CAN_VIEW_ALL_TICKETS' }
 * @returns {Function} Middleware function
 * 
 * @example
 * // Category ID from route params
 * router.get('/tickets/:id', authenticateToken, checkCategoryAccess((req) => req.params.categoryId, 'view'), getTicket);
 * 
 * // Category ID from request body
 * router.post('/tickets', authenticateToken, checkCategoryAccess((req) => req.body.category_id, 'edit'), createTicket);
 */
export const checkCategoryAccess = (categoryIdOrGetter, accessLevel, options = {}) => {
    const { allowAdmin = true, bypassPrivilege = null } = options;

    return async (req, res, next) => {
        try {
            if (!req.user) {
                return next(new UnauthorizedError('Authentication required'));
            }

            // Admins bypass category access checks (if enabled)
            if (allowAdmin && req.user.role === 'admin') {
                return next();
            }

            // Get category ID from parameter or getter function
            let categoryId;
            if (typeof categoryIdOrGetter === 'function') {
                categoryId = categoryIdOrGetter(req);
            } else {
                categoryId = categoryIdOrGetter;
            }

            if (!categoryId) {
                return next(new BadRequestError('Category ID is required'));
            }

            categoryId = parseInt(categoryId);
            if (isNaN(categoryId)) {
                return next(new BadRequestError('Invalid category ID'));
            }

            // Check bypass privilege if specified
            if (bypassPrivilege) {
                const hasBypassPrivilege = await UserPrivilege.hasPrivilege(req.user.id, bypassPrivilege);
                if (hasBypassPrivilege) {
                    return next();
                }
            }

            const hasAccess = await CategoryAccess.hasAccess(req.user.id, categoryId, accessLevel);

            if (!hasAccess) {
                return next(new ForbiddenError(`Access denied. Required access level: ${accessLevel} for this category`, { required_access: accessLevel, category_id: categoryId }));
            }

            next();
        } catch (error) {
            next(new InternalServerError('Error checking category access'));
        }
    };
};

/**
 * Check if user has access to any of the specified categories
 * Useful for filtering operations
 * 
 * @param {function} categoriesGetter - Function to get array of category IDs from request
 * @param {string} accessLevel - Required access level ('view', 'edit', 'assign')
 * @param {object} options - Optional configuration { allowAdmin: true, filterOnly: false }
 * @returns {Function} Middleware function
 * 
 * @example
 * router.get('/tickets', authenticateToken, checkAnyCategoryAccess((req) => req.query.categories, 'view'), getTickets);
 */
export const checkAnyCategoryAccess = (categoriesGetter, accessLevel, options = {}) => {
    const { allowAdmin = true, filterOnly = false } = options;

    return async (req, res, next) => {
        try {
            if (!req.user) {
                return next(new UnauthorizedError('Authentication required'));
            }

            // Admins bypass category access checks (if enabled)
            if (allowAdmin && req.user.role === 'admin') {
                return next();
            }

            const accessibleCategories = await CategoryAccess.getUserAccessibleCategories(
                req.user.id,
                accessLevel
            );

            // If filterOnly mode, just attach to request and continue
            if (filterOnly) {
                req.accessibleCategories = accessibleCategories;
                return next();
            }

            if (accessibleCategories.length === 0) {
                return next(new ForbiddenError('No category access found. Contact administrator for access.'));
            }

            req.accessibleCategories = accessibleCategories;
            next();
        } catch (error) {
            next(new InternalServerError('Error checking category access'));
        }
    };
};

/**
 * Combine multiple privilege checks (OR logic)
 * User needs at least one of the specified privileges
 * 
 * @param {string[]} privilegeTypes - Array of privilege codes
 * @param {object} options - Optional configuration { allowAdmin: true }
 * @returns {Function} Middleware function
 * 
 * @example
 * router.put('/tickets/:id', authenticateToken, checkAnyPrivilege(['CAN_EDIT_ANY_TICKET', 'CAN_MANAGE_CATEGORIES']), updateTicket);
 */
export const checkAnyPrivilege = (privilegeTypes, options = {}) => {
    const { allowAdmin = true } = options;

    return async (req, res, next) => {
        try {
            if (!req.user) {
                return next(new UnauthorizedError('Authentication required'));
            }

            // Admins and management bypass privilege checks (if enabled)
            if (allowAdmin && (req.user.role === 'admin' || req.user.role === 'management')) {
                return next();
            }

            const privilegeChecks = await Promise.all(
                privilegeTypes.map(type => UserPrivilege.hasPrivilege(req.user.id, type))
            );

            const hasAnyPrivilege = privilegeChecks.some(result => result === true);

            if (!hasAnyPrivilege) {
                return next(new ForbiddenError(`Access denied. Required one of: ${privilegeTypes.join(', ')}`, { required_privileges: privilegeTypes }));
            }

            next();
        } catch (error) {
            next(new InternalServerError('Error checking user privileges'));
        }
    };
};

/**
 * Combine multiple privilege checks (AND logic)
 * User needs all of the specified privileges
 * 
 * @param {string[]} privilegeTypes - Array of privilege codes
 * @param {object} options - Optional configuration { allowAdmin: true }
 * @returns {Function} Middleware function
 * 
 * @example
 * router.delete('/categories/:id', authenticateToken, checkAllPrivileges(['CAN_MANAGE_CATEGORIES', 'CAN_DELETE_TICKETS']), deleteCategory);
 */
export const checkAllPrivileges = (privilegeTypes, options = {}) => {
    const { allowAdmin = true } = options;

    return async (req, res, next) => {
        try {
            if (!req.user) {
                return next(new UnauthorizedError('Authentication required'));
            }

            // Admins and management bypass privilege checks (if enabled)
            if (allowAdmin && (req.user.role === 'admin' || req.user.role === 'management')) {
                return next();
            }

            const privilegeChecks = await Promise.all(
                privilegeTypes.map(type => UserPrivilege.hasPrivilege(req.user.id, type))
            );

            const hasAllPrivileges = privilegeChecks.every(result => result === true);

            if (!hasAllPrivileges) {
                const missingPrivileges = privilegeTypes.filter((type, index) => !privilegeChecks[index]);
                return next(new ForbiddenError(`Access denied. Missing required privileges: ${missingPrivileges.join(', ')}`, { required_privileges: privilegeTypes, missing_privileges: missingPrivileges }));
            }

            next();
        } catch (error) {
            next(new InternalServerError('Error checking user privileges'));
        }
    };
};

/**
 * Check if user has a specific role
 * Must be used AFTER authenticateToken middleware
 * 
 * @param {...string} allowedRoles - One or more allowed roles (e.g., 'admin', 'technician')
 * @returns {Function} Middleware function
 * 
 * @example
 * router.get('/admin/stats', authenticateToken, checkRole('admin'), getStats);
 * router.get('/tickets/assigned', authenticateToken, checkRole('admin', 'technician'), getAssignedTickets);
 */
export const checkRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new UnauthorizedError('Authentication required'));
        }

        if (!allowedRoles.includes(req.user.role)) {
            return next(new ForbiddenError(`Access denied. Required role(s): ${allowedRoles.join(', ')}`, { required_roles: allowedRoles, current_role: req.user.role }));
        }

        next();
    };
};
