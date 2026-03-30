import pool from '../config/database.js';

class DirectMessage {
  /**
   * Send a direct message
   */
  static async create({ senderId, receiverId, message }) {
    const result = await pool.query(
      `INSERT INTO direct_messages (sender_id, receiver_id, message)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [senderId, receiverId, message]
    );
    return result.rows[0];
  }

  /**
   * Get conversation between two users (paginated, newest first)
   */
  static async getConversation(userA, userB, { limit = 50, before } = {}) {
    const conditions = [
      `((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))`
    ];
    const params = [userA, userB];
    let idx = 3;

    if (before) {
      conditions.push(`created_at < $${idx++}`);
      params.push(before);
    }

    params.push(limit);

    const result = await pool.query(
      `SELECT dm.*, 
              u.first_name AS sender_first_name,
              u.last_name  AS sender_last_name
       FROM direct_messages dm
       JOIN users u ON u.id = dm.sender_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY dm.created_at DESC
       LIMIT $${idx}`,
      params
    );
    return result.rows;
  }

  /**
   * Mark all messages in a conversation as read (where current user is receiver)
   */
  static async markRead(receiverId, senderId) {
    await pool.query(
      `UPDATE direct_messages
       SET read_at = NOW()
       WHERE receiver_id = $1 AND sender_id = $2 AND read_at IS NULL`,
      [receiverId, senderId]
    );
  }
}

export default DirectMessage;
