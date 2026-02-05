// src/models/AIClassification.js
import pool from '../config/database.js';

class AIClassification {
    /**
     * Create a new AI classification record
     * @param {Object} data - { ticket_id, predicted_category, predicted_priority, confidence, keywords_matched, fallback_used }
     * @returns {Promise<Object>} Created classification record
     */
    static async create({ 
        ticket_id, 
        predicted_category, 
        predicted_priority, 
        confidence,
        keywords_matched = null,
        fallback_used = false
    }) {
        const query = `
            INSERT INTO ai_classifications (
                ticket_id, predicted_category, predicted_priority, 
                confidence, keywords_matched, fallback_used
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        
        const values = [
            ticket_id,
            predicted_category,
            predicted_priority,
            confidence,
            keywords_matched ? JSON.stringify(keywords_matched) : null,
            fallback_used
        ];
        
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /**
     * Get classification by ticket ID
     * @param {number} ticketId - Ticket ID
     * @returns {Promise<Object|null>} Classification record or null
     */
    static async getByTicketId(ticketId) {
        const query = `
            SELECT * FROM ai_classifications
            WHERE ticket_id = $1
        `;
        
        const result = await pool.query(query, [ticketId]);
        return result.rows[0] || null;
    }

    /**
     * Get all classifications
     * @returns {Promise<Array>} Array of classification records
     */
    static async getAll() {
        const query = `
            SELECT 
                ac.*,
                t.ticket_number,
                t.subject
            FROM ai_classifications ac
            JOIN tickets t ON ac.ticket_id = t.id
            ORDER BY ac.created_at DESC
        `;
        
        const result = await pool.query(query);
        return result.rows;
    }

    /**
     * Get classification statistics
     * @returns {Promise<Object>} Statistics about AI classifications
     */
    static async getStatistics() {
        const query = `
            SELECT 
                COUNT(*) as total_classifications,
                AVG(confidence) as avg_confidence,
                COUNT(CASE WHEN fallback_used = true THEN 1 END) as fallback_count,
                COUNT(CASE WHEN fallback_used = false THEN 1 END) as successful_count,
                predicted_category,
                COUNT(*) as category_count
            FROM ai_classifications
            GROUP BY predicted_category
        `;
        
        const result = await pool.query(query);
        return result.rows;
    }
}

export default AIClassification;
