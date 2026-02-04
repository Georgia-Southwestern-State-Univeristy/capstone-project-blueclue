// Ticket Service - API calls for ticket operations

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Request timeout in milliseconds (10 seconds)
const REQUEST_TIMEOUT = 10000;

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(message, type = 'unknown', status = null) {
    super(message);
    this.name = 'ApiError';
    this.type = type; // 'network', 'timeout', 'validation', 'server', 'unknown'
    this.status = status;
  }
}

/**
 * Get user-friendly error message based on error type
 */
const getUserFriendlyMessage = (error, defaultMessage) => {
  // Network error (no internet, server down, CORS)
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return 'Unable to connect to the server. Please check your internet connection and try again.';
  }
  
  // Timeout error
  if (error.name === 'AbortError') {
    return 'The request took too long. Please try again.';
  }
  
  // API returned an error message
  if (error.message && !error.message.includes('Failed to')) {
    return error.message;
  }
  
  return defaultMessage;
};

/**
 * Make a fetch request with timeout and error handling
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
    throw error;
  }
};

/**
 * Handle API response and errors
 */
const handleResponse = async (response, errorMessage) => {
  if (!response.ok) {
    let errorData = {};
    try {
      errorData = await response.json();
    } catch {
      // Response wasn't JSON
    }
    
    // Determine error type based on status code
    let errorType = 'unknown';
    if (response.status >= 400 && response.status < 500) {
      errorType = 'validation';
    } else if (response.status >= 500) {
      errorType = 'server';
    }
    
    const message = errorData.message || `${errorMessage}: ${response.status}`;
    
    // Log error for debugging
    console.error(`API Error [${response.status}]:`, message, errorData);
    
    throw new ApiError(message, errorType, response.status);
  }
  
  return response.json();
};

/**
 * Create a new ticket
 * @param {Object} ticketData - The ticket data to submit
 * @param {string} ticketData.title - Ticket title
 * @param {string} ticketData.description - Ticket description
 * @param {string} ticketData.priority - Ticket priority (low, medium, high)
 * @returns {Promise<Object>} The created ticket
 */
export const createTicket = async (ticketData) => {
  // Map frontend fields to backend expected fields
  const payload = {
    subject: ticketData.title,
    description: ticketData.description,
    priority: ticketData.priority,
    customer_id: 1, // TODO: Replace with actual user ID from authentication
  };

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return await handleResponse(response, 'Failed to create ticket');
  } catch (error) {
    // Log error for debugging
    console.error('Create ticket error:', error);
    
    // Re-throw with user-friendly message
    const message = getUserFriendlyMessage(error, 'Failed to submit ticket. Please try again.');
    throw new Error(message);
  }
};

/**
 * Get all tickets
 * @returns {Promise<Array>} Array of tickets
 */
export const getAllTickets = async () => {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/tickets`);
    return await handleResponse(response, 'Failed to fetch tickets');
  } catch (error) {
    console.error('Get tickets error:', error);
    const message = getUserFriendlyMessage(error, 'Failed to load tickets. Please try again.');
    throw new Error(message);
  }
};

/**
 * Get a single ticket by ID
 * @param {number|string} id - The ticket ID
 * @returns {Promise<Object>} The ticket data
 */
export const getTicketById = async (id) => {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/tickets/${id}`);
    return await handleResponse(response, 'Failed to fetch ticket');
  } catch (error) {
    console.error('Get ticket error:', error);
    const message = getUserFriendlyMessage(error, 'Failed to load ticket. Please try again.');
    throw new Error(message);
  }
};

/**
 * Update a ticket
 * @param {number|string} id - The ticket ID
 * @param {Object} ticketData - The updated ticket data
 * @returns {Promise<Object>} The updated ticket
 */
export const updateTicket = async (id, ticketData) => {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/tickets/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ticketData),
    });
    return await handleResponse(response, 'Failed to update ticket');
  } catch (error) {
    console.error('Update ticket error:', error);
    const message = getUserFriendlyMessage(error, 'Failed to update ticket. Please try again.');
    throw new Error(message);
  }
};

/**
 * Delete a ticket (soft delete)
 * @param {number|string} id - The ticket ID
 * @returns {Promise<Object>} The deletion response
 */
export const deleteTicket = async (id) => {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/tickets/${id}`, {
      method: 'DELETE',
    });
    return await handleResponse(response, 'Failed to delete ticket');
  } catch (error) {
    console.error('Delete ticket error:', error);
    const message = getUserFriendlyMessage(error, 'Failed to delete ticket. Please try again.');
    throw new Error(message);
  }
};

export default {
  createTicket,
  getAllTickets,
  getTicketById,
  updateTicket,
  deleteTicket,
};
