// ============================================================================
// Chat Service — API calls for the BlueClue chat-bot
// ============================================================================
// Maps 1-to-1 with the backend chat routes at /api/chat/*

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const REQUEST_TIMEOUT = 10000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getAuthHeaders = () => {
  const token = localStorage.getItem('blueclue_token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

const handleResponse = async (response, fallbackMessage) => {
  if (!response.ok) {
    let body = {}
    try {
      body = await response.json()
    } catch {
      /* non-JSON response */
    }
    const message = body.message || `${fallbackMessage}: ${response.status}`
    const err = new Error(message)
    err.status = response.status
    throw err
  }
  return response.json()
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a chat message and receive a bot reply.
 * POST /api/chat/message
 *
 * @param {string}  message          – User's message text (1–2000 chars)
 * @param {number}  [conversationId] – Existing conversation to continue (optional)
 * @returns {Promise<Object>} { response, suggestions, articleLinks, conversationId, messageId, intent, confidence }
 */
export const sendChatMessage = async (message, conversationId = null) => {
  const payload = { message }
  if (conversationId) payload.conversationId = conversationId

  const res = await fetchWithTimeout(`${API_BASE_URL}/chat/message`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })

  const json = await handleResponse(res, 'Failed to send message')
  return json.data // { response, suggestions, conversationId, messageId, intent, confidence, ... }
}

/**
 * Retrieve full message history for a conversation.
 * GET /api/chat/history?conversationId=X
 *
 * @param {number} conversationId
 * @returns {Promise<Object>} { conversation, messages }
 */
export const getChatHistory = async (conversationId) => {
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/chat/history?conversationId=${conversationId}`,
    { headers: getAuthHeaders() },
  )

  const json = await handleResponse(res, 'Failed to load chat history')
  return json.data
}

/**
 * List all conversations for the logged-in user.
 * GET /api/chat/conversations?limit=50
 *
 * @param {number} [limit=50]
 * @returns {Promise<Object[]>}
 */
export const getChatConversations = async (limit = 50) => {
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/chat/conversations?limit=${limit}`,
    { headers: getAuthHeaders() },
  )

  const json = await handleResponse(res, 'Failed to load conversations')
  return json.data
}

/**
 * Submit feedback (thumbs up / thumbs down) for a bot message.
 * POST /api/chat/feedback
 *
 * @param {number}  messageId
 * @param {boolean} helpful
 * @param {string}  [details]  – Optional free-text details (thumbs-down)
 * @param {string}  [reason]   – Structured failure reason (thumbs-down)
 * @returns {Promise<Object>}
 */
export const submitChatFeedback = async (messageId, helpful, details = '', reason = null) => {
  const payload = { messageId, helpful }
  if (details) payload.details = details
  if (reason)  payload.reason  = reason

  const res = await fetchWithTimeout(`${API_BASE_URL}/chat/feedback`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })

  const json = await handleResponse(res, 'Failed to submit feedback')
  return json.data
}

/**
 * Clear chat history.
 * POST /api/chat/clear
 *
 * @param {number} [conversationId] – Clear one conversation, or omit to clear all
 * @returns {Promise<Object>} { deletedConversations, deletedMessages }
 */
export const clearChatHistory = async (conversationId = null) => {
  const payload = conversationId ? { conversationId } : {}

  const res = await fetchWithTimeout(`${API_BASE_URL}/chat/clear`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })

  const json = await handleResponse(res, 'Failed to clear chat history')
  return json.data
}

/**
 * End a conversation.
 * POST /api/chat/end
 *
 * @param {number}  conversationId
 * @param {boolean} [wasHelpful]
 * @returns {Promise<Object>}
 */
export const endChatConversation = async (conversationId, wasHelpful = null) => {
  const payload = { conversationId }
  if (wasHelpful !== null) payload.wasHelpful = wasHelpful

  const res = await fetchWithTimeout(`${API_BASE_URL}/chat/end`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })

  const json = await handleResponse(res, 'Failed to end conversation')
  return json.data
}

/**
 * Create a support ticket pre-filled from the current chat conversation.
 * POST /api/chat/create-ticket
 *
 * @param {number}  conversationId – ID of the conversation to pull context from
 * @param {string}  [subject]      – Optional override subject
 * @param {string}  [description]  – Optional override description
 * @returns {Promise<{ticketId, ticketNumber, subject, status, message}>}
 */
export const createTicketFromChat = async (conversationId, subject = null, description = null) => {
  const payload = { conversationId }
  if (subject)      payload.subject      = subject
  if (description)  payload.description  = description

  const res = await fetchWithTimeout(`${API_BASE_URL}/chat/create-ticket`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })

  const json = await handleResponse(res, 'Failed to create ticket')
  return json.data
}

// ---------------------------------------------------------------------------
// Tech mode
// ---------------------------------------------------------------------------

/**
 * Send a message in tech mode (private KB + slash commands).
 * POST /api/chat/tech-message
 */
export const sendTechChatMessage = async (message, conversationId = null) => {
  const payload = { message }
  if (conversationId) payload.conversationId = conversationId

  const res = await fetchWithTimeout(`${API_BASE_URL}/chat/tech-message`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })

  const json = await handleResponse(res, 'Failed to send tech message')
  return json.data
}

// ---------------------------------------------------------------------------
// Proactive article suggestions (ticket prevention)
// ---------------------------------------------------------------------------

/**
 * Get KB article suggestions based on partial ticket description.
 * POST /api/chat/suggest-articles
 *
 * @param {string} description  – partial ticket description text
 * @param {string} [abGroup]    – 'A' (shown) or 'B' (control), defaults to 'A'
 */
export const suggestArticles = async (description, abGroup = 'A') => {
  const res = await fetchWithTimeout(`${API_BASE_URL}/chat/suggest-articles`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ description, abGroup }),
  })

  const json = await handleResponse(res, 'Failed to fetch article suggestions')
  return json.data // { articles: [...] }
}

/**
 * Track a user's interaction with an article suggestion card.
 * POST /api/chat/suggest-articles/event
 *
 * @param {string} action – 'clicked' | 'dismissed' | 'ticket_cancelled'
 * @param {number} [articleId]
 * @param {string} [description]
 */
export const trackSuggestionEvent = async (action, articleId = null, description = '') => {
  const res = await fetchWithTimeout(`${API_BASE_URL}/chat/suggest-articles/event`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ action, articleId, description }),
  })

  const json = await handleResponse(res, 'Failed to track suggestion event')
  return json
}

// ---------------------------------------------------------------------------
// File / image upload
// ---------------------------------------------------------------------------

/**
 * Upload an image or file as base64 JSON to the backend.
 * POST /api/chat/upload
 *
 * @param {File}   file              – Browser File object
 * @param {number} [conversationId]  – Attach to conversation (optional)
 * @returns {Promise<{url, filename, mimeType, sizeBytes}>}
 */
export const uploadChatFile = async (file, conversationId = null) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const dataBase64 = reader.result.split(',')[1] // strip data URL prefix
        const payload = {
          filename: file.name,
          mimeType: file.type,
          dataBase64,
        }
        if (conversationId) payload.conversationId = conversationId

        const res = await fetchWithTimeout(`${API_BASE_URL}/chat/upload`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        })

        const json = await handleResponse(res, 'File upload failed')
        resolve(json.data)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

// ---------------------------------------------------------------------------
// Human handoff
// ---------------------------------------------------------------------------

/**
 * Request to be connected to a human technician.
 * POST /api/chat/handoff
 *
 * @param {number} conversationId
 */
export const requestChatHandoff = async (conversationId) => {
  const res = await fetchWithTimeout(`${API_BASE_URL}/chat/handoff`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ conversationId }),
  })

  const json = await handleResponse(res, 'Failed to request handoff')
  return json.data
}

/**
 * (Tech) Claim a pending handoff conversation.
 * POST /api/chat/handoff/claim
 *
 * @param {number} conversationId
 */
export const claimChatHandoff = async (conversationId) => {
  const res = await fetchWithTimeout(`${API_BASE_URL}/chat/handoff/claim`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ conversationId }),
  })

  const json = await handleResponse(res, 'Failed to claim handoff')
  return json.data
}

/**
 * (Tech/Management) Get list of pending handoff requests.
 * GET /api/chat/handoff/pending
 */
export const getPendingHandoffs = async () => {
  const res = await fetchWithTimeout(`${API_BASE_URL}/chat/handoff/pending`, {
    headers: getAuthHeaders(),
  })

  const json = await handleResponse(res, 'Failed to fetch pending handoffs')
  return json.data
}

/**
 * (Tech/Customer) Get LLM-generated summary of a conversation without creating a ticket.
 * GET /api/chat/summary/:conversationId
 */
export const getConversationSummary = async (conversationId) => {
  const res = await fetchWithTimeout(`${API_BASE_URL}/chat/summary/${conversationId}`, {
    headers: getAuthHeaders(),
  })
  const json = await handleResponse(res, 'Failed to generate summary')
  return json.data // { title, description, transcript }
}

// ---------------------------------------------------------------------------
// Chat analytics
// ---------------------------------------------------------------------------

/**
 * Fetch chat analytics data (Management / Admin only).
 * GET /api/chat/analytics?period=30d
 *
 * @param {'7d'|'30d'|'90d'} [period='30d']
 */
export const getChatAnalytics = async (period = '30d') => {
  const res = await fetchWithTimeout(`${API_BASE_URL}/chat/analytics?period=${period}`, {
    headers: getAuthHeaders(),
  })

  const json = await handleResponse(res, 'Failed to fetch chat analytics')
  return json.data
}

/**
 * Submit an end-of-conversation survey.
 * POST /api/chat/survey
 *
 * @param {number} conversationId
 * @param {Object} surveyData – { rating, solved, wouldUseAgain, npsScore, feedbackText }
 * @returns {Promise<Object>}
 */
export const submitConversationSurvey = async (conversationId, surveyData) => {
  const res = await fetchWithTimeout(`${API_BASE_URL}/chat/survey`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ conversationId, ...surveyData }),
  })
  const json = await handleResponse(res, 'Failed to submit survey')
  return json.data
}

/**
 * Fetch knowledge gaps + NPS breakdown + satisfaction trend (Management / Admin only).
 * GET /api/chat/analytics/knowledge-gaps
 *
 * @param {number} [limit=20] – max gaps to return
 * @returns {Promise<{ gaps, satisfactionTrend, npsBreakdown }>}
 */
export const getChatKnowledgeGaps = async (limit = 20) => {
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/chat/analytics/knowledge-gaps?limit=${limit}`,
    { headers: getAuthHeaders() },
  )
  const json = await handleResponse(res, 'Failed to fetch knowledge gaps')
  return json.data
}

/**
 * GDPR Art. 20 – export all chat data belonging to the logged-in user.
 * GET /api/chat/export-my-data
 *
 * @returns {Promise<Object>} { conversations, messages, messageFeedback, conversationFeedback }
 */
export const exportMyChatData = async () => {
  const res = await fetchWithTimeout(`${API_BASE_URL}/chat/export-my-data`, {
    headers: getAuthHeaders(),
  })
  const json = await handleResponse(res, 'Failed to export chat data')
  return json.data
}

// ---------------------------------------------------------------------------
// Tech handoff reply + resolve + history
// ---------------------------------------------------------------------------

/**
 * (Tech) Send a reply message inside a claimed handoff conversation.
 * POST /api/chat/handoff/reply
 */
export const sendHandoffReply = async (conversationId, message) => {
  const res = await fetchWithTimeout(`${API_BASE_URL}/chat/handoff/reply`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ conversationId, message }),
  })
  const json = await handleResponse(res, 'Failed to send reply')
  return json.data
}

/**
 * (Tech) Mark a claimed handoff conversation as resolved/closed.
 * POST /api/chat/handoff/resolve
 */
export const resolveHandoff = async (conversationId) => {
  const res = await fetchWithTimeout(`${API_BASE_URL}/chat/handoff/resolve`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ conversationId }),
  })
  const json = await handleResponse(res, 'Failed to resolve chat')
  return json.data
}

/**
 * (Tech) Fetch full message history + customer context for a claimed handoff.
 * GET /api/chat/handoff/:conversationId/history
 */
export const getHandoffHistory = async (conversationId) => {
  const res = await fetchWithTimeout(`${API_BASE_URL}/chat/handoff/${conversationId}/history`, {
    headers: getAuthHeaders(),
  })
  const json = await handleResponse(res, 'Failed to load handoff history')
  return json.data
}
