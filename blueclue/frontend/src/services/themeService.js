// Theme Preferences Service — API calls for persisting user theme settings

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('blueclue_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// ─── Active preferences ─────────────────────────────────────────

/**
 * Fetch the user's current theme preferences (+ saved themes list).
 * @returns {Promise<Object>} { theme, accent, customOverride, customSlots, savedThemes }
 */
export const fetchThemePreferences = async () => {
  const res = await fetch(`${API_BASE_URL}/themes`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch theme preferences');
  const json = await res.json();
  return json.data;
};

/**
 * Persist the user's active theme settings (partial updates supported).
 * @param {Object} prefs - Any subset of { theme, accent, customOverride, customSlots }
 */
export const updateThemePreferences = async (prefs) => {
  const res = await fetch(`${API_BASE_URL}/themes`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(prefs),
  });
  if (!res.ok) throw new Error('Failed to update theme preferences');
  const json = await res.json();
  return json.data;
};

// ─── Saved (named) themes ───────────────────────────────────────

/**
 * Save the current config as a named theme.
 * @param {string} name - Display name
 * @param {Object} themeData - { theme, accent, customOverride, customSlots }
 * @returns {Promise<Object>} Updated savedThemes array
 */
export const saveTheme = async (name, themeData) => {
  const res = await fetch(`${API_BASE_URL}/themes/saved`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name, ...themeData }),
  });
  if (!res.ok) throw new Error('Failed to save theme');
  const json = await res.json();
  return json.data;
};

/**
 * Delete a saved theme by id.
 * @param {number|string} themeId
 */
export const deleteSavedTheme = async (themeId) => {
  const res = await fetch(`${API_BASE_URL}/themes/saved/${themeId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete saved theme');
  const json = await res.json();
  return json.data;
};

/**
 * Rename a saved theme.
 * @param {number|string} themeId
 * @param {string} newName
 */
export const renameSavedTheme = async (themeId, newName) => {
  const res = await fetch(`${API_BASE_URL}/themes/saved/${themeId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name: newName }),
  });
  if (!res.ok) throw new Error('Failed to rename saved theme');
  const json = await res.json();
  return json.data;
};
