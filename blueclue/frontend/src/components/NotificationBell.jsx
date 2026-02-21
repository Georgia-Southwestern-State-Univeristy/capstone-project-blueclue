import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { getUnreadCount } from '../services/notificationService';

const NotificationBell = forwardRef(({ onClick }, ref) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch unread count
  const fetchUnreadCount = async () => {
    try {
      setIsLoading(true);
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    fetchUnreadCount();

    // Poll every 30 seconds for new notifications
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(interval);
  }, []);

  // Expose refresh method to parent via ref
  useImperativeHandle(ref, () => ({
    refresh: fetchUnreadCount
  }));

  return (
    <button
      onClick={onClick}
      className="relative w-10 h-10 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 transition-colors"
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
    >
      {/* Bell Icon */}
      <svg
        className="w-6 h-6 text-gray-300"
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
        <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full min-w-[1.25rem]">
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
