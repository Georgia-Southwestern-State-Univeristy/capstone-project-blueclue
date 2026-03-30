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
     * Get all users for the directory listing
     * @param {Object} options - Filter options
     * @param {string} [options.role] - Filter by role
     * @param {string} [options.search] - Search by name or email
     * @param {number} [options.currentUserId] - ID of the requesting user (for unread DM count)
     * @returns {Promise<Array>} Array of user objects
     */
    static async getAllUsers({ role, search, currentUserId } = {}) {
        const conditions = [];
        const params = [];
        let paramIndex = 1;

        // Reserve $1 for currentUserId (used in the unread subquery)
        params.push(currentUserId || null);
        paramIndex++;

        if (role) {
            conditions.push(`u.role = $${paramIndex++}`);
            params.push(role);
        }

        if (search) {
            conditions.push(`(u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR u.username ILIKE $${paramIndex})`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const query = `
            SELECT 
                u.id,
                u.email,
                u.first_name,
                u.last_name,
                u.username,
                u.first_name || ' ' || u.last_name as full_name,
                u.role,
                u.is_active,
                u.created_at,
                u.last_login,
                u.phone,
                u.company,
                u.dnd_enabled,
                u.dnd_until,
                u.timezone,
                np.quiet_hours_enabled,
                np.quiet_hours_start,
                np.quiet_hours_end,
                COALESCE((
                    SELECT COUNT(*)
                    FROM direct_messages dm
                    WHERE dm.sender_id = u.id
                      AND dm.receiver_id = $1
                      AND dm.read_at IS NULL
                ), 0)::int AS unread_messages
            FROM users u
            LEFT JOIN notification_preferences np ON np.user_id = u.id
            ${whereClause}
            ORDER BY u.first_name, u.last_name
        `;

        const result = await pool.query(query, params);
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
                timezone,
                is_active,
                created_at,
                last_login,
                dnd_enabled,
                dnd_until
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
                timezone,
                is_active,
                force_password_change
            FROM users
            WHERE LOWER(email) = LOWER($1)
        `;
        
        const result = await pool.query(query, [email]);
        return result.rows[0] || null;
    }

    /**
     * Update user profile (first name, last name)
     * @param {number} userId - User ID
     * @param {Object} fields - Fields to update
     * @param {string} fields.firstName - First name
     * @param {string} fields.lastName - Last name
     * @returns {Promise<Object>} Updated user object
     */
    static async updateProfile(userId, { firstName, lastName, phone, company, timezone }) {
        const result = await pool.query(
            `UPDATE users
             SET first_name = $2, last_name = $3, phone = $4, company = $5, timezone = $6, updated_at = NOW()
             WHERE id = $1
             RETURNING id, email, first_name, last_name, username, role, phone, company, timezone`,
            [userId, firstName, lastName, phone || null, company || null, timezone || null]
        );
        return result.rows[0] || null;
    }
}

export default User;
