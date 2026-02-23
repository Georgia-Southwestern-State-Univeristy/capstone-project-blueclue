// src/models/TicketHistory.js
import pool from '../config/database.js';

class TicketHistory {
    /**
     * Log an activity entry to ticket_history
     * @param {number} ticketId - The ticket ID
     * @param {number|null} changedBy - The user ID who made the change
     * @param {string} changeType - e.g. 'ticket_assigned', 'ticket_reassigned', 'status_change'
     * @param {string|null} fieldName - The field that changed
     * @param {string|null} oldValue - Previous value
     * @param {string|null} newValue - New value
     * @param {string|null} comment - Optional note/comment
     * @param {object|null} changeDetails - JSONB with rich details (names, etc.)
     */
    static async log(ticketId, changedBy, changeType, fieldName = null, oldValue = null, newValue = null, comment = null, changeDetails = null) {
        const query = `
            INSERT INTO ticket_history (ticket_id, changed_by, change_type, field_name, old_value, new_value, comment, change_details)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;
        const result = await pool.query(query, [
            ticketId,
            changedBy,
            changeType,
            fieldName,
            oldValue,
            newValue,
            comment,
            changeDetails ? JSON.stringify(changeDetails) : null
        ]);
        return result.rows[0];
    }

    /**
     * Get all history entries for a ticket, with user names joined
     * @param {number} ticketId - The ticket ID
     * @returns {Array} History entries sorted by created_at DESC
     */
    static async getByTicketId(ticketId) {
        const query = `
            SELECT 
                th.*,
                u.first_name || ' ' || u.last_name AS changed_by_name,
                u.role AS changed_by_role
            FROM ticket_history th
            LEFT JOIN users u ON th.changed_by = u.id
            WHERE th.ticket_id = $1
            ORDER BY th.created_at DESC
        `;
        const result = await pool.query(query, [ticketId]);
        return result.rows;
    }
}

export default TicketHistory;
