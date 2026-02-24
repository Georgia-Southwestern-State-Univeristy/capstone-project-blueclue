// src/models/Notification.js
import pool from '../config/database.js';

class Notification {
    /**
     * Create a new notification
     * @param {Object} notificationData - { user_id, type, message, ticket_id }
     * @returns {Promise<Object>} Created notification
     */
    static async create({ user_id, type, message, ticket_id = null }) {
        const query = `
            INSERT INTO notifications (user_id, type, message, ticket_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        
        const values = [user_id, type, message, ticket_id];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /**
     * Get notifications for a specific user with pagination
     * @param {Number} userId - User ID
     * @param {Number} limit - Number of notifications per page
     * @param {Number} offset - Offset for pagination
     * @returns {Promise<Object>} { notifications, total, unread_count }
     */
    static async getByUserId(userId, limit = 20, offset = 0) {
        // Get notifications
        const notificationsQuery = `
            SELECT 
                n.*,
                t.subject as ticket_subject,
                t.ticket_number as ticket_number
            FROM notifications n
            LEFT JOIN tickets t ON n.ticket_id = t.id
            WHERE n.user_id = $1
            ORDER BY n.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        
        const notificationsResult = await pool.query(notificationsQuery, [userId, limit, offset]);
        
        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM notifications
            WHERE user_id = $1
        `;
        const countResult = await pool.query(countQuery, [userId]);
        
        // Get unread count
        const unreadQuery = `
            SELECT COUNT(*) as unread
            FROM notifications
            WHERE user_id = $1 AND is_read = false
        `;
        const unreadResult = await pool.query(unreadQuery, [userId]);
        
        return {
            notifications: notificationsResult.rows,
            total: parseInt(countResult.rows[0].total),
            unread_count: parseInt(unreadResult.rows[0].unread)
        };
    }

    /**
     * Mark a notification as read
     * @param {Number} id - Notification ID
     * @param {Number} userId - User ID (for security check)
     * @returns {Promise<Object>} Updated notification
     */
    static async markAsRead(id, userId) {
        const query = `
            UPDATE notifications
            SET is_read = true
            WHERE id = $1 AND user_id = $2
            RETURNING *
        `;
        
        const result = await pool.query(query, [id, userId]);
        return result.rows[0];
    }

    /**
     * Delete a notification
     * @param {Number} id - Notification ID
     * @param {Number} userId - User ID (for security check)
     * @returns {Promise<Object>} Deleted notification
     */
    static async delete(id, userId) {
        const query = `
            DELETE FROM notifications
            WHERE id = $1 AND user_id = $2
            RETURNING *
        `;
        
        const result = await pool.query(query, [id, userId]);
        return result.rows[0];
    }

    /**
     * Mark all notifications as read for a user
     * @param {Number} userId - User ID
     * @returns {Promise<Number>} Number of notifications marked as read
     */
    static async markAllAsRead(userId) {
        const query = `
            UPDATE notifications
            SET is_read = true
            WHERE user_id = $1 AND is_read = false
            RETURNING *
        `;
        
        const result = await pool.query(query, [userId]);
        return result.rowCount;
    }

    /**
     * Delete all read notifications for a user
     * @param {Number} userId - User ID
     * @returns {Promise<Number>} Number of notifications deleted
     */
    static async deleteAllRead(userId) {
        const query = `
            DELETE FROM notifications
            WHERE user_id = $1 AND is_read = true
            RETURNING *
        `;
        
        const result = await pool.query(query, [userId]);
        return result.rowCount;
    }

    /**
     * Get unread notification count for a user
     * @param {Number} userId - User ID
     * @returns {Promise<Number>} Unread notification count
     */
    static async getUnreadCount(userId) {
        const query = `
            SELECT COUNT(*) as count
            FROM notifications
            WHERE user_id = $1 AND is_read = false
        `;
        
        const result = await pool.query(query, [userId]);
        return parseInt(result.rows[0].count);
    }
}

export default Notification;
