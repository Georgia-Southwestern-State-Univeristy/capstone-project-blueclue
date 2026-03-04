import { processChatMessage, getConversationHistory, clearChatHistory, suggestArticlesForText, processTechCommand } from '../services/chatService.js';
import { generateTicketSummary, checkLLMHealth } from '../services/llmService.js';
import ChatConversation from '../models/ChatConversation.js';
import ChatMessage from '../models/ChatMessage.js';
import pool from '../config/database.js';
import path from 'path';
import fs from 'fs';

const TECH_ROLES = new Set(['technician', 'senior_technician', 'management', 'admin']);

/**
 * Send a message and get bot response
 * POST /api/chat/message
 */
export const sendMessage = async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Message is required and must be a non-empty string'
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({
        status: 'error',
        message: 'Message is too long (max 2000 characters)'
      });
    }

    // Process the message
    const result = await processChatMessage(userId, message.trim(), conversationId);

    res.status(200).json({
      status: 'success',
      data: result
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process message',
      error: error.message
    });
  }
};

/**
 * Get chat history for a conversation
 * GET /api/chat/history?conversationId=X
 */
export const getHistory = async (req, res) => {
  try {
    const { conversationId } = req.query;
    const userId = req.user.id;

    if (!conversationId) {
      return res.status(400).json({
        status: 'error',
        message: 'conversationId query parameter is required'
      });
    }

    // Get conversation and verify ownership
    const conversation = await ChatConversation.getById(parseInt(conversationId));
    
    if (!conversation) {
      return res.status(404).json({
        status: 'error',
        message: 'Conversation not found'
      });
    }

    if (conversation.user_id !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'Unauthorized to access this conversation'
      });
    }

    // Get full conversation history
    const history = await getConversationHistory(parseInt(conversationId));

    res.status(200).json({
      status: 'success',
      data: history
    });

  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve chat history',
      error: error.message
    });
  }
};

/**
 * Get all conversations for the logged-in user
 * GET /api/chat/conversations
 */
export const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;

    const conversations = await ChatConversation.getByUserId(userId, limit);

    // Get message count for each conversation
    const conversationsWithCounts = await Promise.all(
      conversations.map(async (conv) => {
        const messageCount = await ChatMessage.getCount(conv.id);
        return {
          ...conv,
          messageCount
        };
      })
    );

    res.status(200).json({
      status: 'success',
      count: conversationsWithCounts.length,
      data: conversationsWithCounts
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve conversations',
      error: error.message
    });
  }
};

/**
 * Rate bot response (provide feedback)
 * POST /api/chat/feedback
 */
export const submitFeedback = async (req, res) => {
  try {
    const { messageId, helpful, feedback } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!messageId) {
      return res.status(400).json({
        status: 'error',
        message: 'messageId is required'
      });
    }

    if (typeof helpful !== 'boolean') {
      return res.status(400).json({
        status: 'error',
        message: 'helpful must be a boolean value'
      });
    }

    // Get message and verify it belongs to user's conversation
    const message = await ChatMessage.getById(parseInt(messageId));
    
    if (!message) {
      return res.status(404).json({
        status: 'error',
        message: 'Message not found'
      });
    }

    const conversation = await ChatConversation.getById(message.conversation_id);
    
    if (!conversation || conversation.user_id !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'Unauthorized to rate this message'
      });
    }

    // Update conversation helpfulness
    await ChatConversation.updateHelpfulness(conversation.id, helpful);

    // Log feedback (for future analytics)
    console.log('Chat feedback received:', {
      userId,
      conversationId: conversation.id,
      messageId,
      helpful,
      feedback: feedback || null
    });

    res.status(200).json({
      status: 'success',
      message: 'Feedback submitted successfully',
      data: {
        conversationId: conversation.id,
        helpful
      }
    });

  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to submit feedback',
      error: error.message
    });
  }
};

/**
 * Clear chat history
 * POST /api/chat/clear
 */
export const clearHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.body;

    const result = await clearChatHistory(userId, conversationId);

    res.status(200).json({
      status: 'success',
      message: 'Chat history cleared successfully',
      data: result
    });

  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to clear chat history',
      error: error.message
    });
  }
};

/**
 * End a conversation
 * POST /api/chat/end
 */
export const endConversation = async (req, res) => {
  try {
    const { conversationId, wasHelpful } = req.body;
    const userId = req.user.id;

    if (!conversationId) {
      return res.status(400).json({
        status: 'error',
        message: 'conversationId is required'
      });
    }

    // Verify ownership
    const conversation = await ChatConversation.getById(parseInt(conversationId));
    
    if (!conversation) {
      return res.status(404).json({
        status: 'error',
        message: 'Conversation not found'
      });
    }

    if (conversation.user_id !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'Unauthorized to end this conversation'
      });
    }

    // End the conversation
    const updatedConversation = await ChatConversation.end(
      parseInt(conversationId),
      wasHelpful !== undefined ? wasHelpful : null
    );

    res.status(200).json({
      status: 'success',
      message: 'Conversation ended successfully',
      data: updatedConversation
    });

  } catch (error) {
    console.error('End conversation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to end conversation',
      error: error.message
    });
  }
};

/**
 * Create a support ticket from chat context
 * POST /api/chat/create-ticket
 */
export const createTicketFromChat = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId, subject, description } = req.body;

    // Build description from conversation history if not already supplied
    let ticketSubject = subject;
    let ticketDescription = description;

    if (conversationId && (!ticketSubject || !ticketDescription)) {
      const messages = await ChatMessage.getByConversationId(parseInt(conversationId), 20);

      // ── Try LLM-powered summarization first ─────────────────────────────
      try {
        const summary = await generateTicketSummary(messages);
        if (!ticketSubject)      ticketSubject      = summary.title;
        if (!ticketDescription)  ticketDescription  = summary.description;
      } catch {
        // Fall through to rule-based extraction
      }

      // ── Rule-based fallback ──────────────────────────────────────────────
      if (!ticketSubject || !ticketDescription) {
        // Intents that are always quick-reply button clicks, not real problem descriptions
        const ACTION_INTENTS = new Set([
          'create_ticket', 'check_status', 'greeting', 'farewell',
          'gratitude', 'escalation', 'general_help',
        ]);
        const EMOJI_PREFIX = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;

        const realUserMessages = messages.filter(m => {
          if (m.sender !== 'user') return false;
          const intentIsAction = m.intent && ACTION_INTENTS.has(m.intent);
          const looksLikeChip  = EMOJI_PREFIX.test(m.message?.trim() || '');
          return !intentIsAction && !looksLikeChip;
        });

        if (!ticketSubject) {
          const firstReal = realUserMessages[0]?.message
            || messages.find(m => m.sender === 'user')?.message
            || 'Support Request';
          ticketSubject = firstReal.length > 100
            ? firstReal.slice(0, 97) + '...'
            : firstReal;
        }

        if (!ticketDescription) {
          ticketDescription = realUserMessages.length > 0
            ? realUserMessages.map(m => m.message).join('\n')
            : 'Submitted via chat assistant';
        }
      }
    }

    ticketSubject    = ticketSubject    || 'Support Request from Chat';
    ticketDescription = ticketDescription || 'Submitted via chat assistant';

    // Insert ticket (ticket_number is auto-generated by DB trigger)
    const result = await pool.query(
      `INSERT INTO tickets
         (subject, description, customer_id, status, priority, category)
       VALUES ($1, $2, $3::integer, 'open', 'low', 'general')
       RETURNING id, ticket_number, subject, status, priority, category, created_at`,
      [ticketSubject, ticketDescription, userId],
    );

    const ticket = result.rows[0];

    res.status(201).json({
      status: 'success',
      data: {
        ticketId: ticket.id,
        ticketNumber: ticket.ticket_number,
        subject: ticket.subject,
        status: ticket.status,
        message: `Ticket ${ticket.ticket_number} created. A technician will respond soon.`,
      },
    });

  } catch (error) {
    console.error('Create ticket from chat error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create support ticket',
      error: error.message,
    });
  }
};

/**
 * GET /api/chat/llm/health
 * Returns LLM + RAG service status (admin/debug endpoint)
 */
export const getLLMHealth = async (req, res) => {
  try {
    const health = await checkLLMHealth();
    res.status(health.available ? 200 : 503).json({
      status: health.available ? 'success' : 'degraded',
      data: health,
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export default {
  sendMessage,
  getHistory,
  getConversations,
  submitFeedback,
  clearHistory,
  endConversation,
  createTicketFromChat,
  getLLMHealth,
};

// ============================================================================
// TECH-MODE MESSAGE  (internal KB, not filtered to is_public=true)
// ============================================================================

/**
 * POST /api/chat/tech-message
 * Process a message in tech mode – accesses private KB articles and past tickets.
 * Restricted to technician / management / admin roles.
 */
export const sendTechMessage = async (req, res) => {
  try {
    const user = req.user;
    if (!TECH_ROLES.has(user.role)) {
      return res.status(403).json({ status: 'error', message: 'Tech mode requires technician or management role.' });
    }

    const { message, conversationId } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ status: 'error', message: 'Message is required.' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ status: 'error', message: 'Message too long (max 2000 chars).' });
    }

    // Handle slash commands
    if (message.trim().startsWith('/')) {
      const result = await processTechCommand(user.id, message.trim(), conversationId);
      return res.status(200).json({ status: 'success', data: result });
    }

    // Standard processing with tech context (private KB access)
    const result = await processChatMessage(user.id, message.trim(), conversationId, { techMode: true });
    return res.status(200).json({ status: 'success', data: result });

  } catch (error) {
    console.error('Tech message error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to process tech message.', error: error.message });
  }
};

// ============================================================================
// SUGGEST ARTICLES  (proactive ticket prevention in TicketForm)
// ============================================================================

/**
 * POST /api/suggest-articles
 * Input: { description: string, userId?, abGroup? }
 * Returns top 3 KB articles relevant to the partial ticket description.
 */
export const suggestArticlesEndpoint = async (req, res) => {
  try {
    const { description, abGroup = 'A' } = req.body;
    const userId = req.user?.id || null;

    if (!description || description.trim().length < 15) {
      return res.status(200).json({ status: 'success', data: { articles: [] } });
    }

    const articles = await suggestArticlesForText(description.trim(), userId);

    // Track "shown" event for A/B analytics
    if (userId && articles.length > 0 && abGroup === 'A') {
      for (const article of articles) {
        await pool.query(
          `INSERT INTO chat_article_suggestion_events (user_id, article_id, description_text, action, ab_group)
           VALUES ($1, $2, $3, 'shown', $4)`,
          [userId, article.id, description.trim().slice(0, 500), abGroup]
        ).catch(() => {});
      }
    }

    return res.status(200).json({ status: 'success', data: { articles } });
  } catch (error) {
    console.error('Suggest articles error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch article suggestions.', error: error.message });
  }
};

// ============================================================================
// ARTICLE SUGGESTION EVENTS  (for A/B tracking + analytics)
// ============================================================================

/**
 * POST /api/suggest-articles/event
 * Track user interaction with suggestion cards.
 * Body: { articleId, action: 'clicked'|'dismissed'|'ticket_cancelled', description? }
 */
export const trackSuggestionEvent = async (req, res) => {
  try {
    const { articleId, action, description } = req.body;
    const userId = req.user?.id || null;

    if (!action || !['clicked', 'dismissed', 'ticket_cancelled'].includes(action)) {
      return res.status(400).json({ status: 'error', message: 'Invalid action.' });
    }

    await pool.query(
      `INSERT INTO chat_article_suggestion_events (user_id, article_id, description_text, action, ab_group)
       VALUES ($1, $2, $3, $4, 'A')`,
      [userId, articleId || null, (description || '').slice(0, 500), action]
    );

    return res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Track suggestion event error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to track event.' });
  }
};

// ============================================================================
// CHAT FILE UPLOAD  (base64 over JSON, max 5MB)
// ============================================================================

/**
 * POST /api/chat/upload
 * Accepts base64-encoded file, saves to disk, returns URL.
 * Body: { filename, mimeType, dataBase64, conversationId? }
 */
export const uploadChatFile = async (req, res) => {
  try {
    const { filename, mimeType, dataBase64, conversationId } = req.body;
    const userId = req.user.id;

    if (!dataBase64 || !filename || !mimeType) {
      return res.status(400).json({ status: 'error', message: 'filename, mimeType, and dataBase64 are required.' });
    }

    // Validate size (base64 overhead ~1.33x, 5MB raw → ~6.7MB base64)
    const MAX_B64_LEN = 6_800_000;
    if (dataBase64.length > MAX_B64_LEN) {
      return res.status(413).json({ status: 'error', message: 'File too large. Maximum 5 MB.' });
    }

    // Validate mime type (images, PDFs, plain text, logs)
    const ALLOWED_TYPES = [
      'image/png', 'image/jpeg', 'image/gif', 'image/webp',
      'application/pdf',
      'text/plain', 'text/csv',
    ];
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return res.status(415).json({ status: 'error', message: 'Unsupported file type.' });
    }

    // Sanitize filename
    const ext = path.extname(filename).replace(/[^.a-zA-Z0-9]/g, '').slice(0, 10) || 'bin';
    const safeFilename = `chat_${userId}_${Date.now()}.${ext}`;
    const uploadDir = path.resolve('uploads', 'chat');
    fs.mkdirSync(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, safeFilename);
    const fileBuffer = Buffer.from(dataBase64, 'base64');
    fs.writeFileSync(filePath, fileBuffer);

    const fileUrl = `/uploads/chat/${safeFilename}`;
    const fileSizeBytes = fileBuffer.byteLength;

    // If conversationId provided, store attachment reference in latest message
    if (conversationId) {
      await pool.query(
        `UPDATE chat_messages SET attachment_url = $1, attachment_type = $2,
                attachment_filename = $3, attachment_size_bytes = $4
         WHERE conversation_id = $5 AND sender = 'user'
         ORDER BY created_at DESC LIMIT 1`,
        [fileUrl, mimeType, filename, fileSizeBytes, conversationId]
      ).catch(() => {});
    }

    return res.status(200).json({
      status: 'success',
      data: { url: fileUrl, filename: safeFilename, mimeType, sizeBytes: fileSizeBytes },
    });
  } catch (error) {
    console.error('Upload chat file error:', error);
    res.status(500).json({ status: 'error', message: 'File upload failed.', error: error.message });
  }
};

// ============================================================================
// HANDOFF — request human technician
// ============================================================================

/**
 * POST /api/chat/handoff
 * Customer requests to talk to a human technician.
 * Creates a notification for available techs.
 */
export const requestHandoff = async (req, res) => {
  try {
    const { conversationId } = req.body;
    const userId = req.user.id;

    if (!conversationId) {
      return res.status(400).json({ status: 'error', message: 'conversationId is required.' });
    }

    const conversation = await ChatConversation.getById(parseInt(conversationId));
    if (!conversation || conversation.user_id !== userId) {
      return res.status(403).json({ status: 'error', message: 'Unauthorized.' });
    }

    // Mark conversation as handoff-requested
    await pool.query(
      `UPDATE chat_conversations SET handoff_requested_at = NOW() WHERE id = $1`,
      [conversationId]
    );

    // Get user info for notification
    const userRow = await pool.query(`SELECT first_name, last_name, email FROM users WHERE id = $1`, [userId]);
    const user = userRow.rows[0] || {};
    const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'A customer';

    // Notify all available technicians via existing notification system
    const techRows = await pool.query(
      `SELECT id FROM users WHERE role IN ('technician', 'senior_technician', 'admin') AND is_active = true`
    );

    const io = req.app.get('io');
    for (const tech of techRows.rows) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES ($1, 'chat_handoff', 'Handoff Request', $2, $3)`,
        [
          tech.id,
          `${displayName} is requesting to speak with a technician.`,
          JSON.stringify({ conversationId, customerId: userId }),
        ]
      ).catch(() => {});
      if (io) io.to(`user_${tech.id}`).emit('notification', { type: 'chat_handoff', conversationId });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        conversationId,
        message: "I'm connecting you with an available technician. They'll join this chat shortly. ⏳",
      },
    });
  } catch (error) {
    console.error('Handoff request error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to request handoff.', error: error.message });
  }
};

/**
 * POST /api/chat/handoff/claim
 * Technician claims a handoff conversation.
 */
export const claimHandoff = async (req, res) => {
  try {
    const techUser = req.user;
    if (!TECH_ROLES.has(techUser.role)) {
      return res.status(403).json({ status: 'error', message: 'Requires tech role.' });
    }

    const { conversationId } = req.body;
    if (!conversationId) return res.status(400).json({ status: 'error', message: 'conversationId is required.' });

    const result = await pool.query(
      `UPDATE chat_conversations
         SET handoff_claimed_by = $1, handoff_claimed_at = NOW()
       WHERE id = $2
         AND handoff_requested_at IS NOT NULL
         AND handoff_claimed_by IS NULL
       RETURNING id, user_id`,
      [techUser.id, conversationId]
    );

    if (result.rowCount === 0) {
      return res.status(409).json({ status: 'error', message: 'Conversation already claimed or not found.' });
    }

    const conv = result.rows[0];
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${conv.user_id}`).emit('chat_claimed', {
        conversationId,
        techName: [techUser.firstName, techUser.lastName].filter(Boolean).join(' ') || 'A technician',
      });
    }

    return res.status(200).json({ status: 'success', data: { conversationId, claimed: true } });
  } catch (error) {
    console.error('Claim handoff error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to claim conversation.', error: error.message });
  }
};

/**
 * GET /api/chat/handoff/pending
 * Returns list of conversations awaiting tech claim. Tech-role only.
 */
export const getPendingHandoffs = async (req, res) => {
  try {
    const user = req.user;
    if (!TECH_ROLES.has(user.role)) return res.status(403).json({ status: 'error', message: 'Requires tech role.' });

    const rows = await pool.query(
      `SELECT cc.id AS conversation_id, cc.created_at, cc.handoff_requested_at,
              u.first_name, u.last_name, u.email,
              COUNT(cm.id) AS message_count
       FROM   chat_conversations cc
       JOIN   users u ON u.id = cc.user_id
       LEFT JOIN chat_messages cm ON cm.conversation_id = cc.id
       WHERE  cc.handoff_requested_at IS NOT NULL
         AND  cc.handoff_claimed_by IS NULL
       GROUP BY cc.id, u.first_name, u.last_name, u.email
       ORDER  BY cc.handoff_requested_at ASC`
    );

    return res.status(200).json({ status: 'success', data: rows.rows });
  } catch (error) {
    console.error('Get pending handoffs error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to get pending handoffs.' });
  }
};

// ============================================================================
// CHAT ANALYTICS  (Management / Admin view)
// ============================================================================

/**
 * GET /api/chat/analytics
 * Returns chat usage statistics for management dashboard.
 * Restricted to management / admin roles.
 */
export const getChatAnalytics = async (req, res) => {
  try {
    const user = req.user;
    if (!['management', 'admin'].includes(user.role)) {
      return res.status(403).json({ status: 'error', message: 'Requires management or admin role.' });
    }

    const { period = '30d' } = req.query;
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;

    const [
      summaryRows, dailyRows, intentRows, resolutionRows,
      feedbackRows, peakRows, deflectionRows, techUsageRows,
    ] = await Promise.all([
      // Overall summary
      pool.query(`
        SELECT
          COUNT(DISTINCT cc.id)                              AS total_conversations,
          COUNT(cm.id)                                       AS total_messages,
          ROUND(AVG(msg_per_conv.cnt), 1)                    AS avg_messages_per_conversation,
          COUNT(DISTINCT cc.id) FILTER (WHERE cc.was_helpful = true) AS helpful_count,
          COUNT(DISTINCT cc.id) FILTER (WHERE cc.was_helpful = false) AS not_helpful_count
        FROM chat_conversations cc
        LEFT JOIN chat_messages cm ON cm.conversation_id = cc.id
        LEFT JOIN (
          SELECT conversation_id, COUNT(*) AS cnt FROM chat_messages GROUP BY conversation_id
        ) msg_per_conv ON msg_per_conv.conversation_id = cc.id
        WHERE cc.created_at >= NOW() - INTERVAL '${days} days'`),

      // Conversations per day
      pool.query(`
        SELECT DATE(created_at) AS day, COUNT(*) AS conversations
        FROM   chat_conversations
        WHERE  created_at >= NOW() - INTERVAL '${days} days'
        GROUP  BY day ORDER BY day`),

      // Top intents
      pool.query(`
        SELECT intent, COUNT(*) AS count
        FROM   chat_messages
        WHERE  sender = 'user' AND created_at >= NOW() - INTERVAL '${days} days'
          AND  intent IS NOT NULL AND intent NOT IN ('response_greeting','response_farewell')
        GROUP  BY intent ORDER BY count DESC LIMIT 10`),

      // Resolution breakdown
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE ended_at IS NOT NULL AND was_helpful = true)  AS resolved_without_ticket,
          COUNT(*) FILTER (WHERE handoff_requested_at IS NOT NULL)             AS escalated_to_human,
          COUNT(*) FILTER (WHERE ended_at IS NULL AND handoff_requested_at IS NULL) AS still_open,
          COUNT(*)                                                              AS total
        FROM chat_conversations
        WHERE created_at >= NOW() - INTERVAL '${days} days'`),

      // Feedback rates
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE was_helpful = true)  AS positive,
          COUNT(*) FILTER (WHERE was_helpful = false) AS negative,
          COUNT(*) FILTER (WHERE was_helpful IS NULL) AS no_rating
        FROM chat_conversations
        WHERE created_at >= NOW() - INTERVAL '${days} days'`),

      // Peak hours heatmap (hour-of-day × day-of-week)
      pool.query(`
        SELECT
          EXTRACT(DOW FROM created_at)  AS dow,
          EXTRACT(HOUR FROM created_at) AS hour,
          COUNT(*) AS count
        FROM chat_messages
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY dow, hour ORDER BY dow, hour`),

      // Article suggestion deflection
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE action = 'shown')            AS suggestions_shown,
          COUNT(*) FILTER (WHERE action = 'clicked')          AS articles_clicked,
          COUNT(*) FILTER (WHERE action = 'dismissed')        AS suggestions_dismissed,
          COUNT(*) FILTER (WHERE action = 'ticket_cancelled') AS tickets_cancelled
        FROM chat_article_suggestion_events
        WHERE created_at >= NOW() - INTERVAL '${days} days'`),

      // Tech mode usage
      pool.query(`
        SELECT
          u.first_name, u.last_name, u.email,
          COUNT(DISTINCT cc.id) AS conversations,
          COUNT(cm.id)          AS messages_sent
        FROM   chat_conversations cc
        JOIN   users u ON u.id = cc.user_id
        LEFT JOIN chat_messages cm ON cm.conversation_id = cc.id AND cm.sender = 'user'
        WHERE  cc.chat_mode = 'tech'
          AND  cc.created_at >= NOW() - INTERVAL '${days} days'
        GROUP  BY u.id, u.first_name, u.last_name, u.email
        ORDER  BY messages_sent DESC LIMIT 10`),
    ]);

    const summary = summaryRows.rows[0] || {};
    const resolution = resolutionRows.rows[0] || {};
    const feedback = feedbackRows.rows[0] || {};
    const deflection = deflectionRows.rows[0] || {};

    // Compute deflection rate
    const suggestionsShown = parseInt(deflection.suggestions_shown || 0);
    const ticketsCancelled = parseInt(deflection.tickets_cancelled || 0);
    const deflectionRate = suggestionsShown > 0
      ? ((ticketsCancelled / suggestionsShown) * 100).toFixed(1)
      : '0.0';

    return res.status(200).json({
      status: 'success',
      data: {
        period,
        summary: {
          totalConversations:     parseInt(summary.total_conversations || 0),
          totalMessages:          parseInt(summary.total_messages || 0),
          avgMessagesPerConv:     parseFloat(summary.avg_messages_per_conversation || 0),
        },
        feedback: {
          positive:  parseInt(feedback.positive || 0),
          negative:  parseInt(feedback.negative || 0),
          noRating:  parseInt(feedback.no_rating || 0),
        },
        resolution: {
          resolvedWithoutTicket: parseInt(resolution.resolved_without_ticket || 0),
          escalatedToHuman:      parseInt(resolution.escalated_to_human || 0),
          stillOpen:             parseInt(resolution.still_open || 0),
          total:                 parseInt(resolution.total || 0),
        },
        deflection: {
          suggestionsShown,
          articlesClicked:       parseInt(deflection.articles_clicked || 0),
          suggestionsDismissed:  parseInt(deflection.suggestions_dismissed || 0),
          ticketsCancelled,
          deflectionRatePct:     parseFloat(deflectionRate),
        },
        dailyConversations: dailyRows.rows,
        topIntents:         intentRows.rows,
        peakHeatmap:        peakRows.rows,
        techModeUsage:      techUsageRows.rows,
      },
    });
  } catch (error) {
    console.error('Chat analytics error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch analytics.', error: error.message });
  }
};
