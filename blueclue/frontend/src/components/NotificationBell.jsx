import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { getUnreadCount, normalizeNotification, getUserNotifications } from '../services/notificationService';
import { isNotificationTypeEnabled, areBrowserNotificationsEnabled } from '../services/preferencesService';
import { useNotificationSocket } from '../hooks/useNotificationSocket';
import { getIncomingRingRequests } from '../services/ringService';
import { 
  showNotificationAlert, 
  requestNotificationPermission 
} from '../utils/browserNotifications';
import RingRequestPopup from './RingRequestPopup';

const NotificationBell = forwardRef(({ onClick, onNewNotification }, ref) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasNewNotification, setHasNewNotification] = useState(false);
  const [ringRequestPopup, setRingRequestPopup] = useState(null);

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
  const handleNewNotification = useCallback(async (notification) => {
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
    
    // Show in-app popup for ring requests (only if still pending)
    if (normalized.type === 'ring_request') {
      try {
        const activeRingRequests = await getIncomingRingRequests();
        const ringRequestId = normalized.metadata?.ring_request_id;
        const isStillPending = activeRingRequests.some(req => req.id === ringRequestId && req.status === 'pending');
        
        if (isStillPending) {
          setRingRequestPopup(normalized);
        }
      } catch (error) {
        console.error('Failed to verify ring request status:', error);
      }
    }
    
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

  // Check for existing unread ring requests on mount
  useEffect(() => {
    const checkForPendingRingRequests = async () => {
      try {
        // Get both notifications and active ring requests
        const [{ notifications }, activeRingRequests] = await Promise.all([
          getUserNotifications({ unreadOnly: true, limit: 50 }),
          getIncomingRingRequests()
        ]);
        
        const ringRequestNotification = notifications.find(n => n.type === 'ring_request');
        
        if (ringRequestNotification) {
          const ringRequestId = ringRequestNotification.metadata?.ring_request_id;
          const isStillPending = activeRingRequests.some(req => req.id === ringRequestId && req.status === 'pending');
          
          if (isStillPending) {
            setRingRequestPopup(ringRequestNotification);
          }
        }
      } catch (error) {
        console.error('Failed to check for pending ring requests:', error);
      }
    };

    checkForPendingRingRequests();
  }, []); // Only run on mount

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
    <>
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

      {/* Ring Request Popup */}
      {ringRequestPopup ? (
        <RingRequestPopup
          notification={ringRequestPopup}
          onRespond={(action) => {
            console.log('Ring request responded:', action);
            fetchUnreadCount();
          }}
          onClose={() => {
            console.log('Closing ring request popup');
            setRingRequestPopup(null);
          }}
        />
      ) : null}
    </>
  );
});

NotificationBell.displayName = 'NotificationBell';

export default NotificationBell;