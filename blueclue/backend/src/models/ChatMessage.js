import pool from '../config/database.js';

/**
 * ChatMessage Model
 * Manages individual messages within chat conversations
 */
class ChatMessage {
  /**
   * Create a new chat message
   * @param {Object} params - Message parameters
   * @param {number} params.conversationId - Conversation ID
   * @param {string} params.sender - 'user' or 'bot'
   * @param {string} params.message - Message text
   * @param {string} params.intent - Optional: Detected intent
   * @param {number} params.confidence - Optional: Confidence score (0-1)
   * @param {Array} params.suggestedArticles - Optional: Array of article IDs
   * @returns {Promise<Object>} Created message
   */
  static async create({ conversationId, sender, message, intent = null, confidence = null, suggestedArticles = [] }) {
    const query = `
      INSERT INTO chat_messages 
        (conversation_id, sender, message, intent, confidence, suggested_articles)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      conversationId,
      sender,
      message,
      intent,
      confidence,
      JSON.stringify(suggestedArticles)
    ]);
    
    return result.rows[0];
  }

  /**
   * Get message by ID
   * @param {number} id - Message ID
   * @returns {Promise<Object|null>} Message or null
   */
  static async getById(id) {
    const query = `SELECT * FROM chat_messages WHERE id = $1`;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Get all messages for a conversation
   * @param {number} conversationId - Conversation ID
   * @param {number} limit - Maximum messages to return
   * @returns {Promise<Array>} Array of messages
   */
  static async getByConversationId(conversationId, limit = 100) {
    const query = `
      SELECT * FROM chat_messages
      WHERE conversation_id = $1
      ORDER BY timestamp ASC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [conversationId, limit]);
    return result.rows;
  }

  /**
   * Get messages with pagination
   * @param {number} conversationId - Conversation ID
   * @param {number} page - Page number (1-based)
   * @param {number} pageSize - Messages per page
   * @returns {Promise<Object>} {messages, total, page, totalPages}
   */
  static async getPaginated(conversationId, page = 1, pageSize = 50) {
    const offset = (page - 1) * pageSize;
    
    const countQuery = `
      SELECT COUNT(*) as total FROM chat_messages WHERE conversation_id = $1
    `;
    const messagesQuery = `
      SELECT * FROM chat_messages
      WHERE conversation_id = $1
      ORDER BY timestamp ASC
      LIMIT $2 OFFSET $3
    `;
    
    const [countResult, messagesResult] = await Promise.all([
      pool.query(countQuery, [conversationId]),
      pool.query(messagesQuery, [conversationId, pageSize, offset])
    ]);
    
    const total = parseInt(countResult.rows[0].total);
    
    return {
      messages: messagesResult.rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  /**
   * Get latest message in a conversation
   * @param {number} conversationId - Conversation ID
   * @returns {Promise<Object|null>} Latest message or null
   */
  static async getLatest(conversationId) {
    const query = `
      SELECT * FROM chat_messages
      WHERE conversation_id = $1
      ORDER BY timestamp DESC
      LIMIT 1
    `;
    
    const result = await pool.query(query, [conversationId]);
    return result.rows[0] || null;
  }

  /**
   * Get messages by intent
   * @param {string} intent - Intent to filter by
   * @param {number} limit - Maximum messages to return
   * @returns {Promise<Array>} Array of messages
   */
  static async getByIntent(intent, limit = 100) {
    const query = `
      SELECT * FROM chat_messages
      WHERE intent = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [intent, limit]);
    return result.rows;
  }

  /**
   * Get messages with suggested articles
   * @param {number} conversationId - Conversation ID
   * @returns {Promise<Array>} Array of messages that have suggested articles
   */
  static async getWithSuggestedArticles(conversationId) {
    const query = `
      SELECT * FROM chat_messages
      WHERE conversation_id = $1
        AND suggested_articles IS NOT NULL
        AND jsonb_array_length(suggested_articles) > 0
      ORDER BY timestamp ASC
    `;
    
    const result = await pool.query(query, [conversationId]);
    return result.rows;
  }

  /**
   * Delete all messages in a conversation
   * @param {number} conversationId - Conversation ID
   * @returns {Promise<number>} Number of deleted messages
   */
  static async deleteByConversationId(conversationId) {
    const query = `DELETE FROM chat_messages WHERE conversation_id = $1`;
    const result = await pool.query(query, [conversationId]);
    return result.rowCount;
  }

  /**
   * Get message count for a conversation
   * @param {number} conversationId - Conversation ID
   * @returns {Promise<number>} Message count
   */
  static async getCount(conversationId) {
    const query = `
      SELECT COUNT(*) as count FROM chat_messages WHERE conversation_id = $1
    `;
    
    const result = await pool.query(query, [conversationId]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Get intent statistics
   * @param {number} conversationId - Optional: Conversation ID to filter by
   * @returns {Promise<Array>} Array of intent counts
   */
  static async getIntentStats(conversationId = null) {
    const query = conversationId
      ? `
        SELECT 
          intent,
          COUNT(*) as count,
          AVG(confidence) as avg_confidence
        FROM chat_messages
        WHERE conversation_id = $1 AND intent IS NOT NULL
        GROUP BY intent
        ORDER BY count DESC
      `
      : `
        SELECT 
          intent,
          COUNT(*) as count,
          AVG(confidence) as avg_confidence
        FROM chat_messages
        WHERE intent IS NOT NULL
        GROUP BY intent
        ORDER BY count DESC
      `;
    
    const result = conversationId
      ? await pool.query(query, [conversationId])
      : await pool.query(query);
    
    return result.rows;
  }
}

export default ChatMessage;
