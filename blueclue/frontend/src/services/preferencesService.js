/**
 * Notification Preferences Service
 * Manages user notification preferences via backend API with localStorage cache
 */

import { getToken } from './authService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const PREFERENCES_KEY = 'blueclue_notification_preferences';

const DEFAULT_PREFERENCES = {
  browserNotifications: true,
  emailNotifications: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  types: {
    assignment: true,
    overdue: true,
    update_request: true,
    mention: true,
    ticket_cancelled: true,
    ring_request: true,
    ring_response: true,
    update_fulfilled: true,
    update_overdue: true,
    chat_handoff: true,
    update_request_reminder: true,
  },
};

/** Helper: auth headers */
const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getToken()}`,
});

/**
 * Fetch preferences from API (updates localStorage cache)
 * @returns {Promise<Object>} User preferences object
 */
export const fetchPreferences = async () => {
  try {
    const res = await fetch(`${API_URL}/notifications/preferences`, {
      headers: authHeaders(),
    });
    if (res.ok) {
      const { data } = await res.json();
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(data));
      return data;
    }
  } catch (err) {
    console.error('Failed to fetch notification preferences:', err);
  }
  // Fallback to cached / defaults
  return getPreferencesLocal();
};

/**
 * Get preferences from localStorage cache (synchronous)
 * @returns {Object} Cached preferences or defaults
 */
const getPreferencesLocal = () => {
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    if (stored) return JSON.parse(stored);
  } catch (err) {
    console.error('Failed to parse notification preferences:', err);
  }
  return DEFAULT_PREFERENCES;
};

/**
 * Get all notification preferences (sync, from cache)
 * @returns {Object} User preferences object
 */
export const getPreferences = () => getPreferencesLocal();

/**
 * Save notification preferences to API and localStorage
 * @param {Object} preferences - Preferences object
 * @returns {Promise<boolean>} Whether save succeeded
 */
export const savePreferences = async (preferences) => {
  // Update local cache immediately
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));

  try {
    const res = await fetch(`${API_URL}/notifications/preferences`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(preferences),
    });
    if (res.ok) {
      const { data } = await res.json();
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(data));
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed to save notification preferences:', err);
    return false;
  }
};

/**
 * Check if a specific notification type is enabled
 * @param {string} type - Notification type (assignment, overdue, update_request, mention)
 * @returns {boolean} Whether the type is enabled
 */
export const isNotificationTypeEnabled = (type) => {
  const preferences = getPreferences();
  return preferences.types?.[type] ?? true;
};

/**
 * Check if browser notifications are enabled
 * @returns {boolean} Whether browser notifications are enabled
 */
export const areBrowserNotificationsEnabled = () => {
  const preferences = getPreferences();
  return preferences.browserNotifications ?? true;
};

/**
 * Get all enabled notification types
 * @returns {Array<string>} Array of enabled notification types
 */
export const getEnabledNotificationTypes = () => {
  const preferences = getPreferences();
  return Object.entries(preferences.types || {})
    .filter(([, enabled]) => enabled)
    .map(([type]) => type);
};

/**
 * Toggle a notification type
 * @param {string} type - Notification type
 * @returns {Promise<boolean>} New enabled state
 */
export const toggleNotificationType = async (type) => {
  const preferences = getPreferences();
  const newState = !preferences.types?.[type];
  preferences.types = preferences.types || {};
  preferences.types[type] = newState;
  await savePreferences(preferences);
  return newState;
};

/**
 * Toggle browser notifications
 * @returns {Promise<boolean>} New enabled state
 */
export const toggleBrowserNotifications = async () => {
  const preferences = getPreferences();
  const newState = !preferences.browserNotifications;
  preferences.browserNotifications = newState;
  await savePreferences(preferences);
  return newState;
};

/**
 * Check if email notifications are enabled
 * @returns {boolean} Whether email notifications are enabled
 */
export const areEmailNotificationsEnabled = () => {
  const preferences = getPreferences();
  return preferences.emailNotifications ?? true;
};

/**
 * Toggle email notifications
 * @returns {Promise<boolean>} New enabled state
 */
export const toggleEmailNotifications = async () => {
  const preferences = getPreferences();
  const newState = !preferences.emailNotifications;
  preferences.emailNotifications = newState;
  await savePreferences(preferences);
  return newState;
};

/**
 * Check if current time falls within quiet hours
 * @returns {boolean} True if notifications should be suppressed
 */
export const isInQuietHours = () => {
  const preferences = getPreferences();
  if (!preferences.quietHoursEnabled) return false;

  const start = preferences.quietHoursStart || '22:00';
  const end = preferences.quietHoursEnd || '07:00';

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    // Same-day range (e.g., 09:00–17:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  // Overnight range (e.g., 22:00–07:00)
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
};

/**
 * Reset preferences to default
 */
export const resetPreferences = () => {
  localStorage.removeItem(PREFERENCES_KEY);
};

export default {
  fetchPreferences,
  getPreferences,
  savePreferences,
  isNotificationTypeEnabled,
  areBrowserNotificationsEnabled,
  areEmailNotificationsEnabled,
  getEnabledNotificationTypes,
  toggleNotificationType,
  toggleBrowserNotifications,
  toggleEmailNotifications,
  isInQuietHours,
  resetPreferences,
};