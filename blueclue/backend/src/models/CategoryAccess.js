// src/models/CategoryAccess.js
import pool from '../config/database.js';

class CategoryAccess {
    /**
     * Grant category access to a user
     * @param {Object} accessData - { user_id, category_id, access_level, granted_by, notes }
     * @returns {Promise<Object>} Created access record
     */
    static async grant({ user_id, category_id, access_level, granted_by, notes = null }) {
        const query = `
            INSERT INTO category_access (user_id, category_id, access_level, granted_by, notes, is_active)
            VALUES ($1, $2, $3, $4, $5, true)
            ON CONFLICT (user_id, category_id, access_level) 
            DO UPDATE SET is_active = true, granted_at = CURRENT_TIMESTAMP, revoked_at = NULL
            RETURNING *
        `;
        
        const values = [user_id, category_id, access_level, granted_by, notes];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /**
     * Revoke category access from a user
     * @param {Number} userId - User ID
     * @param {Number} categoryId - Category ID
     * @param {String} accessLevel - Access level ('view', 'edit', 'assign')
     * @returns {Promise<Object>} Updated access record
     */
    static async revoke(userId, categoryId, accessLevel) {
        const query = `
            UPDATE category_access
            SET is_active = false, revoked_at = CURRENT_TIMESTAMP
            WHERE user_id = $1 AND category_id = $2 AND access_level = $3 AND is_active = true
            RETURNING *
        `;
        
        const result = await pool.query(query, [userId, categoryId, accessLevel]);
        return result.rows[0];
    }

    /**
     * Check if a user has category access
     * Checks user-specific access first, then falls back to role-based defaults
     * @param {Number} userId - User ID
     * @param {Number} categoryId - Category ID
     * @param {String} accessLevel - Access level ('view', 'edit', 'assign')
     * @returns {Promise<Boolean>} True if user has access
     */
    static async hasAccess(userId, categoryId, accessLevel) {
        // Check for specific access level or higher
        // Access hierarchy: view < edit < assign
        const accessHierarchy = {
            'view': ['view', 'edit', 'assign'],
            'edit': ['edit', 'assign'],
            'assign': ['assign']
        };

        const allowedLevels = accessHierarchy[accessLevel] || [accessLevel];

        // First, check for user-specific category access (overrides)
        const userAccessQuery = `
            SELECT EXISTS(
                SELECT 1 FROM category_access
                WHERE user_id = $1 
                AND category_id = $2 
                AND access_level = ANY($3::access_level[])
                AND is_active = true
            ) as has_access
        `;
        
        const userAccessResult = await pool.query(userAccessQuery, [userId, categoryId, allowedLevels]);
        
        if (userAccessResult.rows[0].has_access) {
            return true;
        }

        // If no user-specific access, check role-based defaults
        const roleQuery = `SELECT role FROM users WHERE id = $1`;
        const roleResult = await pool.query(roleQuery, [userId]);
        
        if (roleResult.rows.length === 0) {
            return false;
        }
        
        const userRole = roleResult.rows[0].role;
        
        const defaultAccessQuery = `
            SELECT EXISTS(
                SELECT 1 FROM role_category_defaults
                WHERE role = $1
                AND category_id = $2
                AND access_level = ANY($3::access_level[])
                AND is_active = true
            ) as has_default_access
        `;
        
        const defaultAccessResult = await pool.query(defaultAccessQuery, [userRole, categoryId, allowedLevels]);
        return defaultAccessResult.rows[0].has_default_access;
    }

    /**
     * Get all active category access for a user
     * @param {Number} userId - User ID
     * @returns {Promise<Array>} Array of access records
     */
    static async getUserCategoryAccess(userId) {
        const query = `
            SELECT 
                ca.*,
                c.name as category_name,
                c.display_name as category_display_name,
                u.first_name || ' ' || u.last_name as granted_by_name
            FROM category_access ca
            JOIN categories c ON ca.category_id = c.id
            LEFT JOIN users u ON ca.granted_by = u.id
            WHERE ca.user_id = $1 AND ca.is_active = true
            ORDER BY c.display_name, ca.access_level
        `;
        
        const result = await pool.query(query, [userId]);
        return result.rows;
    }

    /**
     * Get all users with access to a specific category
     * @param {Number} categoryId - Category ID
     * @returns {Promise<Array>} Array of users with access
     */
    static async getCategoryUsers(categoryId) {
        const query = `
            SELECT 
                u.id,
                u.email,
                u.first_name,
                u.last_name,
                u.role,
                ca.access_level,
                ca.granted_at
            FROM category_access ca
            JOIN users u ON ca.user_id = u.id
            WHERE ca.category_id = $1 
            AND ca.is_active = true
            AND u.is_active = true
            ORDER BY u.last_name, u.first_name, ca.access_level
        `;
        
        const result = await pool.query(query, [categoryId]);
        return result.rows;
    }

    /**
     * Get categories accessible by a user with specified access level
     * Includes both user-specific access and role-based defaults
     * @param {Number} userId - User ID
     * @param {String} accessLevel - Minimum access level ('view', 'edit', 'assign')
     * @returns {Promise<Array>} Array of category IDs
     */
    static async getUserAccessibleCategories(userId, accessLevel = 'view') {
        const accessHierarchy = {
            'view': ['view', 'edit', 'assign'],
            'edit': ['edit', 'assign'],
            'assign': ['assign']
        };

        const allowedLevels = accessHierarchy[accessLevel] || [accessLevel];

        // Get user's role
        const roleQuery = `SELECT role FROM users WHERE id = $1`;
        const roleResult = await pool.query(roleQuery, [userId]);
        
        if (roleResult.rows.length === 0) {
            return [];
        }
        
        const userRole = roleResult.rows[0].role;

        // Get both user-specific access and role-based defaults
        const query = `
            SELECT DISTINCT category_id
            FROM (
                -- User-specific access (overrides)
                SELECT category_id
                FROM category_access
                WHERE user_id = $1 
                AND access_level = ANY($2::access_level[])
                AND is_active = true
                
                UNION
                
                -- Role-based defaults
                SELECT category_id
                FROM role_category_defaults
                WHERE role = $3
                AND access_level = ANY($2::access_level[])
                AND is_active = true
            ) combined_access
        `;
        
        const result = await pool.query(query, [userId, allowedLevels, userRole]);
        return result.rows.map(row => row.category_id);
    }

    /**
     * Delete a category access record
     * @param {Number} accessId - Access record ID
     * @returns {Promise<Object>} Deleted access record
     */
    static async delete(accessId) {
        const query = `
            DELETE FROM category_access
            WHERE id = $1
            RETURNING *
        `;
        
        const result = await pool.query(query, [accessId]);
        return result.rows[0];
    }

    /**
     * Get role-based default category access for a specific role
     * @param {String} role - User role ('customer', 'technician', 'admin')
     * @returns {Promise<Array>} Array of default access records
     */
    static async getRoleDefaults(role) {
        const query = `
            SELECT 
                rcd.id,
                rcd.role,
                rcd.category_id,
                c.name as category_name,
                rcd.access_level,
                rcd.created_at,
                rcd.notes
            FROM role_category_defaults rcd
            JOIN categories c ON rcd.category_id = c.id
            WHERE rcd.role = $1
            AND rcd.is_active = true
            ORDER BY c.name, rcd.access_level
        `;
        
        const result = await pool.query(query, [role]);
        return result.rows;
    }

    /**
     * Check if a user has a specific override (user-specific access)
     * Returns null if no override exists (will use role defaults)
     * @param {Number} userId - User ID
     * @param {Number} categoryId - Category ID
     * @returns {Promise<Object|null>} Override record or null
     */
    static async getUserOverride(userId, categoryId) {
        const query = `
            SELECT 
                id,
                user_id,
                category_id,
                access_level,
                granted_at,
                granted_by,
                notes
            FROM category_access
            WHERE user_id = $1
            AND category_id = $2
            AND is_active = true
        `;
        
        const result = await pool.query(query, [userId, categoryId]);
        return result.rows[0] || null;
    }

    /**
     * Get categories with user overrides vs role defaults
     * Useful for displaying what access is custom vs inherited
     * @param {Number} userId - User ID
     * @returns {Promise<Object>} Object with overrides and defaults arrays
     */
    static async getUserAccessSummary(userId) {
        const query = `
            SELECT role FROM users WHERE id = $1
        `;
        const roleResult = await pool.query(query, [userId]);
        
        if (roleResult.rows.length === 0) {
            return { overrides: [], defaults: [] };
        }
        
        const userRole = roleResult.rows[0].role;

        const overridesQuery = `
            SELECT 
                ca.id,
                ca.category_id,
                c.name as category_name,
                ca.access_level,
                ca.granted_at,
                ca.granted_by
            FROM category_access ca
            JOIN categories c ON ca.category_id = c.id
            WHERE ca.user_id = $1
            AND ca.is_active = true
            ORDER BY c.name
        `;

        const defaultsQuery = `
            SELECT 
                rcd.category_id,
                c.name as category_name,
                rcd.access_level
            FROM role_category_defaults rcd
            JOIN categories c ON rcd.category_id = c.id
            WHERE rcd.role = $1
            AND rcd.is_active = true
            AND NOT EXISTS (
                SELECT 1 FROM category_access ca
                WHERE ca.user_id = $2
                AND ca.category_id = rcd.category_id
                AND ca.is_active = true
            )
            ORDER BY c.name
        `;

        const [overridesResult, defaultsResult] = await Promise.all([
            pool.query(overridesQuery, [userId]),
            pool.query(defaultsQuery, [userRole, userId])
        ]);

        return {
            overrides: overridesResult.rows,
            defaults: defaultsResult.rows
        };
    }
}

export default CategoryAccess;
