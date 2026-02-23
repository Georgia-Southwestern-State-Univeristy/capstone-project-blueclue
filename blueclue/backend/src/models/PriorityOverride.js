// src/models/PriorityOverride.js
import pool from '../config/database.js';

class PriorityOverride {
    /**
     * Create a new priority override record
     * @param {Object} data - Override data
     * @returns {Promise<Object>} Created override record
     */
    static async create(data) {
        const {
            ticket_id,
            user_id,
            user_priority,
            ai_recommended_priority,
            final_priority,
            ai_confidence,
            confidence_level,
            override_reason,
            significant_difference
        } = data;

        const query = `
            INSERT INTO priority_overrides (
                ticket_id, user_id, user_priority, ai_recommended_priority, 
                final_priority, ai_confidence, confidence_level, 
                override_reason, significant_difference
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `;

        const values = [
            ticket_id,
            user_id,
            user_priority,
            ai_recommended_priority,
            final_priority,
            ai_confidence,
            confidence_level,
            override_reason || null,
            significant_difference || false
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /**
     * Get overrides by ticket ID
     * @param {number} ticketId 
     * @returns {Promise<Array>} Override records
     */
    static async getByTicketId(ticketId) {
        const query = `
            SELECT po.*, u.username 
            FROM priority_overrides po
            JOIN users u ON po.user_id = u.id
            WHERE po.ticket_id = $1
            ORDER BY po.created_at DESC
        `;
        
        const result = await pool.query(query, [ticketId]);
        return result.rows;
    }

    /**
     * Get overrides by user ID
     * @param {number} userId 
     * @param {number} limit 
     * @returns {Promise<Array>} Override records
     */
    static async getByUserId(userId, limit = 50) {
        const query = `
            SELECT po.*, t.ticket_number, t.subject
            FROM priority_overrides po
            JOIN tickets t ON po.ticket_id = t.id
            WHERE po.user_id = $1
            ORDER BY po.created_at DESC
            LIMIT $2
        `;
        
        const result = await pool.query(query, [userId, limit]);
        return result.rows;
    }

    /**
     * Get override statistics
     * @returns {Promise<Object>} Statistics summary
     */
    static async getStatistics() {
        const query = `
            SELECT 
                COUNT(*) as total_overrides,
                AVG(ai_confidence) as avg_confidence,
                COUNT(CASE WHEN significant_difference THEN 1 END) as significant_overrides,
                COUNT(CASE WHEN confidence_level = 'high' THEN 1 END) as high_confidence_overrides,
                COUNT(CASE WHEN confidence_level = 'medium' THEN 1 END) as medium_confidence_overrides,
                COUNT(CASE WHEN confidence_level = 'low' THEN 1 END) as low_confidence_overrides,
                COUNT(CASE WHEN final_priority = ai_recommended_priority THEN 1 END) as ai_accepted,
                COUNT(CASE WHEN final_priority = user_priority THEN 1 END) as user_accepted
            FROM priority_overrides
        `;
        
        const result = await pool.query(query);
        return result.rows[0];
    }

    /**
     * Get analytics from view
     * @returns {Promise<Array>} Analytics data
     */
    static async getAnalytics() {
        const query = `SELECT * FROM v_priority_analytics ORDER BY override_count DESC`;
        const result = await pool.query(query);
        return result.rows;
    }

    /**
     * Get user override frequency
     * @param {number} limit - Number of users to return
     * @returns {Promise<Array>} Users with override counts
     */
    static async getUserOverrideFrequency(limit = 20) {
        const query = `
            SELECT 
                u.id,
                u.username,
                u.email,
                COUNT(po.id) as override_count,
                AVG(po.ai_confidence) as avg_ai_confidence_overridden,
                COUNT(CASE WHEN po.significant_difference THEN 1 END) as significant_overrides,
                COUNT(CASE WHEN po.confidence_level = 'high' THEN 1 END) as high_confidence_overrides
            FROM users u
            INNER JOIN priority_overrides po ON u.id = po.user_id
            GROUP BY u.id, u.username, u.email
            ORDER BY override_count DESC
            LIMIT $1
        `;
        
        const result = await pool.query(query, [limit]);
        return result.rows;
    }
}

export default PriorityOverride;
