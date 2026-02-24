import { useState, useEffect } from 'react';
import { 
  getUserNotifications, 
  markAllNotificationsAsRead, 
  deleteAllReadNotifications
} from '../services/notificationService';
import LoadingSpinner from './LoadingSpinner';
import NotificationCard from './NotificationCard';

function NotificationDropdown({ isOpen, onClose, onNotificationUpdate }) {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState(null);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getUserNotifications({ limit: 20 });
      setNotifications(data.notifications || []);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message || 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      // Update all notifications to read status
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      // Notify parent to refresh unread count
      if (onNotificationUpdate) onNotificationUpdate();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleClearRead = async () => {
    try {
      await deleteAllReadNotifications();
      // Remove read notifications from list
      setNotifications(prev => prev.filter(n => !n.isRead));
      // Notify parent to refresh unread count
      if (onNotificationUpdate) onNotificationUpdate();
    } catch (err) {
      console.error('Failed to clear read notifications:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute right-0 mt-2 w-96 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">Notifications</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
          aria-label="Close notifications"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Action Buttons */}
      {notifications.length > 0 && (
        <div className="flex gap-2 px-4 py-2 border-b border-gray-700 bg-gray-800/50">
          <button
            onClick={handleMarkAllAsRead}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Mark all as read
          </button>
          <span className="text-gray-600">•</span>
          <button
            onClick={handleClearRead}
            className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
          >
            Clear read
          </button>
        </div>
      )}

      {/* Notification List */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-center">
            <svg className="w-12 h-12 mx-auto text-red-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={fetchNotifications}
              className="mt-3 text-blue-400 hover:text-blue-300 text-sm"
            >
              Try again
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <svg className="w-12 h-12 mx-auto text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-gray-400 text-sm">No notifications yet</p>
            <p className="text-gray-500 text-xs mt-1">We'll notify you when something happens</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {notifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onUpdate={() => {
                  fetchNotifications();
                  if (onNotificationUpdate) onNotificationUpdate();
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer with pagination info */}
      {pagination && pagination.total > 0 && (
        <div className="px-4 py-2 border-t border-gray-700 bg-gray-800/50">
          <p className="text-xs text-gray-400 text-center">
            Showing {notifications.length} of {pagination.total} notification{pagination.total !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}

export default NotificationDropdown;