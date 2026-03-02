import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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
 * Request a status update from a technician on a ticket
 * @param {number} ticketId - Ticket ID
 * @param {Object} data - Request data { assignedTo, message, deadline }
 * @returns {Promise} API response
 */
export const requestUpdate = async (ticketId, data) => {
  const response = await axios.post(
    `${API_URL}/tickets/${ticketId}/request-update`,
    data,
    { 
      headers: getAuthHeaders(),
      withCredentials: true 
    }
  );
  return response.data;
};

/**
 * Get update requests for the logged-in user
 * @param {Object} params - Query parameters { status, role }
 * @returns {Promise} API response
 */
export const getUpdateRequests = async (params = {}) => {
  const response = await axios.get(`${API_URL}/update-requests`, {
    params,
    headers: getAuthHeaders(),
    withCredentials: true
  });
  return response.data;
};

/**
 * Fulfill an update request
 * @param {number} id - Update request ID
 * @param {Object} response - Response data
 * @returns {Promise} API response
 */
export const fulfillUpdateRequest = async (id, responseData) => {
  const response = await axios.post(
    `${API_URL}/update-requests/${id}/fulfill`,
    responseData,
    { 
      headers: getAuthHeaders(),
      withCredentials: true 
    }
  );
  return response.data;
};

/**
 * Request deadline extension
 * @param {number} id - Update request ID
 * @param {Object} data - Extension request data { newDeadline, reason }
 * @returns {Promise} API response
 */
export const requestExtension = async (id, data) => {
  const response = await axios.post(
    `${API_URL}/update-requests/${id}/request-extension`,
    data,
    { 
      headers: getAuthHeaders(),
      withCredentials: true 
    }
  );
  return response.data;
};

/**
 * Handle extension request (approve or deny)
 * @param {number} id - Update request ID
 * @param {boolean} approved - Whether to approve the extension
 * @returns {Promise} API response
 */
export const handleExtensionRequest = async (id, approved) => {
  const response = await axios.post(
    `${API_URL}/update-requests/${id}/handle-extension`,
    { approved },
    { 
      headers: getAuthHeaders(),
      withCredentials: true 
    }
  );
  return response.data;
};

/**
 * Cancel an update request
 * @param {number} id - Update request ID
 * @returns {Promise} API response
 */
export const cancelUpdateRequest = async (id) => {
  const response = await axios.delete(
    `${API_URL}/update-requests/${id}`,
    { 
      headers: getAuthHeaders(),
      withCredentials: true 
    }
  );
  return response.data;
};

/**
 * Get technician statistics
 * @param {number} techId - Technician user ID
 * @param {number} days - Number of days to look back
 * @returns {Promise} API response
 */
export const getTechStats = async (techId, days = 30) => {
  const response = await axios.get(
    `${API_URL}/update-requests/stats/${techId}`,
    { 
      params: { days },
      headers: getAuthHeaders(),
      withCredentials: true 
    }
  );
  return response.data;
};

/**
 * Calculate deadline from preset option
 * @param {string} option - Deadline option ('1h', '4h', 'eod', or custom timestamp)
 * @returns {Date} Calculated deadline
 */
export const calculateDeadline = (option) => {
  const now = new Date();
  
  switch (option) {
    case '1h':
      return new Date(now.getTime() + 60 * 60 * 1000);
    case '4h':
      return new Date(now.getTime() + 4 * 60 * 60 * 1000);
    case 'eod': {
      const eod = new Date(now);
      eod.setHours(17, 0, 0, 0); // 5 PM today
      if (eod < now) {
        // If after 5 PM, set to 5 PM tomorrow
        eod.setDate(eod.getDate() + 1);
      }
      return eod;
    }
    default:
      // Treat as custom date string
      return new Date(option);
  }
};

/**
 * Format time remaining until deadline
 * @param {string|Date} deadline - Deadline timestamp
 * @returns {Object} { text, isOverdue, isUrgent, hours }
 */
export const formatTimeRemaining = (deadline) => {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate - now;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  const isOverdue = diffMs < 0;
  const isUrgent = !isOverdue && diffMs < (60 * 60 * 1000); // Less than 1 hour
  
  let text;
  if (isOverdue) {
    const hoursOverdue = Math.abs(hours);
    text = `${hoursOverdue}h ${Math.abs(minutes)}m overdue`;
  } else if (hours < 1) {
    text = `${minutes}m remaining`;
  } else if (hours < 24) {
    text = `${hours}h ${minutes}m remaining`;
  } else {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    text = `${days}d ${remainingHours}h remaining`;
  }
  
  return { text, isOverdue, isUrgent, hours: Math.abs(hours) };
};
