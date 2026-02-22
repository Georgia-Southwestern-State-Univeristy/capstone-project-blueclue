/**
 * Notification Preferences Service
 * Manages user notification preferences stored in localStorage
 */

const PREFERENCES_KEY = 'blueclue_notification_preferences';

const DEFAULT_PREFERENCES = {
  browserNotifications: true,
  emailNotifications: true,
  types: {
    assignment: true,
    overdue: true,
    update_request: true,
    mention: true,
  },
};

/**
 * Get all notification preferences
 * @returns {Object} User preferences object
 */
export const getPreferences = () => {
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error('Failed to parse notification preferences:', err);
  }
  return DEFAULT_PREFERENCES;
};

/**
 * Save notification preferences
 * @param {Object} preferences - Preferences object
 */
export const savePreferences = (preferences) => {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    return true;
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
 * @returns {boolean} New enabled state
 */
export const toggleNotificationType = (type) => {
  const preferences = getPreferences();
  const newState = !preferences.types?.[type];
  preferences.types = preferences.types || {};
  preferences.types[type] = newState;
  savePreferences(preferences);
  return newState;
};

/**
 * Toggle browser notifications
 * @returns {boolean} New enabled state
 */
export const toggleBrowserNotifications = () => {
  const preferences = getPreferences();
  const newState = !preferences.browserNotifications;
  preferences.browserNotifications = newState;
  savePreferences(preferences);
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
 * @returns {boolean} New enabled state
 */
export const toggleEmailNotifications = () => {
  const preferences = getPreferences();
  const newState = !preferences.emailNotifications;
  preferences.emailNotifications = newState;
  savePreferences(preferences);
  return newState;
};

/**
 * Reset preferences to default
 */
export const resetPreferences = () => {
  localStorage.removeItem(PREFERENCES_KEY);
};

export default {
  getPreferences,
  savePreferences,
  isNotificationTypeEnabled,
  areBrowserNotificationsEnabled,
  areEmailNotificationsEnabled,
  getEnabledNotificationTypes,
  toggleNotificationType,
  toggleBrowserNotifications,
  toggleEmailNotifications,
  resetPreferences,
};
