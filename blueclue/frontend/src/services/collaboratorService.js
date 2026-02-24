// Collaborator Service - API calls for multi-technician collaboration

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
    throw new ApiError(message, 'server', response.status);
  }
  return response.json();
};

/**
 * Get all collaborators for a ticket
 * @param {number} ticketId - Ticket ID
 * @returns {Promise<Object>} Collaborators data
 */
export const getCollaborators = async (ticketId) => {
  const token = localStorage.getItem('blueclue_token');
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetchWithTimeout(`${API_BASE_URL}/tickets/${ticketId}/collaborators`, {
    method: 'GET',
    headers: getAuthHeaders()
  });

  return handleResponse(response);
};

/**
 * Add a collaborator to a ticket
 * @param {number} ticketId - Ticket ID
 * @param {number} userId - User ID to add
 * @param {string} role - 'primary' or 'assisting'
 * @param {string} note - Optional note
 * @returns {Promise<Object>} Added collaborator data
 */
export const addCollaborator = async (ticketId, userId, role = 'assisting', note = '') => {
  const token = localStorage.getItem('blueclue_token');
  if (!token) {
    throw new Error('Authentication required');
  }

  if (!userId) {
    throw new Error('User ID is required');
  }

  const response = await fetchWithTimeout(`${API_BASE_URL}/tickets/${ticketId}/collaborators`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ userId, role, note: note.trim() || undefined })
  });

  return handleResponse(response);
};

/**
 * Remove a collaborator from a ticket
 * @param {number} ticketId - Ticket ID
 * @param {number} userId - User ID to remove
 * @returns {Promise<Object>} Response data
 */
export const removeCollaborator = async (ticketId, userId) => {
  const token = localStorage.getItem('blueclue_token');
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetchWithTimeout(`${API_BASE_URL}/tickets/${ticketId}/collaborators/${userId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });

  return handleResponse(response);
};

/**
 * Transfer primary assignment to another technician
 * @param {number} ticketId - Ticket ID
 * @param {number} newPrimaryUserId - User ID of new primary tech
 * @returns {Promise<Object>} Updated collaborators
 */
export const transferPrimary = async (ticketId, newPrimaryUserId) => {
  const token = localStorage.getItem('blueclue_token');
  if (!token) {
    throw new Error('Authentication required');
  }

  if (!newPrimaryUserId) {
    throw new Error('New primary user ID is required');
  }

  const response = await fetchWithTimeout(`${API_BASE_URL}/tickets/${ticketId}/transfer`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ newPrimaryUserId })
  });

  return handleResponse(response);
};

/**
 * Get technician workload statistics
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Workload data
 */
export const getTechnicianWorkload = async (userId) => {
  const token = localStorage.getItem('blueclue_token');
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetchWithTimeout(`${API_BASE_URL}/users/${userId}/workload`, {
    method: 'GET',
    headers: getAuthHeaders()
  });

  return handleResponse(response);
};
