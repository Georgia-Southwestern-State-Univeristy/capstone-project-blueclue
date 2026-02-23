// Ticket Service - API calls for ticket operations

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
  // Get current user from localStorage
  const userStr = localStorage.getItem('blueclue_user');
  const user = userStr ? JSON.parse(userStr) : null;
  
  // Require some form of user identification
  if (!user) {
    throw new Error('You must be logged in to create a ticket');
  }
  
  // Map frontend fields to backend expected fields
  const payload = {
    subject: ticketData.title,
    description: ticketData.description,
    priority: ticketData.priority,
  };
  
  // Add customer_id for authenticated users, or guest info for guests
  if (user.role === 'guest' || user.isGuest) {
    payload.guest_email = user.email;
    payload.guest_name = user.name || user.first_name + ' ' + user.last_name;
  } else {
    payload.customer_id = user.id;
  }

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/tickets`, {
      method: 'POST',
      headers: getAuthHeaders(),
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
    const response = await fetchWithTimeout(`${API_BASE_URL}/tickets`, {
      headers: getAuthHeaders(),
    });
    return await handleResponse(response, 'Failed to fetch tickets');
  } catch (error) {
    console.error('Get tickets error:', error);
    const message = getUserFriendlyMessage(error, 'Failed to load tickets. Please try again.');
    throw new Error(message);
  }
};

/**
 * Get tickets assigned to the current technician
 * @returns {Promise<Array>} Array of tickets assigned to the technician
 */
export const getMyAssignedTickets = async () => {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/tickets/assigned/me`, {
      headers: getAuthHeaders(),
    });
    return await handleResponse(response, 'Failed to fetch assigned tickets');
  } catch (error) {
    console.error('Get assigned tickets error:', error);
    const message = getUserFriendlyMessage(error, 'Failed to load assigned tickets. Please try again.');
    throw new Error(message);
  }
};

/**
 * Get all tickets for timeline (no filtering)
 * @returns {Promise<Array>} Array of all tickets
 */
export const getAllTicketsForTimeline = async () => {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/tickets/timeline`);
    return await handleResponse(response, 'Failed to fetch timeline tickets');
  } catch (error) {
    console.error('Get timeline tickets error:', error);
    const message = getUserFriendlyMessage(error, 'Failed to load timeline. Please try again.');
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
    const response = await fetchWithTimeout(`${API_BASE_URL}/tickets/${id}`, {
      headers: getAuthHeaders(),
    });
    return await handleResponse(response, 'Failed to fetch ticket');
  } catch (error) {
    console.error('Get ticket error:', error);
    const message = getUserFriendlyMessage(error, 'Failed to load ticket. Please try again.');
    throw new Error(message);
  }
};

/**
 * Get ticket activity history
 * @param {number|string} id - The ticket ID
 * @returns {Promise<Object>} Object with data array of history entries
 */
export const getTicketHistory = async (id) => {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/tickets/${id}/history`, {
      headers: getAuthHeaders(),
    });
    return await handleResponse(response, 'Failed to fetch ticket history');
  } catch (error) {
    console.error('Get ticket history error:', error);
    const message = getUserFriendlyMessage(error, 'Failed to load ticket history. Please try again.');
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
      headers: getAuthHeaders(),
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
      headers: getAuthHeaders(),
    });
    return await handleResponse(response, 'Failed to delete ticket');
  } catch (error) {
    console.error('Delete ticket error:', error);
    const message = getUserFriendlyMessage(error, 'Failed to delete ticket. Please try again.');
    throw new Error(message);
  }
};

/**
 * Update ticket status
 * @param {number|string} id - The ticket ID
 * @param {string} status - The new status value
 * @returns {Promise<Object>} The updated ticket
 */
export const updateTicketStatus = async (id, status) => {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/tickets/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    });
    return await handleResponse(response, 'Failed to update ticket status');
  } catch (error) {
    console.error('Update ticket status error:', error);
    const message = getUserFriendlyMessage(error, 'Failed to update ticket status. Please try again.');
    throw new Error(message);
  }
};

/**
 * Assign ticket to a technician
 * @param {number|string} id - The ticket ID
 * @param {number|null} technicianId - The technician user ID (null to unassign)
 * @returns {Promise<Object>} The updated ticket
 */
export const assignTicket = async (id, technicianId) => {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/tickets/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ assigned_to: technicianId }),
    });
    return await handleResponse(response, 'Failed to assign ticket');
  } catch (error) {
    console.error('Assign ticket error:', error);
    const message = getUserFriendlyMessage(error, 'Failed to assign ticket. Please try again.');
    throw new Error(message);
  }
};

/**
 * Assign a single ticket to a technician (with validation)
 * @param {number|string} ticketId - The ticket ID
 * @param {number} technicianId - The technician user ID
 * @param {string} [note] - Optional assignment note
 * @returns {Promise<Object>} The assignment result
 */
export const assignSingleTicket = async (ticketId, technicianId, note = '') => {
  try {
    const body = { technician_id: technicianId };
    if (note) body.note = note;
    const response = await fetchWithTimeout(`${API_BASE_URL}/tickets/${ticketId}/assign`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });
    return await handleResponse(response, 'Failed to assign ticket');
  } catch (error) {
    console.error('Assign single ticket error:', error);
    const message = getUserFriendlyMessage(error, 'Failed to assign ticket. Please try again.');
    throw new Error(message);
  }
};

/**
 * Reassign a ticket to a different technician
 * @param {number|string} ticketId - The ticket ID
 * @param {number} technicianId - The new technician user ID
 * @param {string} [note] - Optional reassignment note
 * @returns {Promise<Object>} The reassignment result
 */
export const reassignTicket = async (ticketId, technicianId, note = '') => {
  try {
    const body = { technician_id: technicianId };
    if (note) body.note = note;
    const response = await fetchWithTimeout(`${API_BASE_URL}/tickets/${ticketId}/reassign`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });
    return await handleResponse(response, 'Failed to reassign ticket');
  } catch (error) {
    console.error('Reassign ticket error:', error);
    const message = getUserFriendlyMessage(error, 'Failed to reassign ticket. Please try again.');
    throw new Error(message);
  }
};

/**
 * Bulk assign multiple tickets to a technician
 * @param {Array<number>} ticketIds - Array of ticket IDs
 * @param {number} technicianId - The technician user ID
 * @param {string} [note] - Optional assignment note
 * @returns {Promise<Object>} The assignment result
 */
export const bulkAssignTickets = async (ticketIds, technicianId, note = '') => {
  try {
    const body = { ticket_ids: ticketIds, technician_id: technicianId };
    if (note) body.note = note;
    const response = await fetchWithTimeout(`${API_BASE_URL}/tickets/bulk-assign`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });
    return await handleResponse(response, 'Failed to assign tickets');
  } catch (error) {
    console.error('Bulk assign tickets error:', error);
    const message = getUserFriendlyMessage(error, 'Failed to assign tickets. Please try again.');
    throw new Error(message);
  }
};

/**
 * Get recent assignment activity across all tickets
 * @param {number} limit - Max entries to return (default 50)
 * @returns {Promise<Object>} Object with data array of assignment events
 */
export const getRecentAssignmentActivity = async (limit = 50) => {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/tickets/activity?limit=${limit}`, {
      headers: getAuthHeaders(),
    });
    return await handleResponse(response, 'Failed to fetch assignment activity');
  } catch (error) {
    console.error('Get assignment activity error:', error);
    const message = getUserFriendlyMessage(error, 'Failed to load assignment activity. Please try again.');
    throw new Error(message);
  }
};

/**
 * Get available (unassigned) tickets for the current technician
 * Returns tickets in categories the technician has access to
 * @returns {Promise<Object>} Object with data array of available tickets
 */
export const getAvailableTickets = async () => {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/tickets/available`, {
      headers: getAuthHeaders(),
    });
    return await handleResponse(response, 'Failed to fetch available tickets');
  } catch (error) {
    console.error('Get available tickets error:', error);
    const message = getUserFriendlyMessage(error, 'Failed to load available tickets. Please try again.');
    throw new Error(message);
  }
};

/**
 * Request assignment of a ticket to the current technician
 * @param {number|string} ticketId - The ticket ID
 * @param {string} [note] - Optional note explaining why the technician wants the ticket
 * @returns {Promise<Object>} The assignment result with updated ticket
 */
export const requestAssignment = async (ticketId, note = '') => {
  try {
    const body = {};
    if (note) body.note = note;
    const response = await fetchWithTimeout(`${API_BASE_URL}/tickets/${ticketId}/request-assignment`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });
    return await handleResponse(response, 'Failed to request ticket assignment');
  } catch (error) {
    console.error('Request ticket assignment error:', error);
    const message = getUserFriendlyMessage(error, 'Failed to request ticket assignment. Please try again.');
    throw new Error(message);
  }
};

/**
 * Get list of active technicians for assignment dropdowns
 * @returns {Promise<Object>} Object with data array of technicians
 */
export const getTechnicians = async () => {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/users/technicians`, {
      headers: getAuthHeaders(),
    });
    return await handleResponse(response, 'Failed to fetch technicians');
  } catch (error) {
    console.error('Get technicians error:', error);
    const message = getUserFriendlyMessage(error, 'Failed to load technicians. Please try again.');
    throw new Error(message);
  }
};

// ==========================================
// Assignment Request Management (management/admin)
// ==========================================

/**
 * Get assignment requests (defaults to pending)
 * @param {Object} params - { status, page, limit }
 * @returns {Promise<Object>} Paginated assignment requests
 */
export const getAssignmentRequests = async ({ status = 'pending', page = 1, limit = 25 } = {}) => {
  try {
    const params = new URLSearchParams({ status, page: String(page), limit: String(limit) });
    const response = await fetchWithTimeout(`${API_BASE_URL}/assignment-requests?${params}`, {
      headers: getAuthHeaders(),
    });
    return await handleResponse(response, 'Failed to fetch assignment requests');
  } catch (error) {
    console.error('Get assignment requests error:', error);
    const message = getUserFriendlyMessage(error, 'Failed to load assignment requests. Please try again.');
    throw new Error(message);
  }
};

/**
 * Approve an assignment request
 * @param {number|string} requestId - The assignment request ID
 * @returns {Promise<Object>} The approval result
 */
export const approveAssignmentRequest = async (requestId) => {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/assignment-requests/${requestId}/approve`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    });
    return await handleResponse(response, 'Failed to approve assignment request');
  } catch (error) {
    console.error('Approve assignment request error:', error);
    const message = getUserFriendlyMessage(error, 'Failed to approve request. Please try again.');
    throw new Error(message);
  }
};

/**
 * Deny an assignment request
 * @param {number|string} requestId - The assignment request ID
 * @param {string} [reason] - Optional denial reason
 * @returns {Promise<Object>} The denial result
 */
export const denyAssignmentRequest = async (requestId, reason = '') => {
  try {
    const body = {};
    if (reason) body.reason = reason;
    const response = await fetchWithTimeout(`${API_BASE_URL}/assignment-requests/${requestId}/deny`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });
    return await handleResponse(response, 'Failed to deny assignment request');
  } catch (error) {
    console.error('Deny assignment request error:', error);
    const message = getUserFriendlyMessage(error, 'Failed to deny request. Please try again.');
    throw new Error(message);
  }
};

export default {
  createTicket,
  getAllTickets,
  getAllTicketsForTimeline,
  getMyAssignedTickets,
  getAvailableTickets,
  requestAssignment,
  getTicketById,
  getTicketHistory,
  updateTicket,
  deleteTicket,
  updateTicketStatus,
  assignTicket,
  assignSingleTicket,
  reassignTicket,
  bulkAssignTickets,
  getRecentAssignmentActivity,
  getTechnicians,
  getAssignmentRequests,
  approveAssignmentRequest,
  denyAssignmentRequest,
};
