// Dashboard Layout Service - API calls for persisting dashboard layouts

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('blueclue_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// ─── Active Layout ───────────────────────────────────────────────

/**
 * Fetch the user's active layout for a dashboard type
 * @param {string} dashboardType - e.g. 'management'
 * @returns {Promise<Object|null>} { layoutData, hiddenWidgets, layoutVersion } or null
 */
export const fetchActiveLayout = async (dashboardType = 'management') => {
  const response = await fetch(
    `${API_BASE_URL}/dashboard-layouts?type=${encodeURIComponent(dashboardType)}`,
    { headers: getAuthHeaders() }
  );
  if (!response.ok) throw new Error('Failed to fetch layout');
  const data = await response.json();
  return data.layout; // null if none saved
};

/**
 * Save (upsert) the active layout
 * @param {string} dashboardType
 * @param {Object} layoutData - Responsive layout object { lg: [...], md: [...], ... }
 * @param {Array} hiddenWidgets
 * @param {number} layoutVersion
 * @returns {Promise<Object>}
 */
export const saveActiveLayout = async (dashboardType, layoutData, hiddenWidgets = [], layoutVersion = 1) => {
  const response = await fetch(`${API_BASE_URL}/dashboard-layouts`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ type: dashboardType, layoutData, hiddenWidgets, layoutVersion })
  });
  if (!response.ok) throw new Error('Failed to save layout');
  return (await response.json()).layout;
};

/**
 * Delete the active layout (reset to default)
 * @param {string} dashboardType
 * @returns {Promise<boolean>}
 */
export const deleteActiveLayout = async (dashboardType = 'management') => {
  const response = await fetch(
    `${API_BASE_URL}/dashboard-layouts?type=${encodeURIComponent(dashboardType)}`,
    { method: 'DELETE', headers: getAuthHeaders() }
  );
  if (!response.ok) throw new Error('Failed to delete layout');
  return (await response.json()).success;
};

// ─── Saved / Named Layouts ──────────────────────────────────────

/**
 * Fetch all saved layouts for a dashboard type
 * @param {string} dashboardType
 * @returns {Promise<Array>}
 */
export const fetchSavedLayouts = async (dashboardType = 'management') => {
  const response = await fetch(
    `${API_BASE_URL}/dashboard-layouts/saved?type=${encodeURIComponent(dashboardType)}`,
    { headers: getAuthHeaders() }
  );
  if (!response.ok) throw new Error('Failed to fetch saved layouts');
  return (await response.json()).layouts;
};

/**
 * Create a new named saved layout
 * @param {string} dashboardType
 * @param {string} name
 * @param {Object} layoutData
 * @param {Array} hiddenWidgets
 * @returns {Promise<Object>}
 */
export const createSavedLayout = async (dashboardType, name, layoutData, hiddenWidgets = []) => {
  const response = await fetch(`${API_BASE_URL}/dashboard-layouts/saved`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ type: dashboardType, name, layoutData, hiddenWidgets })
  });
  if (!response.ok) throw new Error('Failed to create saved layout');
  return (await response.json()).layout;
};

/**
 * Rename a saved layout
 * @param {number} id
 * @param {string} newName
 * @returns {Promise<Object>}
 */
export const renameSavedLayoutApi = async (id, newName) => {
  const response = await fetch(`${API_BASE_URL}/dashboard-layouts/saved/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name: newName })
  });
  if (!response.ok) throw new Error('Failed to rename saved layout');
  return (await response.json()).layout;
};

/**
 * Delete a saved layout
 * @param {number} id
 * @returns {Promise<boolean>}
 */
export const deleteSavedLayoutApi = async (id) => {
  const response = await fetch(`${API_BASE_URL}/dashboard-layouts/saved/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to delete saved layout');
  return (await response.json()).success;
};
