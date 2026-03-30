// Message Service — API calls for direct messaging between users

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const getAuthHeaders = () => {
  const token = localStorage.getItem('blueclue_token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

/**
 * Get conversation with a specific user
 * @param {number} userId - The other user's ID
 * @param {Object} opts
 * @param {number} [opts.limit=50]
 * @param {string} [opts.before] - ISO date cursor for pagination
 * @returns {Promise<Array>}
 */
export const getMessages = async (userId, { limit = 50, before } = {}) => {
  const params = new URLSearchParams()
  if (limit) params.set('limit', limit)
  if (before) params.set('before', before)

  const res = await fetch(`${API_BASE_URL}/messages/${userId}?${params}`, {
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load messages')
  const json = await res.json()
  return json.data
}

/**
 * Send a direct message to a user
 * @param {number} userId - Receiver user ID
 * @param {string} message - Message text
 * @returns {Promise<Object>}
 */
export const sendMessage = async (userId, message) => {
  const res = await fetch(`${API_BASE_URL}/messages/${userId}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ message }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || 'Failed to send message')
  }
  const json = await res.json()
  return json.data
}
