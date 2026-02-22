// src/models/UserPrivilege.js
import pool from '../config/database.js';

class UserPrivilege {
    /**
     * Grant a privilege to a user
     * @param {Object} privilegeData - { user_id, privilege_type, value, granted_by, notes }
     * @returns {Promise<Object>} Created privilege record
     */
    static async grant({ user_id, privilege_type, value = 'true', granted_by, notes = null }) {
        const query = `
            INSERT INTO user_privileges (user_id, privilege_type, value, granted_by, notes, is_active)
            VALUES ($1, $2, $3, $4, $5, true)
            RETURNING *
        `;
        
        const values = [user_id, privilege_type, value, granted_by, notes];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /**
     * Revoke a privilege from a user
     * @param {Number} userId - User ID
     * @param {String} privilegeType - Privilege type code
     * @returns {Promise<Object>} Updated privilege record
     */
    static async revoke(userId, privilegeType) {
        const query = `
            UPDATE user_privileges
            SET is_active = false, revoked_at = CURRENT_TIMESTAMP
            WHERE user_id = $1 AND privilege_type = $2 AND is_active = true
            RETURNING *
        `;
        
        const result = await pool.query(query, [userId, privilegeType]);
        return result.rows[0];
    }

    /**
     * Check if a user has a specific privilege
     * @param {Number} userId - User ID
     * @param {String} privilegeType - Privilege type code
     * @returns {Promise<Boolean>} True if user has the privilege
     */
    static async hasPrivilege(userId, privilegeType) {
        const query = `
            SELECT EXISTS(
                SELECT 1 FROM user_privileges
                WHERE user_id = $1 
                AND privilege_type = $2 
                AND is_active = true
                AND value = 'true'
            ) as has_privilege
        `;
        
        const result = await pool.query(query, [userId, privilegeType]);
        return result.rows[0].has_privilege;
    }

    /**
     * Get all active privileges for a user
     * @param {Number} userId - User ID
     * @returns {Promise<Array>} Array of privilege records
     */
    static async getUserPrivileges(userId) {
        const query = `
            SELECT 
                up.*,
                pt.display_name,
                pt.description,
                u.first_name || ' ' || u.last_name as granted_by_name
            FROM user_privileges up
            LEFT JOIN privilege_types pt ON up.privilege_type = pt.privilege_code
            LEFT JOIN users u ON up.granted_by = u.id
            WHERE up.user_id = $1 AND up.is_active = true
            ORDER BY up.granted_at DESC
        `;
        
        const result = await pool.query(query, [userId]);
        return result.rows;
    }

    /**
     * Get all users with a specific privilege
     * @param {String} privilegeType - Privilege type code
     * @returns {Promise<Array>} Array of users with the privilege
     */
    static async getUsersWithPrivilege(privilegeType) {
        const query = `
            SELECT 
                u.id,
                u.email,
                u.first_name,
                u.last_name,
                u.role,
                up.value,
                up.granted_at
            FROM user_privileges up
            JOIN users u ON up.user_id = u.id
            WHERE up.privilege_type = $1 
            AND up.is_active = true
            AND u.is_active = true
            ORDER BY up.granted_at DESC
        `;
        
        const result = await pool.query(query, [privilegeType]);
        return result.rows;
    }

    /**
     * Delete a privilege record
     * @param {Number} privilegeId - Privilege record ID
     * @returns {Promise<Object>} Deleted privilege record
     */
    static async delete(privilegeId) {
        const query = `
            DELETE FROM user_privileges
            WHERE id = $1
            RETURNING *
        `;
        
        const result = await pool.query(query, [privilegeId]);
        return result.rows[0];
    }
}

export default UserPrivilege;
