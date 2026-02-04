// Ticket Service - API calls for ticket operations

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Create a new ticket
 * @param {Object} ticketData - The ticket data to submit
 * @param {string} ticketData.title - Ticket title
 * @param {string} ticketData.description - Ticket description
 * @param {string} ticketData.priority - Ticket priority (low, medium, high)
 * @returns {Promise<Object>} The created ticket
 */
export const createTicket = async (ticketData) => {
  const response = await fetch(`${API_BASE_URL}/tickets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(ticketData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to create ticket: ${response.status}`);
  }

  return response.json();
};

/**
 * Get all tickets
 * @returns {Promise<Array>} Array of tickets
 */
export const getAllTickets = async () => {
  const response = await fetch(`${API_BASE_URL}/tickets`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch tickets: ${response.status}`);
  }

  return response.json();
};

/**
 * Get a single ticket by ID
 * @param {number|string} id - The ticket ID
 * @returns {Promise<Object>} The ticket data
 */
export const getTicketById = async (id) => {
  const response = await fetch(`${API_BASE_URL}/tickets/${id}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch ticket: ${response.status}`);
  }

  return response.json();
};

/**
 * Update a ticket
 * @param {number|string} id - The ticket ID
 * @param {Object} ticketData - The updated ticket data
 * @returns {Promise<Object>} The updated ticket
 */
export const updateTicket = async (id, ticketData) => {
  const response = await fetch(`${API_BASE_URL}/tickets/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(ticketData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to update ticket: ${response.status}`);
  }

  return response.json();
};

/**
 * Delete a ticket (soft delete)
 * @param {number|string} id - The ticket ID
 * @returns {Promise<Object>} The deletion response
 */
export const deleteTicket = async (id) => {
  const response = await fetch(`${API_BASE_URL}/tickets/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to delete ticket: ${response.status}`);
  }

  return response.json();
};

export default {
  createTicket,
  getAllTickets,
  getTicketById,
  updateTicket,
  deleteTicket,
};
