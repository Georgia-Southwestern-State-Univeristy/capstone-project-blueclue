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
 * @param {string} [imageUrl] - Optional uploaded image URL
 * @returns {Promise<Object>}
 */
export const sendMessage = async (userId, message, imageUrl = null) => {
  const body = { message }
  if (imageUrl) body.image_url = imageUrl

  const res = await fetch(`${API_BASE_URL}/messages/${userId}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || 'Failed to send message')
  }
  const json = await res.json()
  return json.data
}

/**
 * Upload an image for a DM
 * @param {File} file - Browser File object
 * @returns {Promise<{url: string, filename: string, mimeType: string}>}
 */
export const uploadDMImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const dataBase64 = reader.result.split(',')[1]
        const res = await fetch(`${API_BASE_URL}/messages/upload`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type,
            dataBase64,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.message || 'Image upload failed')
        }
        const json = await res.json()
        resolve(json.data)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}
