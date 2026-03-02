import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { getUnreadCount, normalizeNotification } from '../services/notificationService';
import { isNotificationTypeEnabled, areBrowserNotificationsEnabled } from '../services/preferencesService';
import { useNotificationSocket } from '../hooks/useNotificationSocket';
import { 
  showNotificationAlert, 
  requestNotificationPermission 
} from '../utils/browserNotifications';

const NotificationBell = forwardRef(({ onClick, onNewNotification }, ref) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasNewNotification, setHasNewNotification] = useState(false);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      setIsLoading(true);
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // WebSocket real-time updates
  const handleNewNotification = useCallback((notification) => {
    // Normalize notification data from WebSocket (snake_case to camelCase)
    const normalized = normalizeNotification(notification);
    
    // Check if this notification type is enabled in preferences
    if (!isNotificationTypeEnabled(normalized.type)) {
      console.log(`Notification type "${normalized.type}" is disabled, skipping`);
      return;
    }
    
    console.log('Bell received new notification:', normalized);
    setHasNewNotification(true);
    // Don't call fetchUnreadCount() here - the backend sends unread_count_update event
    
    // Show browser notification if enabled
    if (areBrowserNotificationsEnabled()) {
      showNotificationAlert(normalized);
    }
    
    // Pass to parent if callback provided
    if (onNewNotification) {
      onNewNotification(normalized);
    }
    
    // Reset animation after 3 seconds
    setTimeout(() => setHasNewNotification(false), 3000);
  }, [onNewNotification]);

  const handleUnreadCountUpdate = useCallback((count) => {
    console.log('Bell received unread count update:', count);
    setUnreadCount(count);
  }, []);

  useNotificationSocket(handleNewNotification, handleUnreadCountUpdate);

  // Initial fetch and polling (as backup for WebSocket)
  useEffect(() => {
    fetchUnreadCount();

    // Request notification permission on mount if preference is enabled
    if (areBrowserNotificationsEnabled()) {
      requestNotificationPermission();
    }

    // Poll every 60 seconds as backup (WebSocket should handle real-time updates)
    const interval = setInterval(fetchUnreadCount, 60000);

    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Expose refresh method to parent via ref
  useImperativeHandle(ref, () => ({
    refresh: fetchUnreadCount
  }));

  return (
    <button
      onClick={onClick}
      className={`relative w-10 h-10 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 transition-colors ${
        hasNewNotification ? 'animate-pulse' : ''
      }`}
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
    >
      {/* Bell Icon */}
      <svg
        className={`w-6 h-6 transition-colors ${
          hasNewNotification ? 'text-blue-400' : 'text-gray-300'
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>

      {/* Unread Badge */}
      {unreadCount > 0 && (
        <span className={`absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white rounded-full min-w-[1.25rem] ${
          hasNewNotification ? 'bg-blue-500 animate-bounce' : 'bg-red-600'
        }`}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <span className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
      )}
    </button>
  );
});

NotificationBell.displayName = 'NotificationBell';

export default NotificationBell;