// src/models/Ticket.js
import pool from '../config/database.js';

class Ticket {
    /**
     * Create a new ticket
     * @param {Object} ticketData - { subject, description, customer_id, priority, user_priority, ai_priority, category, ai_classified, ai_confidence, ai_fallback_used, ai_keywords_matched }
     * @returns {Promise<Object>} Created ticket
     */
    static async create({ 
        subject, 
        description, 
        customer_id, 
        priority = 'low',
        user_priority = null,
        ai_priority = null,
        category,
        ai_classified = false,
        ai_confidence = null,
        ai_fallback_used = false,
        ai_keywords_matched = null
    }) {
        const query = `
            INSERT INTO tickets (
                subject, description, customer_id, priority, user_priority, ai_priority, category,
                ai_classified, ai_confidence, ai_fallback_used, ai_keywords_matched
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `;
        
        const values = [
            subject, 
            description, 
            customer_id, 
            priority, 
            user_priority,
            ai_priority,
            category || 'general',
            ai_classified,
            ai_confidence,
            ai_fallback_used,
            ai_keywords_matched ? JSON.stringify(ai_keywords_matched) : null
        ];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /**
     * Get all tickets with user and category information
     * @returns {Promise<Array>} Array of tickets
     */
    static async getAll() {
        const query = `
            SELECT 
                t.*,
                CONCAT(customer.first_name, ' ', customer.last_name) as customer_name,
                customer.email as customer_email,
                CONCAT(assigned.first_name, ' ', assigned.last_name) as assigned_to_name,
                assigned.email as assigned_to_email
            FROM tickets t
            LEFT JOIN users customer ON t.customer_id = customer.id
            LEFT JOIN users assigned ON t.assigned_to = assigned.id
            ORDER BY t.created_at DESC
        `;
        
        const result = await pool.query(query);
        return result.rows;
    }

    /**
     * Get tickets by customer ID
     * @param {number} customerId - Customer ID
     * @returns {Promise<Array>} Array of tickets for the customer
     */
    static async getByCustomerId(customerId) {
        const query = `
            SELECT 
                t.*,
                CONCAT(customer.first_name, ' ', customer.last_name) as customer_name,
                customer.email as customer_email,
                CONCAT(assigned.first_name, ' ', assigned.last_name) as assigned_to_name,
                assigned.email as assigned_to_email
            FROM tickets t
            LEFT JOIN users customer ON t.customer_id = customer.id
            LEFT JOIN users assigned ON t.assigned_to = assigned.id
            WHERE t.customer_id = $1
            ORDER BY t.created_at DESC
        `;
        
        const result = await pool.query(query, [customerId]);
        return result.rows;
    }

    /**
     * Get a single ticket by ID with all related information
     * @param {number} id - Ticket ID
     * @returns {Promise<Object|null>} Ticket object or null
     */
    static async getById(id) {
        const query = `
            SELECT 
                t.*,
                CONCAT(customer.first_name, ' ', customer.last_name) as customer_name,
                customer.email as customer_email,
                CONCAT(assigned.first_name, ' ', assigned.last_name) as assigned_to_name,
                assigned.email as assigned_to_email,
                CONCAT(resolver.first_name, ' ', resolver.last_name) as resolved_by_name
            FROM tickets t
            LEFT JOIN users customer ON t.customer_id = customer.id
            LEFT JOIN users assigned ON t.assigned_to = assigned.id
            LEFT JOIN users resolver ON t.resolved_by = resolver.id
            WHERE t.id = $1
        `;
        
        const result = await pool.query(query, [id]);
        return result.rows[0] || null;
    }

    /**
     * Update a ticket
     * @param {number} id - Ticket ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object|null>} Updated ticket or null
     */
    static async update(id, updates) {
        const allowedFields = ['subject', 'description', 'status', 'priority', 'category', 'assigned_to', 'resolved_at'];
        const fields = [];
        const values = [];
        let paramCount = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key) && value !== undefined) {
                fields.push(`${key} = $${paramCount}`);
                values.push(value);
                paramCount++;
            }
        }

        if (fields.length === 0) {
            throw new Error('No valid fields to update');
        }

        values.push(id);

        const query = `
            UPDATE tickets 
            SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${paramCount}
            RETURNING *
        `;

        const result = await pool.query(query, values);
        return result.rows[0] || null;
    }

    /**
     * Delete a ticket (soft delete)
     * @param {number} id - Ticket ID
     * @returns {Promise<Object|null>} Deleted ticket or null
     */
    static async delete(id) {
        const query = `
            UPDATE tickets 
            SET status = 'closed',
                resolved_at = CASE WHEN status NOT IN ('resolved', 'closed') THEN CURRENT_TIMESTAMP ELSE resolved_at END,
                resolved_by = CASE WHEN status NOT IN ('resolved', 'closed') THEN customer_id ELSE resolved_by END,
                closed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `;
        
        const result = await pool.query(query, [id]);
        return result.rows[0] || null;
    }
}

export default Ticket;
