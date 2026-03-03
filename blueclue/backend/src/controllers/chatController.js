import { processChatMessage, getConversationHistory, clearChatHistory } from '../services/chatService.js';
import { generateTicketSummary, checkLLMHealth } from '../services/llmService.js';
import ChatConversation from '../models/ChatConversation.js';
import ChatMessage from '../models/ChatMessage.js';
import pool from '../config/database.js';

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
