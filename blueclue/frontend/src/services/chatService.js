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
 * @param {string}  [feedback] – Optional free-text feedback
 * @returns {Promise<Object>}
 */
export const submitChatFeedback = async (messageId, helpful, feedback = '') => {
  const res = await fetchWithTimeout(`${API_BASE_URL}/chat/feedback`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ messageId, helpful, feedback }),
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
