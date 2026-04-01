import pool from '../config/database.js';

class TicketChat {
    /**
     * Request a chat session on a ticket (client -> assigned tech)
     */
    static async requestChat(ticketId, clientId, techId) {
        const result = await pool.query(
            `INSERT INTO ticket_chats (ticket_id, client_id, tech_id, status)
             VALUES ($1, $2, $3, 'pending')
             ON CONFLICT (ticket_id) DO UPDATE
               SET client_id = $2, tech_id = $3, status = 'pending',
                   requested_at = CURRENT_TIMESTAMP, responded_at = NULL, closed_at = NULL
             RETURNING *`,
            [ticketId, clientId, techId]
        );
        return result.rows[0];
    }

    /**
     * Get chat session for a ticket
     */
    static async getByTicketId(ticketId) {
        const result = await pool.query(
            `SELECT tc.*,
                    u1.first_name || ' ' || u1.last_name AS client_name,
                    u2.first_name || ' ' || u2.last_name AS tech_name
             FROM ticket_chats tc
             JOIN users u1 ON u1.id = tc.client_id
             JOIN users u2 ON u2.id = tc.tech_id
             WHERE tc.ticket_id = $1`,
            [ticketId]
        );
        return result.rows[0] || null;
    }

    /**
     * Accept a chat request (tech only)
     */
    static async acceptChat(chatId, techId) {
        const result = await pool.query(
            `UPDATE ticket_chats
             SET status = 'accepted', responded_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND tech_id = $2 AND status = 'pending'
             RETURNING *`,
            [chatId, techId]
        );
        return result.rows[0] || null;
    }

    /**
     * Decline a chat request (tech only)
     */
    static async declineChat(chatId, techId) {
        const result = await pool.query(
            `UPDATE ticket_chats
             SET status = 'declined', responded_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND tech_id = $2 AND status = 'pending'
             RETURNING *`,
            [chatId, techId]
        );
        return result.rows[0] || null;
    }

    /**
     * Close a chat session
     */
    static async closeChat(chatId) {
        const result = await pool.query(
            `UPDATE ticket_chats
             SET status = 'closed', closed_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND status = 'accepted'
             RETURNING *`,
            [chatId]
        );
        return result.rows[0] || null;
    }

    /**
     * Send a message in an accepted chat
     */
    static async sendMessage(chatId, senderId, message) {
        const result = await pool.query(
            `INSERT INTO ticket_chat_messages (chat_id, sender_id, message)
             SELECT $1, $2, $3
             FROM ticket_chats
             WHERE id = $1 AND status = 'accepted'
               AND (client_id = $2 OR tech_id = $2)
             RETURNING *`,
            [chatId, senderId, message]
        );
        return result.rows[0] || null;
    }

    /**
     * Get messages for a chat (only if participant)
     */
    static async getMessages(chatId, userId, { limit = 100, before } = {}) {
        const conditions = ['tc.id = $1', '(tc.client_id = $2 OR tc.tech_id = $2)'];
        const params = [chatId, userId];
        let paramIdx = 3;

        if (before) {
            conditions.push(`m.created_at < $${paramIdx++}`);
            params.push(before);
        }

        const result = await pool.query(
            `SELECT m.id, m.message, m.created_at, m.sender_id,
                    u.first_name || ' ' || u.last_name AS sender_name
             FROM ticket_chat_messages m
             JOIN ticket_chats tc ON tc.id = m.chat_id
             JOIN users u ON u.id = m.sender_id
             WHERE ${conditions.join(' AND ')}
             ORDER BY m.created_at ASC
             LIMIT $${paramIdx}`,
            [...params, limit]
        );
        return result.rows;
    }
}

export default TicketChat;
