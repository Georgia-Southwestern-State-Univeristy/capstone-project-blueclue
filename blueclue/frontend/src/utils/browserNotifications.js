// Browser Notification API utilities

/**
 * Request permission for browser notifications
 * @returns {Promise<boolean>} True if permission granted
 */
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

/**
 * Check if browser notifications are supported and permitted
 * @returns {boolean} True if can show notifications
 */
export const canShowBrowserNotification = () => {
  return 'Notification' in window && Notification.permission === 'granted';
};

/**
 * Show a browser notification
 * @param {string} title - Notification title
 * @param {Object} options - Notification options
 * @param {string} options.body - Notification body text
 * @param {string} options.icon - Notification icon URL
 * @param {string} options.tag - Notification tag (for grouping/replacing)
 * @param {Function} options.onClick - Click handler
 * @returns {Notification|null} Notification instance or null
 */
export const showBrowserNotification = (title, options = {}) => {
  if (!canShowBrowserNotification()) {
    console.log('Cannot show browser notification - permission not granted');
    return null;
  }

  const {
    body = '',
    icon = '/blueclue-icon.png',
    tag = 'blueclue-notification',
    onClick = null
  } = options;

  try {
    const notification = new Notification(title, {
      body,
      icon,
      tag,
      badge: icon,
      requireInteraction: false,
      silent: false
    });

    if (onClick) {
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        onClick(event);
        notification.close();
      };
    }

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);

    return notification;
  } catch (error) {
    console.error('Error showing browser notification:', error);
    return null;
  }
};

/**
 * Show notification for new ticket assignment
 * @param {Object} notification - Notification data
 */
export const showNotificationAlert = (notification) => {
  const { type, message } = notification;

  const titles = {
    assignment: '🎫 New Ticket Assignment',
    overdue: '⏰ Overdue Ticket',
    update_request: '💬 Update Request',
    mention: '👤 You were mentioned'
  };

  const title = titles[type] || '🔔 New Notification';

  return showBrowserNotification(title, {
    body: message,
    tag: `blueclue-${type}`,
    onClick: () => {
      // Focus the app when notification is clicked
      window.focus();
    }
  });
};

/**
 * Get stored notification preference
 * @returns {boolean} True if user has enabled browser notifications
 */
export const getBrowserNotificationPreference = () => {
  const preference = localStorage.getItem('blueclue_browser_notifications');
  return preference === 'enabled';
};

/**
 * Set notification preference
 * @param {boolean} enabled - Whether to enable browser notifications
 */
export const setBrowserNotificationPreference = (enabled) => {
  localStorage.setItem('blueclue_browser_notifications', enabled ? 'enabled' : 'disabled');
};