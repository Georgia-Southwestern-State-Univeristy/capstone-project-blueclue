import ChatMessage from '../models/ChatMessage.js';
import ChatConversation from '../models/ChatConversation.js';
import pool from '../config/database.js';
import { processMessageWithLLM } from './llmService.js';

/**
 * Message Processing Service
 * ===========================
 * Primary path  : LLM + RAG (context-aware, grounded in KB articles)
 * Fallback path : Rule-based intent recognition + keyword KB search
 *
 * The LLM path is attempted first; if it fails (service down, API error,
 * kill-switch) or returns fallbackUsed=true the existing rule-based logic
 * handles the message transparently.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** Number of previous messages loaded into context / passed to LLM */
const HISTORY_LIMIT = 10;

// ============================================================================
// INTENT DEFINITIONS
// ============================================================================

/**
 * Each intent has:
 *   keywords       – matched against the lowercased user message
 *   articleSlug    – preferred KB article slug (used for lookup)
 *   articleCategory – fallback KB category if slug lookup fails
 */
const INTENT_DEFINITIONS = {
  password_reset: {
    keywords: ['password', 'forgot', 'reset', 'login', "can't log in", 'cannot log in',
               'locked out', 'sign in', 'logged out', 'cant login', 'cant log'],
    articleSlug: 'how-to-reset-your-password',
    articleCategory: 'account-management',
  },
  printer_issues: {
    keywords: ['printer', 'print', "won't print", 'paper jam', 'printing',
               'not printing', 'jammed', 'jam', 'scanner'],
    articleSlug: 'printer-troubleshooting',
    articleCategory: 'hardware',
  },
  software_request: {
    keywords: ['install', 'software', 'need program', 'application', 'app',
               'download', 'request software', 'new software', 'program request'],
    articleSlug: 'how-to-request-software',
    articleCategory: 'software',
  },
  network_wifi: {
    keywords: ['wifi', 'wi-fi', 'internet', 'connection', 'network', "can't connect",
               'cannot connect', 'offline', 'no wifi', 'no internet', 'wireless', 'vpn'],
    articleSlug: 'wifi-setup-guide',
    articleCategory: 'network',
  },
  email_issues: {
    keywords: ['email', 'outlook', "can't send", "can't receive", 'mail', 'inbox',
               'sending email', 'receiving email', 'email not working', 'email setup'],
    articleSlug: 'email-configuration-guide',
    articleCategory: 'email',
  },
  general_help: {
    keywords: ['help', 'support', 'what can you do', 'what do you do', 'assist',
               'guide me', 'capabilities', 'how do i', 'show me'],
    articleSlug: null,
    articleCategory: null,
  },
  greeting: {
    keywords: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy'],
    articleSlug: null,
    articleCategory: null,
  },
  create_ticket: {
    keywords: ['create ticket', 'new ticket', 'submit ticket', 'open ticket',
               'report issue', 'raise ticket', 'log ticket'],
    articleSlug: null,
    articleCategory: null,
  },
  check_status: {
    keywords: ['ticket status', 'check ticket', 'ticket update', 'my tickets',
               'where is my ticket', 'status of my', 'check my ticket'],
    articleSlug: null,
    articleCategory: null,
  },
  escalation: {
    keywords: ['speak to human', 'talk to person', 'escalate', 'manager',
               'supervisor', 'real person', 'human agent'],
    articleSlug: null,
    articleCategory: null,
  },
  gratitude: {
    keywords: ['thank', 'thanks', 'appreciate', 'helpful', 'great', 'perfect', 'awesome'],
    articleSlug: null,
    articleCategory: null,
  },
  farewell: {
    keywords: ['bye', 'goodbye', 'see you', 'exit', 'quit', 'done', 'close'],
    articleSlug: null,
    articleCategory: null,
  },
};

/** Keywords that signal the user is frustrated or the previous answer didn't help */
const FRUSTRATION_KEYWORDS = [
  'still not working', "doesn't help", 'doesnt help', "didn't work", 'didnt work',
  'not working', 'still broken', 'frustrated', 'useless', 'not helpful',
  'tried that', 'already tried', 'nothing works', 'no it', 'nope', 'that didnt',
  "that didn't", 'still having', 'still getting',
];

// ============================================================================
// INTENT RECOGNITION
// ============================================================================

/**
 * Enhanced keyword-based intent recognition with confidence scoring.
 *
 * Confidence rules:
 *   matchCount >= 2  → 0.85  (high confidence — act immediately)
 *   matchCount === 1 → 0.50  (low confidence  — fall back to KB search)
 *   matchCount === 0 → 0.30  (no match        — pure KB search / offer ticket)
 *
 * @param {string} message
 * @returns {{ intent: string, confidence: number, matchCount: number, isFrustrated: boolean }}
 */
function recognizeIntent(message) {
  const lc = message.toLowerCase();

  const isFrustrated = FRUSTRATION_KEYWORDS.some(kw => lc.includes(kw));

  let bestMatch = { intent: 'general_inquiry', confidence: 0.3, matchCount: 0 };

  for (const [intent, def] of Object.entries(INTENT_DEFINITIONS)) {
    let matchCount = 0;
    for (const kw of def.keywords) {
      if (lc.includes(kw)) matchCount++;
    }
    if (matchCount === 0) continue;

    const confidence = matchCount >= 2 ? 0.85 : 0.50;
    if (
      matchCount > bestMatch.matchCount ||
      (matchCount === bestMatch.matchCount && confidence > bestMatch.confidence)
    ) {
      bestMatch = { intent, confidence, matchCount };
    }
  }

  return { ...bestMatch, isFrustrated };
}

// ============================================================================
// KNOWLEDGE BASE HELPERS
// ============================================================================

/**
 * Full-text search the knowledge base for up to `limit` articles.
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<Array<{id, title, slug, category, excerpt}>>}
 */
async function searchKnowledgeBase(query, limit = 3) {
  if (!query || query.trim().length < 3) return [];
  try {
    const result = await pool.query(
      `SELECT id, title, slug, category,
              COALESCE(excerpt, LEFT(content, 200)) AS excerpt
       FROM   knowledge_articles
       WHERE  deleted_at IS NULL
         AND  is_published = true
         AND  is_public    = true
         AND  (
               search_vector @@ plainto_tsquery('english', $1)
               OR title   ILIKE $2
               OR content ILIKE $2
             )
       ORDER  BY ts_rank_cd(search_vector, plainto_tsquery('english', $1), 32) DESC,
                 helpful_votes DESC
       LIMIT  $3`,
      [query.trim(), `%${query.trim()}%`, limit],
    );
    return result.rows.map(r => ({
      id: r.id, title: r.title, slug: r.slug,
      category: r.category, excerpt: r.excerpt,
    }));
  } catch (err) {
    console.error('KB search error:', err);
    return [];
  }
}

/**
 * Look up the canonical article for a known intent (by preferred slug,
 * then by category fallback).
 * @param {string} intent
 * @returns {Promise<Object|null>}
 */
async function findIntentArticle(intent) {
  const def = INTENT_DEFINITIONS[intent];
  if (!def || !def.articleSlug) return null;
  try {
    // Try exact slug first
    const slugResult = await pool.query(
      `SELECT id, title, slug, category,
              COALESCE(excerpt, LEFT(content, 200)) AS excerpt
       FROM   knowledge_articles
       WHERE  deleted_at IS NULL AND is_published = true AND is_public = true
         AND  slug = $1
       LIMIT 1`,
      [def.articleSlug],
    );
    if (slugResult.rows.length > 0) return slugResult.rows[0];

    // Fallback: best article in the same category
    if (def.articleCategory) {
      const catResult = await pool.query(
        `SELECT id, title, slug, category,
                COALESCE(excerpt, LEFT(content, 200)) AS excerpt
         FROM   knowledge_articles
         WHERE  deleted_at IS NULL AND is_published = true AND is_public = true
           AND  category = $1
         ORDER  BY helpful_votes DESC, views DESC
         LIMIT 1`,
        [def.articleCategory],
      );
      return catResult.rows[0] || null;
    }
    return null;
  } catch (err) {
    console.error('Intent article lookup error:', err);
    return null;
  }
}

// ============================================================================
// CONTEXT ANALYSIS  (last 5 messages)
// ============================================================================

/**
 * Derive context from the most recent conversation messages.
 * @param {Array} previousMessages
 * @returns {{ seenArticleIds: Set, previousIntents: string[], frustrationLevel: number }}
 */
function analyzeContext(previousMessages) {
  const seenArticleIds = new Set();
  const previousIntents = [];
  let frustrationLevel = 0;

  for (const msg of previousMessages) {
    if (msg.intent) previousIntents.push(msg.intent);

    // Collect article IDs already suggested to this user
    if (msg.sender === 'bot' && msg.suggested_articles) {
      let articles = msg.suggested_articles;
      if (typeof articles === 'string') {
        try { articles = JSON.parse(articles); } catch { articles = []; }
      }
      if (Array.isArray(articles)) {
        articles.forEach(a => seenArticleIds.add(typeof a === 'object' ? a.id : a));
      }
    }

    // Count frustration signals from the user
    if (msg.sender === 'user') {
      const lc = (msg.message || '').toLowerCase();
      if (FRUSTRATION_KEYWORDS.some(kw => lc.includes(kw))) frustrationLevel++;
    }
  }

  return { seenArticleIds, previousIntents, frustrationLevel };
}

// ============================================================================
// RESPONSE GENERATION
// ============================================================================

/**
 * Build the bot's reply given detected intent, confidence, and conversation context.
 *
 * Returns:
 *   response      – text shown in the bubble
 *   articleLinks  – [{id, title, slug, category, excerpt}]
 *   actionButtons – [{id, label, primary}]
 *   suggestions   – quick-reply chip labels
 *
 * @param {string}  intent
 * @param {number}  confidence
 * @param {string}  userMessage
 * @param {{ seenArticleIds: Set, previousIntents: string[], frustrationLevel: number, isFrustrated: boolean }} ctx
 * @returns {Promise<Object>}
 */
async function generateResponse(intent, confidence, userMessage, ctx) {
  const { seenArticleIds, frustrationLevel, isFrustrated } = ctx;

  // ── Frustration / "nothing worked" path ───────────────────────────────────
  if (isFrustrated || frustrationLevel >= 1) {
    return {
      response: "I'm sorry the previous suggestions didn't resolve your issue. Let me connect you with a technician who can help directly.",
      articleLinks: [],
      actionButtons: [{ id: 'create_ticket', label: '🎫 Create a support ticket', primary: true }],
      suggestions: ['Create a support ticket', 'Try a different search'],
    };
  }

  // ── Simple intents that don't need articles ────────────────────────────────
  if (intent === 'greeting') {
    return {
      response: "Hello! I'm the BlueClue Assistant. How can I help you today?",
      articleLinks: [],
      actionButtons: [],
      suggestions: ['🔑 Password Reset', '🖨️ Printer Issues', '📦 Software Request', '📶 Network/WiFi', '📧 Email Issues'],
    };
  }
  if (intent === 'farewell') {
    return {
      response: "Thanks for using BlueClue Support! Have a great day! 👋 Come back anytime if you need help.",
      articleLinks: [], actionButtons: [], suggestions: [],
    };
  }
  if (intent === 'gratitude') {
    return {
      response: "You're welcome! Is there anything else I can help you with?",
      articleLinks: [], actionButtons: [],
      suggestions: ["Yes, I have another question", "No, that's all", 'Create a ticket'],
    };
  }
  if (intent === 'check_status') {
    return {
      response: "You can view all your support tickets from the Client Dashboard. Need help with something else?",
      articleLinks: [],
      actionButtons: [{ id: 'view_tickets', label: '📋 View my tickets', primary: false }],
      suggestions: ['View my tickets', 'Create a new ticket'],
    };
  }
  if (intent === 'create_ticket' || intent === 'escalation') {
    return {
      response: "No problem — I'll help you open a support ticket. A technician will be assigned and will respond as soon as possible.",
      articleLinks: [],
      actionButtons: [{ id: 'create_ticket', label: '🎫 Create a support ticket', primary: true }],
      suggestions: ['Create a support ticket'],
    };
  }
  if (intent === 'general_help' || intent === 'general_inquiry') {
    return {
      response: "I can help you with:\n\n• 🔑 Password resets\n• 🖨️ Printer troubleshooting\n• 📦 Software installation requests\n• 📶 Network & WiFi issues\n• 📧 Email configuration\n• 🎫 Creating support tickets\n\nWhat do you need help with?",
      articleLinks: [], actionButtons: [],
      suggestions: ['Password Reset', 'Printer Issues', 'Software Request', 'Network/WiFi', 'Email Issues', 'Create a Ticket'],
    };
  }

  // ── HIGH CONFIDENCE (≥ 0.75): look up canonical article for this intent ────
  if (confidence >= 0.75) {
    const article = await findIntentArticle(intent);

    // If user has already seen this exact article → skip article, offer ticket
    if (article && seenArticleIds.has(article.id)) {
      return {
        response: "It looks like you've already seen that guide and it might not have solved your issue. Would you like a technician to take a look?",
        articleLinks: [],
        actionButtons: [{ id: 'create_ticket', label: '🎫 Create a support ticket', primary: true }],
        suggestions: ['Create a support ticket', 'Search for something else'],
      };
    }

    const intentMeta = {
      password_reset:   { text: "Here's the guide to reset your password:", action: { id: 'password_reset_link', label: '🔑 Reset my password now', primary: false } },
      printer_issues:   { text: "Here's our Printer Troubleshooting guide:", action: { id: 'create_ticket', label: "🎫 Create a ticket if this doesn't help", primary: false } },
      software_request: { text: "Here's how to request software installation:", action: { id: 'create_ticket', label: '🎫 Create a software request ticket', primary: true } },
      network_wifi:     { text: "Here's our WiFi Setup guide.\n\nQuick steps to try first:\n• Restart your router/switch\n• Forget the network and rejoin it\n• Test on another device to isolate the issue", action: { id: 'create_ticket', label: "🎫 Create a ticket if this doesn't help", primary: false } },
      email_issues:     { text: "Here's the Email Configuration guide:", action: { id: 'create_ticket', label: "🎫 Create a ticket if this doesn't help", primary: false } },
    };

    const meta = intentMeta[intent] || { text: "I found this article that should help:", action: null };
    const articleLinks = article ? [article] : [];
    const actionButtons = meta.action ? [meta.action] : [];

    return {
      response: meta.text,
      articleLinks,
      actionButtons,
      suggestions: article ? ['✅ This helped', '❌ Still not working'] : ['Create a support ticket'],
    };
  }

  // ── LOW CONFIDENCE (< 0.75): full-text knowledge base search ──────────────
  const kbResults = await searchKnowledgeBase(userMessage);
  const freshArticles = kbResults.filter(a => !seenArticleIds.has(a.id));

  if (freshArticles.length > 0) {
    return {
      response: "I found these articles that might help:",
      articleLinks: freshArticles.slice(0, 3),
      actionButtons: [{ id: 'create_ticket', label: "🎫 None of these helped — create a ticket", primary: false }],
      suggestions: ['✅ This helped', '❌ Still not working', 'Create a support ticket'],
    };
  }

  // ── Absolute fallback: offer ticket creation ───────────────────────────────
  return {
    response: "I couldn't find a matching article for that. Would you like to create a support ticket so a technician can assist you?",
    articleLinks: [],
    actionButtons: [{ id: 'create_ticket', label: '🎫 Create a support ticket', primary: true }],
    suggestions: ['Create a support ticket', 'Rephrase my question'],
  };
}

// ============================================================================
// USER ROLE HELPER  (used to tune LLM prompt verbosity)
// ============================================================================

/**
 * Return a simplified role string for LLM prompt construction.
 * @param {number} userId
 * @returns {Promise<'customer'|'tech'|'admin'>}
 */
async function _getUserRole(userId) {
  try {
    const { rows } = await pool.query(
      `SELECT role FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    const role = rows[0]?.role || 'customer';
    if (['admin', 'superadmin'].includes(role)) return 'admin';
    if (['tech', 'technician'].includes(role)) return 'tech';
    return 'customer';
  } catch {
    return 'customer';
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Process a chat message — main entry point.
 *
 * Primary path  : LLM + RAG (intelligent, grounded, conversational)
 * Fallback path : Rule-based + KB full-text search (always-available)
 *
 * @param {number} userId
 * @param {string} message
 * @param {number|null} conversationId
 * @returns {Promise<{response, suggestions, articleLinks, actionButtons, conversationId, messageId, intent, confidence}>}
 */
export async function processChatMessage(userId, message, conversationId = null) {
  try {
    // ── Resolve conversation ─────────────────────────────────────────────────
    let conversation;
    if (conversationId) {
      conversation = await ChatConversation.getById(conversationId);
      if (!conversation) throw new Error('Conversation not found');
    } else {
      conversation = await ChatConversation.getActiveByUserId(userId);
      if (!conversation) conversation = await ChatConversation.create(userId);
    }

    // ── Context: last N messages ─────────────────────────────────────────────
    const previousMessages = await ChatMessage.getByConversationId(conversation.id, HISTORY_LIMIT);
    const context = analyzeContext(previousMessages);

    // ── Determine user role (for LLM prompt tuning) ──────────────────────────
    const userRole = await _getUserRole(userId);

    // ── Attempt LLM + RAG path ───────────────────────────────────────────────
    const llmResult = await processMessageWithLLM({
      userId,
      message,
      conversationId:      conversation.id,
      conversationHistory: previousMessages,
      userRole,
    });

    let response, articleLinks, actionButtons, suggestions, intent, confidence;

    if (llmResult.rateLimited) {
      // Rate-limited — return the rate-limit message directly
      response     = llmResult.response;
      articleLinks = [];
      actionButtons = [];
      suggestions  = [];
      intent       = 'rate_limited';
      confidence   = 1.0;

    } else if (!llmResult.fallbackUsed && llmResult.response) {
      // ── LLM SUCCESS PATH ─────────────────────────────────────────────────
      response = llmResult.response;

      // Build article links from citations returned by RAG
      articleLinks = (llmResult.citations || []).map(c => ({
        id:       c.id,
        title:    c.title,
        slug:     c.slug,
        category: c.category,
        excerpt:  c.excerpt,
      }));

      // If LLM signals it can't help → offer ticket creation
      if (llmResult.escalate) {
        actionButtons = [{ id: 'create_ticket', label: '🎫 Create a support ticket', primary: true }];
        suggestions   = ['Create a support ticket', 'Rephrase my question'];
      } else {
        actionButtons = articleLinks.length > 0
          ? [{ id: 'create_ticket', label: "🎫 Still need help? Create a ticket", primary: false }]
          : [{ id: 'create_ticket', label: '🎫 Create a support ticket', primary: true }];
        suggestions = ['✅ This helped', '❌ Still not working', 'Create a support ticket'];
      }

      intent     = 'llm_rag';
      confidence = 0.95;

    } else {
      // ── RULE-BASED FALLBACK PATH ──────────────────────────────────────────
      const { intent: ri, confidence: rc, isFrustrated } = recognizeIntent(message);
      intent     = ri;
      confidence = rc;

      ({ response, articleLinks, actionButtons, suggestions } =
        await generateResponse(intent, confidence, message, { ...context, isFrustrated }));
    }

    // ── Persist messages ─────────────────────────────────────────────────────
    await ChatMessage.create({
      conversationId: conversation.id,
      sender:         'user',
      message,
      intent,
      confidence,
    });

    const botMessageRecord = await ChatMessage.create({
      conversationId: conversation.id,
      sender:         'bot',
      message:        response,
      intent:         `response_${intent}`,
      confidence:     1.0,
      suggestedArticles: articleLinks.map(a => a.id),
    });

    return {
      response,
      suggestions:   suggestions   || [],
      articleLinks:  articleLinks  || [],
      actionButtons: actionButtons || [],
      conversationId: conversation.id,
      messageId:     botMessageRecord.id,
      intent,
      confidence,
      // LLM metadata (useful for monitoring/debugging)
      llm: llmResult.fallbackUsed || llmResult.rateLimited ? null : {
        model:            llmResult.modelUsed,
        promptTokens:     llmResult.promptTokens,
        completionTokens: llmResult.completionTokens,
        costUsd:          llmResult.costUsd,
        latencyMs:        llmResult.latencyMs,
        cacheHit:         llmResult.cacheHit,
      },
    };

  } catch (error) {
    console.error('Error processing chat message:', error);
    throw error;
  }
}

/**
 * Get conversation context and history
 * @param {number} conversationId - Conversation ID
 * @returns {Promise<Object>} {conversation, messages}
 */
export async function getConversationHistory(conversationId) {
  const conversation = await ChatConversation.getById(conversationId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }
  
  const messages = await ChatMessage.getByConversationId(conversationId);
  
  return {
    conversation,
    messages
  };
}

/**
 * Clear chat history for a user
 * @param {number} userId - User ID
 * @param {number} conversationId - Optional: Specific conversation to clear
 * @returns {Promise<Object>} {deletedConversations, deletedMessages}
 */
export async function clearChatHistory(userId, conversationId = null) {
  if (conversationId) {
    // Clear specific conversation
    const conversation = await ChatConversation.getById(conversationId);
    if (!conversation || conversation.user_id !== userId) {
      throw new Error('Conversation not found or unauthorized');
    }
    
    const deletedMessages = await ChatMessage.deleteByConversationId(conversationId);
    await ChatConversation.delete(conversationId);
    
    return {
      deletedConversations: 1,
      deletedMessages
    };
  } else {
    // Clear all conversations for user
    const conversations = await ChatConversation.getByUserId(userId);
    let totalDeletedMessages = 0;
    
    for (const conv of conversations) {
      const deletedMessages = await ChatMessage.deleteByConversationId(conv.id);
      totalDeletedMessages += deletedMessages;
      await ChatConversation.delete(conv.id);
    }
    
    return {
      deletedConversations: conversations.length,
      deletedMessages: totalDeletedMessages
    };
  }
}

export default {
  processChatMessage,
  getConversationHistory,
  clearChatHistory,
};
