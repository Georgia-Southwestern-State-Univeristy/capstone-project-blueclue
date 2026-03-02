import pool from '../config/database.js';

/**
 * ChatConversation Model
 * Manages chat conversation sessions between users and the AI bot
 */
class ChatConversation {
  /**
   * Create a new chat conversation
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Created conversation
   */
  static async create(userId) {
    const query = `
      INSERT INTO chat_conversations (user_id)
      VALUES ($1)
      RETURNING *
    `;
    
    const result = await pool.query(query, [userId]);
    return result.rows[0];
  }

  /**
   * Get conversation by ID
   * @param {number} id - Conversation ID
   * @returns {Promise<Object|null>} Conversation or null
   */
  static async getById(id) {
    const query = `
      SELECT * FROM chat_conversations WHERE id = $1
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Get all conversations for a user
   * @param {number} userId - User ID
   * @param {number} limit - Maximum number of conversations to return
   * @returns {Promise<Array>} Array of conversations
   */
  static async getByUserId(userId, limit = 50) {
    const query = `
      SELECT * FROM chat_conversations
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [userId, limit]);
    return result.rows;
  }

  /**
   * Get active (not ended) conversation for a user
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} Active conversation or null
   */
  static async getActiveByUserId(userId) {
    const query = `
      SELECT * FROM chat_conversations
      WHERE user_id = $1 AND ended_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    const result = await pool.query(query, [userId]);
    return result.rows[0] || null;
  }

  /**
   * End a conversation
   * @param {number} id - Conversation ID
   * @param {boolean} wasHelpful - Optional: Was the conversation helpful?
   * @returns {Promise<Object>} Updated conversation
   */
  static async end(id, wasHelpful = null) {
    const query = `
      UPDATE chat_conversations
      SET ended_at = CURRENT_TIMESTAMP,
          was_helpful = $2
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [id, wasHelpful]);
    return result.rows[0];
  }

  /**
   * Link a conversation to a created ticket
   * @param {number} id - Conversation ID
   * @param {number} ticketId - Ticket ID
   * @returns {Promise<Object>} Updated conversation
   */
  static async linkTicket(id, ticketId) {
    const query = `
      UPDATE chat_conversations
      SET created_ticket = $2
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [id, ticketId]);
    return result.rows[0];
  }

  /**
   * Update helpfulness rating
   * @param {number} id - Conversation ID
   * @param {boolean} wasHelpful - Was helpful rating
   * @returns {Promise<Object>} Updated conversation
   */
  static async updateHelpfulness(id, wasHelpful) {
    const query = `
      UPDATE chat_conversations
      SET was_helpful = $2
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [id, wasHelpful]);
    return result.rows[0];
  }

  /**
   * Delete a conversation and all its messages
   * @param {number} id - Conversation ID
   * @returns {Promise<boolean>} Success
   */
  static async delete(id) {
    const query = `DELETE FROM chat_conversations WHERE id = $1`;
    const result = await pool.query(query, [id]);
    return result.rowCount > 0;
  }

  /**
   * Get conversation statistics
   * @param {number} userId - Optional: User ID to filter by
   * @returns {Promise<Object>} Statistics
   */
  static async getStats(userId = null) {
    const query = userId
      ? `
        SELECT 
          COUNT(*) as total_conversations,
          COUNT(CASE WHEN ended_at IS NOT NULL THEN 1 END) as ended_conversations,
          COUNT(CASE WHEN was_helpful = true THEN 1 END) as helpful_conversations,
          COUNT(CASE WHEN created_ticket IS NOT NULL THEN 1 END) as conversations_with_tickets
        FROM chat_conversations
        WHERE user_id = $1
      `
      : `
        SELECT 
          COUNT(*) as total_conversations,
          COUNT(CASE WHEN ended_at IS NOT NULL THEN 1 END) as ended_conversations,
          COUNT(CASE WHEN was_helpful = true THEN 1 END) as helpful_conversations,
          COUNT(CASE WHEN created_ticket IS NOT NULL THEN 1 END) as conversations_with_tickets
        FROM chat_conversations
      `;
    
    const result = userId 
      ? await pool.query(query, [userId])
      : await pool.query(query);
    
    return result.rows[0];
  }
}

export default ChatConversation;
