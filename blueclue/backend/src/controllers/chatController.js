import { processChatMessage, getConversationHistory, clearChatHistory, suggestArticlesForText, processTechCommand } from '../services/chatService.js';
import { generateTicketSummary, checkLLMHealth } from '../services/llmService.js';
import ChatConversation from '../models/ChatConversation.js';
import ChatMessage from '../models/ChatMessage.js';
import pool from '../config/database.js';
import path from 'path';
import fs from 'fs';
import { redactPII } from '../utils/piiRedactor.js';
import { classifyTicketWithFallback } from '../services/aiService.js';
import { calculateFinalPriority } from '../services/priorityService.js';
import AIConfiguration from '../models/AIConfiguration.js';
import AIClassification from '../models/AIClassification.js';

// ── Audit helper ─────────────────────────────────────────────────────────────
async function auditLog(eventType, userId, conversationId, details, req) {
  try {
    await pool.query(
      `INSERT INTO chat_audit_log (event_type, user_id, conversation_id, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        eventType,
        userId   || null,
        conversationId || null,
        req?.ip  || null,
        req?.headers?.['user-agent']?.slice(0, 255) || null,
        JSON.stringify(details || {}),
      ]
    );
  } catch {
    // Non-critical — never fail the main request over audit logging
  }
}

// ── Knowledge gap tracker ─────────────────────────────────────────────────────
async function trackKnowledgeGap(queryText, { lowConfidence = false, thumbsDown = false, ticketCreated = false } = {}) {
  if (!queryText || queryText.trim().length < 5) return;
  const normalised = queryText.trim().toLowerCase().slice(0, 500);
  try {
    await pool.query(
      `INSERT INTO chat_knowledge_gaps
         (query_text, query_normalized, occurrence_count, low_confidence_count, thumbs_down_count, ticket_created_count, last_seen)
       VALUES ($1, $2, 1, $3, $4, $5, NOW())
       ON CONFLICT (query_normalized) DO UPDATE SET
         occurrence_count     = chat_knowledge_gaps.occurrence_count + 1,
         low_confidence_count = chat_knowledge_gaps.low_confidence_count + EXCLUDED.low_confidence_count,
         thumbs_down_count    = chat_knowledge_gaps.thumbs_down_count    + EXCLUDED.thumbs_down_count,
         ticket_created_count = chat_knowledge_gaps.ticket_created_count + EXCLUDED.ticket_created_count,
         last_seen            = NOW()`,
      [
        queryText.trim().slice(0, 500),
        normalised,
        lowConfidence ? 1 : 0,
        thumbsDown    ? 1 : 0,
        ticketCreated ? 1 : 0,
      ]
    );
  } catch {
    // Non-critical
  }
}

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

    // During active handoff: forward customer message as socket event to the claiming tech
    if (result.conversationId) {
      try {
        const convRow = await pool.query(
          `SELECT handoff_claimed_by FROM chat_conversations WHERE id = $1 LIMIT 1`,
          [result.conversationId]
        );
        const claimedBy = convRow.rows[0]?.handoff_claimed_by;
        if (claimedBy) {
          const io = req.app.get('io');
          if (io) {
            io.to(`user_${claimedBy}`).emit('customer_message', {
              conversationId: result.conversationId,
              message:        message.trim(),
              timestamp:      new Date(),
            });
          }
        }
      } catch (emitErr) {
        // Non-critical — don't fail the HTTP response
        console.warn('customer_message emit error:', emitErr.message);
      }
    }

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
 * Body: { messageId, helpful, reason?, details? }
 */
export const submitFeedback = async (req, res) => {
  try {
    const { messageId, helpful, reason, details } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!messageId) {
      return res.status(400).json({ status: 'error', message: 'messageId is required' });
    }
    if (typeof helpful !== 'boolean') {
      return res.status(400).json({ status: 'error', message: 'helpful must be a boolean value' });
    }

    // Validate negative-feedback reason if thumbs down
    const VALID_REASONS = ['no_answer', 'wrong_info', 'unhelpful_tone', 'too_slow', 'other'];
    if (!helpful && reason && !VALID_REASONS.includes(reason)) {
      return res.status(400).json({ status: 'error', message: 'Invalid failure reason.' });
    }

    // Get message and verify ownership
    const message = await ChatMessage.getById(parseInt(messageId));
    if (!message) return res.status(404).json({ status: 'error', message: 'Message not found' });

    const conversation = await ChatConversation.getById(message.conversation_id);
    if (!conversation || conversation.user_id !== userId) {
      return res.status(403).json({ status: 'error', message: 'Unauthorized to rate this message' });
    }

    const rating = helpful ? 'positive' : 'negative';
    const safeDetails = details ? redactPII(details.slice(0, 500)) : null;

    // Persist to chat_message_feedback (upsert — one rating per message per user)
    await pool.query(
      `INSERT INTO chat_message_feedback
         (message_id, conversation_id, user_id, rating, failure_reason, details)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (message_id, user_id) DO UPDATE SET
         rating         = EXCLUDED.rating,
         failure_reason = EXCLUDED.failure_reason,
         details        = EXCLUDED.details`,
      [messageId, conversation.id, userId, rating, reason || null, safeDetails]
    );

    // Also update the lightweight was_helpful flag on the conversation
    await ChatConversation.updateHelpfulness(conversation.id, helpful);

    // Track knowledge gap when thumbs down
    if (!helpful && message.message) {
      await trackKnowledgeGap(message.message, { thumbsDown: true });
    }

    // Audit
    await auditLog('message_feedback', userId, conversation.id, { messageId, rating, reason }, req);

    res.status(200).json({
      status: 'success',
      message: 'Feedback submitted successfully',
      data: { conversationId: conversation.id, helpful },
    });

  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to submit feedback', error: error.message });
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

    // ── ML classification for category + priority ──────────────────────────
    let finalCategory = 'general';
    let finalPriority = 'low';
    let aiClassified  = false;
    let aiConfidence  = null;

    try {
      const ticketText = `${ticketSubject}. ${ticketDescription}`;
      const aiResult = await classifyTicketWithFallback(ticketText, {
        category: 'general',
        priority:  'low',
      });

      finalCategory = aiResult.category || 'general';

      if (aiResult.aiClassified) {
        const priorityConfig = await AIConfiguration.getPriorityWeights();
        const calc = calculateFinalPriority({
          userPriority:  null,
          aiPriority:    aiResult.priority || 'low',
          aiConfidence:  aiResult.confidence || 0,
          config:        priorityConfig,
        });
        finalPriority = calc.finalPriority || 'low';
        aiClassified  = true;
        aiConfidence  = aiResult.confidence;
      }
    } catch (mlErr) {
      // ML failure is non-fatal – keep defaults
      console.warn('ML classification failed for chat ticket, using defaults:', mlErr.message);
    }

    // Insert ticket (ticket_number is auto-generated by DB trigger)
    const result = await pool.query(
      `INSERT INTO tickets
         (subject, description, customer_id, status, priority, category,
          ai_classified, ai_confidence, ai_fallback_used)
       VALUES ($1, $2, $3::integer, 'open', $4, $5, $6, $7, $8)
       RETURNING id, ticket_number, subject, status, priority, category, created_at`,
      [ticketSubject, ticketDescription, userId, finalPriority, finalCategory,
       aiClassified, aiConfidence, !aiClassified],
    );

    const ticket = result.rows[0];

    // Record classification in ai_classifications so the ML dashboard picks it up
    if (aiClassified) {
      await AIClassification.create({
        ticket_id:           ticket.id,
        predicted_category:  finalCategory,
        predicted_priority:  finalPriority,
        confidence:          aiConfidence,
        keywords_matched:    null,
        fallback_used:       false,
      }).catch(err => console.warn('Failed to save AI classification record (chat ticket):', err.message));
    }

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
 * GET /api/chat/summary/:conversationId
 * Generate a ticket summary from a conversation WITHOUT creating a ticket.
 * Used by TicketFromChatModal to pre-fill editable fields.
 */
export const getConversationSummary = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const conversation = await ChatConversation.getById(parseInt(conversationId));
    if (!conversation) {
      return res.status(404).json({ status: 'error', message: 'Conversation not found.' });
    }

    // Allow tech roles to summarize any conversation; customers only their own
    const TECH_ROLES_SET = new Set(['technician', 'senior_technician', 'management', 'admin']);
    if (!TECH_ROLES_SET.has(req.user.role) && conversation.user_id !== userId) {
      return res.status(403).json({ status: 'error', message: 'Unauthorized.' });
    }

    const messages = await ChatMessage.getByConversationId(parseInt(conversationId), 30);

    let title = 'Support Request';
    let description = 'Submitted via chat assistant';

    try {
      const summary = await generateTicketSummary(messages);
      title       = summary.title       || title;
      description = summary.description || description;
    } catch {
      // fallback: use first real user message
      const first = messages.find(m => m.sender === 'user');
      if (first?.message) title = first.message.slice(0, 100);
      description = messages
        .filter(m => m.sender === 'user')
        .map(m => m.message)
        .join('\n');
    }

    // Build a readable transcript
    const transcript = messages.map(m => {
      const who = m.sender === 'user' ? 'Customer' : m.sender === 'tech' ? 'Technician' : 'Bot';
      return `[${who}] ${m.message || ''}`;
    }).join('\n');

    return res.status(200).json({
      status: 'success',
      data: { title, description, transcript },
    });
  } catch (error) {
    console.error('Get conversation summary error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to generate summary.', error: error.message });
  }
};


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

    // Mark conversation as handoff-requested, resetting any stale claim/resolve from a previous session
    await pool.query(
      `UPDATE chat_conversations
         SET handoff_requested_at  = NOW(),
             handoff_claimed_by    = NULL,
             handoff_claimed_at    = NULL,
             handoff_resolved_at   = NULL,
             ended_at              = NULL
       WHERE id = $1`,
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
        `INSERT INTO notifications (user_id, type, message, metadata)
         VALUES ($1, 'chat_handoff', $2, $3)`,
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
 * POST /api/chat/handoff/reply
 * Tech sends a reply message in a claimed handoff conversation.
 */
export const sendHandoffReply = async (req, res) => {
  try {
    const techUser = req.user;
    if (!TECH_ROLES.has(techUser.role)) {
      return res.status(403).json({ status: 'error', message: 'Requires tech role.' });
    }

    const { conversationId, message } = req.body;
    if (!conversationId || !message?.trim()) {
      return res.status(400).json({ status: 'error', message: 'conversationId and message are required.' });
    }

    // Verify this tech claimed this conversation
    const convRow = await pool.query(
      `SELECT id, user_id, handoff_claimed_by FROM chat_conversations WHERE id = $1 LIMIT 1`,
      [conversationId]
    );
    if (!convRow.rows.length) {
      return res.status(404).json({ status: 'error', message: 'Conversation not found.' });
    }
    const conv = convRow.rows[0];
    if (conv.handoff_claimed_by !== techUser.id) {
      return res.status(403).json({ status: 'error', message: 'You have not claimed this conversation.' });
    }

    // Store message as sender='tech'
    const msgRow = await pool.query(
      `INSERT INTO chat_messages (conversation_id, sender, message, intent, confidence)
       VALUES ($1, 'tech', $2, 'tech_reply', 1.0)
       RETURNING id, created_at`,
      [conversationId, message.trim()]
    );
    const msg = msgRow.rows[0];

    // Emit to customer's socket in real-time
    const techName = [techUser.firstName, techUser.lastName].filter(Boolean).join(' ') || 'A technician';
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${conv.user_id}`).emit('tech_reply', {
        conversationId,
        message:   message.trim(),
        techName,
        messageId: msg.id,
        timestamp: msg.created_at,
      });
    }

    return res.status(200).json({
      status: 'success',
      data: { messageId: msg.id, timestamp: msg.created_at },
    });
  } catch (error) {
    console.error('Handoff reply error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to send reply.', error: error.message });
  }
};

/**
 * POST /api/chat/handoff/resolve
 * Tech closes a claimed handoff conversation.
 */
export const resolveHandoff = async (req, res) => {
  try {
    const techUser = req.user;
    if (!TECH_ROLES.has(techUser.role)) {
      return res.status(403).json({ status: 'error', message: 'Requires tech role.' });
    }

    const { conversationId } = req.body;
    if (!conversationId) return res.status(400).json({ status: 'error', message: 'conversationId is required.' });

    const result = await pool.query(
      `UPDATE chat_conversations
         SET handoff_resolved_at  = NOW(),
             ended_at             = NOW(),
             handoff_claimed_by   = NULL,
             handoff_claimed_at   = NULL,
             handoff_requested_at = NULL
       WHERE id = $1 AND handoff_claimed_by = $2
       RETURNING id, user_id`,
      [conversationId, techUser.id]
    );

    if (result.rowCount === 0) {
      return res.status(403).json({ status: 'error', message: 'Not your conversation or already resolved.' });
    }

    const conv = result.rows[0];
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${conv.user_id}`).emit('handoff_resolved', { conversationId });
    }

    return res.status(200).json({ status: 'success', data: { conversationId } });
  } catch (error) {
    console.error('Resolve handoff error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to resolve handoff.', error: error.message });
  }
};

/**
 * GET /api/chat/handoff/:conversationId/history
 * Tech fetches full message history of a handoff conversation.
 */
export const getHandoffHistory = async (req, res) => {
  try {
    const techUser = req.user;
    if (!TECH_ROLES.has(techUser.role)) {
      return res.status(403).json({ status: 'error', message: 'Requires tech role.' });
    }

    const { conversationId } = req.params;

    const [convRow, msgRows, userRow] = await Promise.all([
      pool.query(`SELECT cc.*, u.first_name, u.last_name, u.email, u.role AS customer_role
                  FROM chat_conversations cc
                  JOIN users u ON u.id = cc.user_id
                  WHERE cc.id = $1 LIMIT 1`, [conversationId]),
      pool.query(`SELECT id, sender, message, intent, attachment_url, attachment_type,
                         attachment_filename, created_at
                  FROM chat_messages
                  WHERE conversation_id = $1
                  ORDER BY created_at ASC`, [conversationId]),
      // Past tickets for this customer (context)
      pool.query(`SELECT ticket_number, subject, status, created_at
                  FROM tickets
                  WHERE customer_id = (SELECT user_id FROM chat_conversations WHERE id = $1 LIMIT 1)
                  ORDER BY created_at DESC LIMIT 5`, [conversationId]),
    ]);

    if (!convRow.rows.length) {
      return res.status(404).json({ status: 'error', message: 'Conversation not found.' });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        conversation: convRow.rows[0],
        messages:     msgRows.rows,
        pastTickets:  userRow.rows,
      },
    });
  } catch (error) {
    console.error('Get handoff history error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to get history.', error: error.message });
  }
};


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
        SELECT TO_CHAR(DATE(created_at), 'YYYY-MM-DD') AS day, COUNT(*) AS conversations
        FROM   chat_conversations
        WHERE  created_at >= NOW() - INTERVAL '${days} days'
        GROUP  BY DATE(created_at) ORDER BY DATE(created_at)`),

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
// ============================================================================
// CONVERSATION SURVEY  (end-of-conversation rating)
// ============================================================================

/**
 * POST /api/chat/survey
 * Submit end-of-conversation survey.
 * Body: { conversationId, rating (1-5), solved, wouldUseAgain, npsScore (0-10), feedbackText }
 */
export const submitConversationSurvey = async (req, res) => {
  try {
    const {
      conversationId,
      rating,
      solved,
      wouldUseAgain,
      npsScore,
      feedbackText,
    } = req.body;
    const userId = req.user.id;

    if (!conversationId) {
      return res.status(400).json({ status: 'error', message: 'conversationId is required.' });
    }

    // Verify ownership
    const conversation = await ChatConversation.getById(parseInt(conversationId));
    if (!conversation || conversation.user_id !== userId) {
      return res.status(403).json({ status: 'error', message: 'Unauthorized.' });
    }

    // Validate ranges
    if (rating !== undefined && rating !== null && (rating < 1 || rating > 5)) {
      return res.status(400).json({ status: 'error', message: 'Rating must be between 1 and 5.' });
    }
    if (npsScore !== undefined && npsScore !== null && (npsScore < 0 || npsScore > 10)) {
      return res.status(400).json({ status: 'error', message: 'NPS score must be between 0 and 10.' });
    }

    // Redact PII from free-text
    const safeText = feedbackText ? redactPII(feedbackText.trim().slice(0, 1000)) : null;

    // Upsert (one survey per conversation)
    await pool.query(
      `INSERT INTO conversation_feedback
         (conversation_id, user_id, rating, solved, would_use_again, nps_score, feedback_text)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (conversation_id) DO UPDATE SET
         rating          = EXCLUDED.rating,
         solved          = EXCLUDED.solved,
         would_use_again = EXCLUDED.would_use_again,
         nps_score       = EXCLUDED.nps_score,
         feedback_text   = EXCLUDED.feedback_text`,
      [
        conversationId,
        userId,
        rating       ?? null,
        solved       ?? null,
        wouldUseAgain ?? null,
        npsScore     ?? null,
        safeText,
      ]
    );

    // Audit
    await auditLog('survey_submitted', userId, parseInt(conversationId), { rating, npsScore }, req);

    return res.status(200).json({ status: 'success', message: 'Survey submitted. Thank you!' });

  } catch (error) {
    console.error('Submit survey error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to submit survey.', error: error.message });
  }
};

// ============================================================================
// KNOWLEDGE GAPS (management only)
// ============================================================================

/**
 * GET /api/chat/analytics/knowledge-gaps
 * Returns top unanswered / low-quality queries to guide KB content creation.
 * Query params: limit (default 20), resolved (default false)
 */
export const getKnowledgeGaps = async (req, res) => {
  try {
    const user = req.user;
    if (!['management', 'admin'].includes(user.role)) {
      return res.status(403).json({ status: 'error', message: 'Requires management or admin role.' });
    }

    const limit    = Math.min(parseInt(req.query.limit) || 20, 100);
    const resolved = req.query.resolved === 'true';

    const [gapsRows, satisfactionRows, npsRows] = await Promise.all([
      // Top knowledge gaps
      pool.query(
        `SELECT id, query_text, occurrence_count, low_confidence_count,
                thumbs_down_count, ticket_created_count, first_seen, last_seen,
                suggested_article_title, resolved
         FROM chat_knowledge_gaps
         WHERE resolved = $1
         ORDER BY (thumbs_down_count * 3 + low_confidence_count * 2 + occurrence_count) DESC
         LIMIT $2`,
        [resolved, limit]
      ),

      // 30-day satisfaction trend (avg star rating per week)
      pool.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('week', cf.created_at), 'YYYY-MM-DD') AS week,
          ROUND(AVG(cf.rating)::numeric, 2)  AS avg_rating,
          COUNT(*)                            AS responses,
          ROUND(AVG(cf.nps_score)::numeric, 2) AS avg_nps
        FROM conversation_feedback cf
        WHERE cf.created_at >= NOW() - INTERVAL '90 days'
          AND cf.rating IS NOT NULL
        GROUP BY DATE_TRUNC('week', cf.created_at)
        ORDER BY DATE_TRUNC('week', cf.created_at)`),

      // NPS breakdown
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE nps_category = 'promoter')  AS promoters,
          COUNT(*) FILTER (WHERE nps_category = 'passive')   AS passives,
          COUNT(*) FILTER (WHERE nps_category = 'detractor') AS detractors,
          COUNT(*) FILTER (WHERE nps_score IS NOT NULL)       AS total_nps_responses,
          ROUND(
            (COUNT(*) FILTER (WHERE nps_category = 'promoter')::numeric -
             COUNT(*) FILTER (WHERE nps_category = 'detractor')::numeric)
            / NULLIF(COUNT(*) FILTER (WHERE nps_score IS NOT NULL), 0)::numeric * 100, 1
          ) AS nps_score
        FROM conversation_feedback
        WHERE created_at >= NOW() - INTERVAL '30 days'`),
    ]);

    const nps = npsRows.rows[0] || {};

    return res.status(200).json({
      status: 'success',
      data: {
        knowledgeGaps:      gapsRows.rows,
        satisfactionTrend:  satisfactionRows.rows,
        nps: {
          promoters:   parseInt(nps.promoters  || 0),
          passives:    parseInt(nps.passives   || 0),
          detractors:  parseInt(nps.detractors || 0),
          total:       parseInt(nps.total_nps_responses || 0),
          score:       parseFloat(nps.nps_score || 0),
        },
      },
    });

  } catch (error) {
    console.error('Get knowledge gaps error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch knowledge gaps.', error: error.message });
  }
};

// ============================================================================
// GDPR — export user conversation history
// ============================================================================

/**
 * GET /api/chat/export-my-data
 * Export all conversations + messages for the requesting user (GDPR Art. 20).
 */
export const exportMyData = async (req, res) => {
  try {
    const userId = req.user.id;

    const [convsRows, msgsRows, feedbackRows] = await Promise.all([
      pool.query(
        `SELECT id, started_at, ended_at, was_helpful, created_at
         FROM chat_conversations WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      ),
      pool.query(
        `SELECT cm.id, cm.conversation_id, cm.sender, cm.message,
                cm.intent, cm.timestamp
         FROM chat_messages cm
         JOIN chat_conversations cc ON cc.id = cm.conversation_id
         WHERE cc.user_id = $1
         ORDER BY cm.timestamp ASC`,
        [userId]
      ),
      pool.query(
        `SELECT conversation_id, rating, solved, would_use_again, nps_score, created_at
         FROM conversation_feedback WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      ),
    ]);

    // Audit the export access
    await auditLog('data_export', userId, null, { format: 'json' }, req);

    return res.status(200).json({
      status: 'success',
      data: {
        exportedAt:    new Date().toISOString(),
        userId,
        conversations: convsRows.rows,
        messages:      msgsRows.rows,
        feedback:      feedbackRows.rows,
      },
    });

  } catch (error) {
    console.error('Export data error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to export data.', error: error.message });
  }
};