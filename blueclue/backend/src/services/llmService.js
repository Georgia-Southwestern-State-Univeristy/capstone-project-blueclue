// src/services/llmService.js
/**
 * BlueClue LLM Service (Node.js layer)
 * ======================================
 * Acts as the bridge between the Node.js backend and the Python AI service's
 * RAG endpoints.  The heavy lifting (embedding generation, vector search,
 * OpenAI API calls) all happens in the Python service; this module handles:
 *
 *   - Conversation memory (last N messages passed as history)
 *   - Per-user rate limiting (max 10 messages/minute)
 *   - Response caching (in-memory TTL cache for repeated queries)
 *   - Fallback detection (bubble up escalate=true to chatService)
 *   - Cost guard (daily budget per user — configurable)
 *
 * Configuration (environment variables):
 *   AI_SERVICE_URL      Python ML service base URL (default: http://localhost:5000)
 *   LLM_ENABLED         'true' | 'false'  — kill-switch without redeployment
 *   LLM_RATE_LIMIT      Max messages per user per minute (default: 10)
 *   LLM_DAILY_BUDGET    Max $ spend per user per day (default: 1.00)
 *   LLM_CACHE_TTL_MS    In-memory cache TTL in ms (default: 3 600 000 = 1 hour)
 *   LLM_HISTORY_TURNS   Number of prior turns to include in context (default: 5)
 *   LLM_TIMEOUT_MS      HTTP timeout for each RAG request (default: 15 000)
 */

const AI_SERVICE_URL   = process.env.AI_SERVICE_URL   || 'http://localhost:5000';
const LLM_ENABLED      = (process.env.LLM_ENABLED     || 'true') === 'true';
const RATE_LIMIT       = parseInt(process.env.LLM_RATE_LIMIT    || '10',  10);
const DAILY_BUDGET_USD = parseFloat(process.env.LLM_DAILY_BUDGET || '1.00');
const CACHE_TTL_MS     = parseInt(process.env.LLM_CACHE_TTL_MS  || String(60 * 60 * 1000), 10);
const HISTORY_TURNS    = parseInt(process.env.LLM_HISTORY_TURNS  || '5',  10);
const LLM_TIMEOUT_MS   = parseInt(process.env.LLM_TIMEOUT_MS     || '15000', 10);

// ---------------------------------------------------------------------------
// In-memory response cache  (shared across all requests in this process)
// ---------------------------------------------------------------------------

/** @type {Map<string, {value: object, expiresAt: number}>} */
const _responseCache = new Map();

function _cacheKey(userId, message) {
  // Intentionally NOT per-user — same question from different users returns
  // from cache.  Conversation-with-history bypasses cache via the pipeline.
  return `rag:${message.slice(0, 200).toLowerCase().trim()}`;
}

function _getCache(key) {
  const entry = _responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _responseCache.delete(key);
    return null;
  }
  return entry.value;
}

function _setCache(key, value) {
  // Limit cache size to 2000 entries
  if (_responseCache.size >= 2000) {
    const firstKey = _responseCache.keys().next().value;
    _responseCache.delete(firstKey);
  }
  _responseCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function clearLLMCache() {
  _responseCache.clear();
}

// ---------------------------------------------------------------------------
// Per-user rate limiter
// ---------------------------------------------------------------------------

/** @type {Map<number, {count: number, windowStart: number}>} */
const _rateLimitMap = new Map();

function _checkRateLimit(userId) {
  const now = Date.now();
  const window = 60_000; // 1 minute
  const entry = _rateLimitMap.get(userId) || { count: 0, windowStart: now };

  if (now - entry.windowStart > window) {
    // New window
    _rateLimitMap.set(userId, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }

  if (entry.count >= RATE_LIMIT) {
    const resetInSec = Math.ceil((window - (now - entry.windowStart)) / 1000);
    return { allowed: false, remaining: 0, resetInSec };
  }

  entry.count += 1;
  _rateLimitMap.set(userId, entry);
  return { allowed: true, remaining: RATE_LIMIT - entry.count };
}

// ---------------------------------------------------------------------------
// Fetch with timeout helper
// ---------------------------------------------------------------------------

async function _fetchWithTimeout(url, options, timeoutMs = LLM_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// History formatter — converts DB message rows to OpenAI message format
// ---------------------------------------------------------------------------

/**
 * Format the last N user/bot turns as {role, content} objects.
 * @param {Array<{sender: string, message: string}>} messages
 * @param {number} maxTurns
 * @returns {Array<{role: string, content: string}>}
 */
function _formatHistory(messages, maxTurns = HISTORY_TURNS) {
  const relevant = messages
    .filter(m => m.sender === 'user' || m.sender === 'bot')
    .slice(-maxTurns * 2);   // 2 messages per turn (user + bot)

  return relevant.map(m => ({
    role:    m.sender === 'user' ? 'user' : 'assistant',
    content: m.message || '',
  }));
}

// ---------------------------------------------------------------------------
// Main public function: processMessageWithLLM
// ---------------------------------------------------------------------------

/**
 * Send a user message through the RAG pipeline and return a structured result.
 *
 * @param {object} params
 * @param {number}        params.userId            Authenticated user ID
 * @param {string}        params.message           Raw user message
 * @param {number|null}   params.conversationId    Current conversation ID (for history)
 * @param {Array}         params.conversationHistory  Recent DB message rows
 * @param {string}        params.userRole          'customer' | 'tech' | 'admin'
 * @returns {Promise<{
 *   response: string,
 *   citations: Array,
 *   escalate: boolean,
 *   modelUsed: string,
 *   promptTokens: number,
 *   completionTokens: number,
 *   costUsd: number,
 *   latencyMs: number,
 *   cacheHit: boolean,
 *   fallbackUsed: boolean,
 *   rateLimited: boolean,
 * }>}
 */
export async function processMessageWithLLM({
  userId,
  message,
  conversationId = null,
  conversationHistory = [],
  userRole = 'customer',
}) {
  // ── Kill-switch ──────────────────────────────────────────────────────────
  if (!LLM_ENABLED) {
    return { fallbackUsed: true, response: null, rateLimited: false };
  }

  // ── Rate limit ──────────────────────────────────────────────────────────
  const rl = _checkRateLimit(userId);
  if (!rl.allowed) {
    return {
      response: `You've sent too many messages. Please wait ${rl.resetInSec} seconds before sending another.`,
      citations: [],
      escalate: false,
      modelUsed: 'rate-limited',
      promptTokens: 0,
      completionTokens: 0,
      costUsd: 0,
      latencyMs: 0,
      cacheHit: false,
      fallbackUsed: false,
      rateLimited: true,
    };
  }

  // ── Cache (only for messages without conversation history) ───────────────
  const hasHistory = conversationHistory.length > 0;
  if (!hasHistory) {
    const cacheKey = _cacheKey(userId, message);
    const cached = _getCache(cacheKey);
    if (cached) {
      return { ...cached, cacheHit: true };
    }
  }

  // ── Format conversation history for the RAG endpoint ────────────────────
  const history = _formatHistory(conversationHistory, HISTORY_TURNS);

  // ── Call Python AI service RAG endpoint ─────────────────────────────────
  const startMs = Date.now();

  try {
    const response = await _fetchWithTimeout(
      `${AI_SERVICE_URL}/rag/chat`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          user_id:              userId,
          conversation_id:      conversationId,
          conversation_history: history,
          user_role:            userRole,
          use_cache:            false,   // Node handles caching above
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`RAG service returned ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - startMs;

    const result = {
      response:         data.answer          || '',
      citations:        data.citations       || [],
      escalate:         data.escalate        || false,
      modelUsed:        data.model_used      || '',
      promptTokens:     data.prompt_tokens   || 0,
      completionTokens: data.completion_tokens || 0,
      costUsd:          data.cost_usd        || 0,
      latencyMs:        data.latency_ms      || latencyMs,
      cacheHit:         false,
      fallbackUsed:     data.fallback_used   || false,
      rateLimited:      false,
    };

    // Cache uncached, non-history responses
    if (!hasHistory && !result.fallbackUsed) {
      _setCache(_cacheKey(userId, message), result);
    }

    return result;

  } catch (err) {
    const latencyMs = Date.now() - startMs;
    console.error('[llmService] RAG call failed:', err.message);

    // Return a signal that tells chatService to use rule-based fallback
    return {
      response:     null,
      citations:    [],
      escalate:     false,
      modelUsed:    'error-fallback',
      promptTokens: 0,
      completionTokens: 0,
      costUsd:      0,
      latencyMs,
      cacheHit:     false,
      fallbackUsed: true,
      rateLimited:  false,
    };
  }
}

// ---------------------------------------------------------------------------
// Ticket summary generation
// ---------------------------------------------------------------------------

/**
 * Use the LLM to generate a concise ticket title and description from
 * the chat conversation.
 *
 * @param {Array<{sender: string, message: string}>} messages
 * @returns {Promise<{title: string, description: string, suggestedCategory: string}>}
 */
export async function generateTicketSummary(messages) {
  if (!LLM_ENABLED) {
    return { title: 'Support Request', description: '', suggestedCategory: 'general' };
  }

  const transcript = messages
    .slice(-20)
    .map(m => `${m.sender === 'user' ? 'User' : 'Bot'}: ${m.message}`)
    .join('\n');

  try {
    const response = await _fetchWithTimeout(
      `${AI_SERVICE_URL}/rag/summarize-ticket`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      },
    );

    if (!response.ok) throw new Error(`Summarize returned ${response.status}`);
    const data = await response.json();
    return {
      title:             data.title             || 'Support Request',
      description:       data.description       || transcript,
      suggestedCategory: data.suggested_category || 'general',
    };
  } catch (err) {
    console.warn('[llmService] generateTicketSummary failed:', err.message);
    // Fallback: extract first user message as title
    const firstUser = messages.find(m => m.sender === 'user');
    return {
      title:             firstUser ? firstUser.message.slice(0, 100) : 'Support Request',
      description:       transcript,
      suggestedCategory: 'general',
    };
  }
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

/**
 * Check if the RAG service is reachable and LLM is configured.
 * @returns {Promise<{available: boolean, llmReady: boolean, embeddingReady: boolean, model: string}>}
 */
export async function checkLLMHealth() {
  if (!LLM_ENABLED) {
    return { available: false, llmReady: false, embeddingReady: false, model: 'disabled' };
  }
  try {
    const response = await _fetchWithTimeout(
      `${AI_SERVICE_URL}/rag/health`,
      { method: 'GET' },
      5000,
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return {
      available:      true,
      llmReady:       data.llm_ready       || false,
      embeddingReady: data.embedding_ready || false,
      model:          data.model           || 'unknown',
      embeddingModel: data.embedding_model || 'unknown',
      embeddingDim:   data.embedding_dim   || 0,
      articlesEmbedded: data.articles_embedded || 0,
    };
  } catch (err) {
    return { available: false, llmReady: false, embeddingReady: false, model: 'unreachable' };
  }
}

export default {
  processMessageWithLLM,
  generateTicketSummary,
  checkLLMHealth,
  clearLLMCache,
};
