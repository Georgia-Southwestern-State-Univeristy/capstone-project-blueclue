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

export default {
  getTechnicians,
};
