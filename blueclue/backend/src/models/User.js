// src/models/User.js
import pool from '../config/database.js';

class User {
    /**
     * Get all technicians
     * @returns {Promise<Array>} Array of technician users
     */
    static async getTechnicians() {
        const query = `
            SELECT 
                id,
                email,
                first_name,
                last_name,
                username,
                CONCAT(first_name, ' ', last_name) as full_name
            FROM users
            WHERE role IN ('technician', 'senior_technician') AND is_active = true
            ORDER BY first_name, last_name
        `;
        
        const result = await pool.query(query);
        return result.rows;
    }

    /**
     * Get user by ID
     * @param {number} id - User ID
     * @returns {Promise<Object|null>} User object or null
     */
    static async getById(id) {
        const query = `
            SELECT 
                id,
                email,
                first_name,
                last_name,
                username,
                role,
                phone,
                company,
                is_active
            FROM users
            WHERE id = $1
        `;
        
        const result = await pool.query(query, [id]);
        return result.rows[0] || null;
    }

    /**
     * Get user by email
     * @param {string} email - User email
     * @returns {Promise<Object|null>} User object or null
     */
    static async getByEmail(email) {
        const query = `
            SELECT 
                id,
                email,
                password_hash,
                first_name,
                last_name,
                username,
                role,
                phone,
                company,
                is_active,
                force_password_change
            FROM users
            WHERE email = $1
        `;
        
        const result = await pool.query(query, [email]);
        return result.rows[0] || null;
    }
}

export default User;
