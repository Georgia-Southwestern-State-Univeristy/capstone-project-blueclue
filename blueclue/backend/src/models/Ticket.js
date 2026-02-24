// src/models/Ticket.js
import pool from '../config/database.js';

class Ticket {
    /**
     * Create a new ticket
     * @param {Object} ticketData - Ticket data including AI priority fields
     * @returns {Promise<Object>} Created ticket
     */
    static async create({ 
        subject, 
        description, 
        customer_id, 
        priority = 'low',
        user_priority = null,
        ai_priority = null,
        ai_recommended_priority = null,
        priority_overridden = false,
        priority_override_reason = null,
        priority_calculation_method = null,
        category,
        ai_classified = false,
        ai_confidence = null,
        ai_fallback_used = false,
        ai_keywords_matched = null
    }) {
        const query = `
            INSERT INTO tickets (
                subject, description, customer_id, priority, user_priority, ai_priority, 
                ai_recommended_priority, priority_overridden, priority_override_reason,
                priority_calculation_method, category, ai_classified, ai_confidence, 
                ai_fallback_used, ai_keywords_matched
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
        `;
        
        const values = [
            subject, 
            description, 
            customer_id, 
            priority, 
            user_priority,
            ai_priority,
            ai_recommended_priority,
            priority_overridden,
            priority_override_reason,
            priority_calculation_method,
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
                customer.first_name || ' ' || customer.last_name as customer_name,
                customer.email as customer_email,
                assigned.first_name || ' ' || assigned.last_name as assigned_to_name,
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
                customer.first_name || ' ' || customer.last_name as customer_name,
                customer.email as customer_email,
                assigned.first_name || ' ' || assigned.last_name as assigned_to_name,
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
     * Get tickets by customer email (for guest users)
     * @param {string} email - Customer email address
     * @returns {Promise<Array>} Array of tickets
     */
    static async getByEmail(email) {
        const query = `
            SELECT 
                t.*,
                customer.first_name || ' ' || customer.last_name as customer_name,
                customer.email as customer_email,
                assigned.first_name || ' ' || assigned.last_name as assigned_to_name,
                assigned.email as assigned_to_email
            FROM tickets t
            LEFT JOIN users customer ON t.customer_id = customer.id
            LEFT JOIN users assigned ON t.assigned_to = assigned.id
            WHERE customer.email = $1
            ORDER BY t.created_at DESC
        `;
        
        const result = await pool.query(query, [email]);
        return result.rows;
    }

    /**
     * Get tickets assigned to a specific technician
     * @param {number} technicianId - Technician ID
     * @returns {Promise<Array>} Array of tickets assigned to the technician
     */
    static async getByTechnicianId(technicianId) {
        const query = `
            SELECT 
                t.*,
                customer.first_name || ' ' || customer.last_name as customer_name,
                customer.email as customer_email,
                assigned.first_name || ' ' || assigned.last_name as assigned_to_name,
                assigned.email as assigned_to_email
            FROM tickets t
            LEFT JOIN users customer ON t.customer_id = customer.id
            LEFT JOIN users assigned ON t.assigned_to = assigned.id
            WHERE t.assigned_to = $1
            ORDER BY t.created_at DESC
        `;
        
        const result = await pool.query(query, [technicianId]);
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
                customer.first_name || ' ' || customer.last_name as customer_name,
                customer.email as customer_email,
                assigned.first_name || ' ' || assigned.last_name as assigned_to_name,
                assigned.email as assigned_to_email,
                resolver.first_name || ' ' || resolver.last_name as resolved_by_name
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

    /**
     * Reopen a closed ticket
     * @param {number} id - Ticket ID
     * @param {string} reason - Reason for reopening
     * @returns {Promise<Object>} Result object with status and updated ticket
     */
    static async reopen(id, reason) {
        // Get the ticket to validate and determine reassignment
        const ticket = await this.getById(id);
        
        if (!ticket) {
            return { success: false, error: 'Ticket not found' };
        }

        // Validate ticket status
        if (!['closed', 'cancelled'].includes(ticket.status)) {
            return { success: false, error: 'Only closed or cancelled tickets can be reopened' };
        }

        // Validate 30-day window
        if (ticket.closed_at) {
            const daysSinceClosure = (Date.now() - new Date(ticket.closed_at).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceClosure > 30) {
                return { success: false, error: 'Tickets can only be reopened within 30 days of closure' };
            }
        }

        // Store previous assigned tech and determine new status
        const previousTech = ticket.assigned_to;
        let newStatus = 'reopened';
        let newAssignedTo = null;

        // If ticket had a tech assigned, try to reassign to them
        if (previousTech) {
            // Check if tech still exists and is active
            const techQuery = `
                SELECT id, is_active, role 
                FROM users 
                WHERE id = $1 
                AND role IN ('technician', 'senior_technician', 'management')
            `;
            const techResult = await pool.query(techQuery, [previousTech]);
            
            if (techResult.rows.length > 0 && techResult.rows[0].is_active) {
                // Tech is available, reassign to them
                newAssignedTo = previousTech;
                newStatus = 'open'; // or 'reopened' - keeping as reopened for distinction
            }
            // If tech not available, leave unassigned and status will be 'reopened'
        }

        // Update the ticket
        const updateQuery = `
            UPDATE tickets 
            SET 
                status = $1,
                assigned_to = $2,
                previous_assigned_tech = $3,
                reopen_count = reopen_count + 1,
                last_reopened_at = CURRENT_TIMESTAMP,
                resolved_at = NULL,
                resolved_by = NULL,
                closed_at = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
            RETURNING *
        `;

        const result = await pool.query(updateQuery, [
            newStatus,
            newAssignedTo,
            previousTech,
            id
        ]);

        return {
            success: true,
            ticket: result.rows[0],
            reassigned: newAssignedTo !== null,
            previousTech: previousTech,
            reason: reason
        };
    }

    /**
     * Check if a ticket can be reopened
     * @param {number} id - Ticket ID
     * @param {number} userId - ID of user requesting reopen
     * @returns {Promise<Object>} Result with canReopen boolean and reason
     */
    static async canReopen(id, userId) {
        const ticket = await this.getById(id);

        if (!ticket) {
            return { canReopen: false, reason: 'Ticket not found' };
        }

        // Check if user is the requester
        if (ticket.customer_id !== userId) {
            return { canReopen: false, reason: 'Only the ticket requester can reopen this ticket' };
        }

        // Check status
        if (!['closed', 'cancelled'].includes(ticket.status)) {
            return { canReopen: false, reason: 'Ticket is not closed or cancelled' };
        }

        // Check 30-day window
        if (ticket.closed_at) {
            const daysSinceClosure = (Date.now() - new Date(ticket.closed_at).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceClosure > 30) {
                return { canReopen: false, reason: 'Reopening window expired (>30 days)' };
            }
        }

        return { canReopen: true };
    }
}

export default Ticket;
