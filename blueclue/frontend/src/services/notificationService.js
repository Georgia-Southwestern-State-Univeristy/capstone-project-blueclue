// Notification Service - API calls for notification operations

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
    this.type = type;
    this.status = status;
  }
}

/**
 * Get user-friendly error message based on error type
 */
const getUserFriendlyMessage = (error, defaultMessage) => {
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return 'Unable to connect to the server. Please check your internet connection and try again.';
  }
  
  if (error.name === 'AbortError') {
    return 'The request took too long. Please try again.';
  }
  
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
    let error;
    try {
      const data = await response.json();
      error = new ApiError(
        data.message || errorMessage,
        data.type || 'server',
        response.status
      );
    } catch {
      error = new ApiError(errorMessage, 'server', response.status);
    }
    throw error;
  }
  
  return response.json();
};

/**
 * Normalize notification data from API (snake_case to camelCase)
 */
export const normalizeNotification = (notification) => ({
  ...notification,
  isRead: notification.is_read,
  createdAt: notification.created_at,
  // Keep original snake_case for backend operations
  is_read: notification.is_read,
  created_at: notification.created_at,
});

/**
 * Get user notifications
 * @param {Object} params - Query parameters
 * @param {number} params.page - Page number (default: 1)
 * @param {number} params.limit - Items per page (default: 20)
 * @param {boolean} params.unreadOnly - Get only unread notifications
 * @returns {Promise<Object>} Notifications data with pagination
 */
export const getUserNotifications = async ({ page = 1, limit = 20, unreadOnly = false } = {}) => {
  try {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    if (unreadOnly) {
      queryParams.append('unreadOnly', 'true');
    }
    
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/notifications?${queryParams}`,
      {
        method: 'GET',
        headers: getAuthHeaders(),
      }
    );
    
    const apiResponse = await handleResponse(response, 'Failed to fetch notifications');
    
    // Extract the data object from the API response
    const data = apiResponse.data || apiResponse;
    
    // Normalize notification data
    if (data.notifications && Array.isArray(data.notifications)) {
      data.notifications = data.notifications.map(normalizeNotification);
    }
    
    return data;
  } catch (error) {
    const message = getUserFriendlyMessage(error, 'Failed to load notifications');
    throw new ApiError(message, error.type || 'unknown', error.status);
  }
};

/**
 * Get unread notification count
 * @returns {Promise<number>} Count of unread notifications
 */
export const getUnreadCount = async () => {
  try {
    const data = await getUserNotifications({ limit: 1, unreadOnly: true });
    return data.pagination?.total || 0;
  } catch (error) {
    console.error('Failed to get unread count:', error);
    return 0;
  }
};

/**
 * Mark a notification as read
 * @param {number} notificationId - ID of the notification
 * @returns {Promise<Object>} Updated notification
 */
export const markNotificationAsRead = async (notificationId) => {
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/notifications/${notificationId}/read`,
      {
        method: 'PATCH',
        headers: getAuthHeaders(),
      }
    );
    
    return await handleResponse(response, 'Failed to mark notification as read');
  } catch (error) {
    const message = getUserFriendlyMessage(error, 'Failed to update notification');
    throw new ApiError(message, error.type || 'unknown', error.status);
  }
};

/**
 * Mark all notifications as read
 * @returns {Promise<Object>} Result with count of updated notifications
 */
export const markAllNotificationsAsRead = async () => {
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/notifications/read-all`,
      {
        method: 'PATCH',
        headers: getAuthHeaders(),
      }
    );
    
    return await handleResponse(response, 'Failed to mark all notifications as read');
  } catch (error) {
    const message = getUserFriendlyMessage(error, 'Failed to update notifications');
    throw new ApiError(message, error.type || 'unknown', error.status);
  }
};

/**
 * Delete a notification
 * @param {number} notificationId - ID of the notification
 * @returns {Promise<void>}
 */
export const deleteNotification = async (notificationId) => {
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/notifications/${notificationId}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }
    );
    
    await handleResponse(response, 'Failed to delete notification');
  } catch (error) {
    const message = getUserFriendlyMessage(error, 'Failed to delete notification');
    throw new ApiError(message, error.type || 'unknown', error.status);
  }
};

/**
 * Delete all read notifications
 * @returns {Promise<Object>} Result with count of deleted notifications
 */
export const deleteAllReadNotifications = async () => {
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/notifications/read`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }
    );
    
    return await handleResponse(response, 'Failed to delete read notifications');
  } catch (error) {
    const message = getUserFriendlyMessage(error, 'Failed to delete notifications');
    throw new ApiError(message, error.type || 'unknown', error.status);
  }
};

/**
 * Create a notification (typically used by admins/system)
 * @param {Object} notificationData - Notification data
 * @param {number} notificationData.userId - Target user ID
 * @param {string} notificationData.type - Notification type
 * @param {string} notificationData.message - Notification message
 * @param {number} [notificationData.ticketId] - Related ticket ID (optional)
 * @returns {Promise<Object>} Created notification
 */
export const createNotification = async (notificationData) => {
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/notifications`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(notificationData),
      }
    );
    
    return await handleResponse(response, 'Failed to create notification');
  } catch (error) {
    const message = getUserFriendlyMessage(error, 'Failed to create notification');
    throw new ApiError(message, error.type || 'unknown', error.status);
  }
};