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
                u.id,
                u.email,
                u.first_name,
                u.last_name,
                u.username,
                u.first_name || ' ' || u.last_name as full_name,
                COUNT(t.id) FILTER (WHERE t.status NOT IN ('resolved', 'closed', 'cancelled')) as open_ticket_count
            FROM users u
            LEFT JOIN tickets t ON t.assigned_to = u.id
            WHERE u.role IN ('technician', 'senior_technician') AND u.is_active = true
            GROUP BY u.id, u.email, u.first_name, u.last_name, u.username
            ORDER BY u.first_name, u.last_name
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
     * Get user by email (case-insensitive)
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
            WHERE LOWER(email) = LOWER($1)
        `;
        
        const result = await pool.query(query, [email]);
        return result.rows[0] || null;
    }
}

export default User;
