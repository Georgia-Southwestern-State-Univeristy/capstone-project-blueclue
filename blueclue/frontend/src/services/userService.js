// User Service - API calls for user operations

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
 * Get all technicians (for assignment dropdowns)
 * @returns {Promise<Array>} Array of technician users
 */
export const getTechnicians = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/users/technicians`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch technicians');
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Get technicians error:', error);
    throw new Error('Failed to load technicians. Please try again.');
  }
};

/**
 * Get all users for the staff/client directory
 * @param {Object} params - Filter parameters
 * @param {string} [params.role] - Filter by role
 * @param {string} [params.search] - Search by name or email
 * @returns {Promise<Array>} Array of user objects
 */
export const getDirectory = async ({ role, search } = {}) => {
  try {
    const params = new URLSearchParams();
    if (role) params.append('role', role);
    if (search) params.append('search', search);

    const queryString = params.toString();
    const url = `${API_BASE_URL}/users/directory${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch directory');
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Get directory error:', error);
    throw new Error('Failed to load directory. Please try again.');
  }
};

/**
 * Get a single user by ID
 * @param {number} id - User ID
 * @returns {Promise<Object>} User object
 */
export const getUserById = async (id) => {
  const response = await fetch(`${API_BASE_URL}/users/${id}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to fetch user');
  const data = await response.json();
  return data.data;
};

export default {
  getTechnicians,
  getDirectory,
  getUserById,
};
