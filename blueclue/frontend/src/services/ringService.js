// Ring Service - API calls for Ring for Help feature

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Request timeout in milliseconds (10 seconds)
const REQUEST_TIMEOUT = 10000;

/**
 * Get authentication headers
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem('blueclue_token');
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(message, type = 'unknown', status = null) {
    super(message);
    this.name = 'ApiError';
    this.type = type;
    this.status = status;
  }
}

/**
 * Fetch with timeout wrapper
 */
const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new ApiError('Request timeout', 'timeout');
    }
    throw error;
  }
};

/**
 * Handle API response
 */
const handleResponse = async (response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error || errorData.message || `HTTP error ${response.status}`;
    
    // Special handling for rate limit errors
    if (response.status === 429) {
      throw new ApiError(message, 'rate_limit', response.status, errorData);
    }
    
    throw new ApiError(message, 'server', response.status);
  }
  return response.json();
};

/**
 * Send a ring request to another technician
 * @param {number} ticketId - Ticket ID
 * @param {number} targetTechId - Target technician ID
 * @param {string} urgencyLevel - 'low', 'medium', or 'high'
 * @param {string} message - Optional message
 * @returns {Promise<Object>} Ring request data with cooldown info
 */
export const sendRingRequest = async (ticketId, targetTechId, urgencyLevel = 'medium', message = '') => {
  const token = localStorage.getItem('blueclue_token');
  if (!token) {
    throw new Error('Authentication required');
  }

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/tickets/${ticketId}/ring`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        targetTechId,
        urgencyLevel,
        message,
      }),
    });

    const result = await handleResponse(response);
    return result.data;
  } catch (error) {
    console.error('Error sending ring request:', error);
    throw error;
  }
};

/**
 * Get incoming ring requests for the logged-in technician
 * @returns {Promise<Array>} Array of pending ring requests
 */
export const getIncomingRingRequests = async () => {
  const token = localStorage.getItem('blueclue_token');
  if (!token) {
    throw new Error('Authentication required');
  }

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/ring-requests`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    const result = await handleResponse(response);
    return result.data || [];
  } catch (error) {
    console.error('Error fetching ring requests:', error);
    throw error;
  }
};

/**
 * Respond to a ring request (accept or decline)
 * @param {number} ringRequestId - Ring request ID
 * @param {string} action - 'accept' or 'decline'
 * @returns {Promise<Object>} Updated ring request data
 */
export const respondToRingRequest = async (ringRequestId, action) => {
  const token = localStorage.getItem('blueclue_token');
  if (!token) {
    throw new Error('Authentication required');
  }

  if (!['accept', 'decline'].includes(action)) {
    throw new Error('Invalid action. Must be "accept" or "decline"');
  }

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/ring-requests/${ringRequestId}/respond`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ action }),
    });

    const result = await handleResponse(response);
    return result.data;
  } catch (error) {
    console.error('Error responding to ring request:', error);
    throw error;
  }
};

/**
 * Get ring request metrics for the logged-in technician
 * @returns {Promise<Object>} Metrics including acceptance rate, response time
 */
export const getRingMetrics = async () => {
  const token = localStorage.getItem('blueclue_token');
  if (!token) {
    throw new Error('Authentication required');
  }

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/ring-requests/metrics`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    const result = await handleResponse(response);
    return result.data;
  } catch (error) {
    console.error('Error fetching ring metrics:', error);
    throw error;
  }
};

/**
 * Get ring request history for a ticket
 * @param {number} ticketId - Ticket ID
 * @returns {Promise<Array>} Array of ring requests for the ticket
 */
export const getTicketRingHistory = async (ticketId) => {
  const token = localStorage.getItem('blueclue_token');
  if (!token) {
    throw new Error('Authentication required');
  }

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/tickets/${ticketId}/ring-history`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    const result = await handleResponse(response);
    return result.data || [];
  } catch (error) {
    console.error('Error fetching ring history:', error);
    throw error;
  }
};

/**
 * Check if a technician can send ring requests (rate limit check)
 * Note: This is a client-side helper. Actual rate limiting is enforced server-side.
 * @param {Date} lastRingTime - Last time a ring was sent
 * @param {number} cooldownMinutes - Cooldown period in minutes (default 10)
 * @returns {Object} { canSend: boolean, remainingTime: number }
 */
export const checkLocalCooldown = (lastRingTime, cooldownMinutes = 10) => {
  if (!lastRingTime) {
    return { canSend: true, remainingTime: 0 };
  }

  const now = new Date();
  const lastRing = new Date(lastRingTime);
  const elapsedMinutes = (now - lastRing) / (1000 * 60);
  const remainingTime = Math.max(0, cooldownMinutes - elapsedMinutes);

  return {
    canSend: remainingTime === 0,
    remainingTime: Math.ceil(remainingTime),
  };
};

/**
 * Format cooldown time for display
 * @param {Date} nextAvailable - Date when cooldown expires
 * @returns {string} Formatted time remaining (e.g., "3m 45s")
 */
export const formatCooldownTime = (nextAvailable) => {
  if (!nextAvailable) return '0s';

  const now = new Date();
  const next = new Date(nextAvailable);
  const diffMs = Math.max(0, next - now);
  
  const minutes = Math.floor(diffMs / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

/**
 * Get urgency level color
 * @param {string} urgencyLevel - 'low', 'medium', or 'high'
 * @returns {string} Color hex code
 */
export const getUrgencyColor = (urgencyLevel) => {
  switch (urgencyLevel) {
    case 'high':
      return '#d32f2f'; // Red
    case 'medium':
      return '#f57c00'; // Orange
    case 'low':
      return '#388e3c'; // Green
    default:
      return '#757575'; // Gray
  }
};

/**
 * Get urgency level label
 * @param {string} urgencyLevel - 'low', 'medium', or 'high'
 * @returns {string} Formatted label
 */
export const getUrgencyLabel = (urgencyLevel) => {
  switch (urgencyLevel) {
    case 'high':
      return '🔴 High';
    case 'medium':
      return '🟠 Medium';
    case 'low':
      return '🟢 Low';
    default:
      return urgencyLevel;
  }
};

export default {
  sendRingRequest,
  getIncomingRingRequests,
  respondToRingRequest,
  getRingMetrics,
  getTicketRingHistory,
  checkLocalCooldown,
  formatCooldownTime,
  getUrgencyColor,
  getUrgencyLabel,
};
