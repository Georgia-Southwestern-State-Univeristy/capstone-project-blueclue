import { useState, useEffect } from 'react';
import { 
  getUserNotifications, 
  markAllNotificationsAsRead, 
  deleteAllReadNotifications,
  markNotificationAsRead,
  deleteNotification 
} from '../services/notificationService';
import LoadingSpinner from './LoadingSpinner';

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
              <NotificationItem
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

// Temporary inline NotificationItem component (will be replaced by NotificationCard in component #3)
function NotificationItem({ notification, onUpdate }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleMarkAsRead = async () => {
    if (notification.isRead) return;
    
    try {
      await markNotificationAsRead(notification.id);
      onUpdate();
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteNotification(notification.id);
      onUpdate();
    } catch (err) {
      console.error('Failed to delete notification:', err);
      setIsDeleting(false);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'assignment':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'overdue':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'update_request':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        );
      case 'mention':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'assignment': return 'text-blue-400';
      case 'overdue': return 'text-red-400';
      case 'update_request': return 'text-yellow-400';
      case 'mention': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      className={`px-4 py-3 hover:bg-gray-700/50 transition-colors cursor-pointer ${
        !notification.isRead ? 'bg-gray-700/30' : ''
      } ${isDeleting ? 'opacity-50' : ''}`}
      onClick={handleMarkAsRead}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 ${getTypeColor(notification.type)}`}>
          {getNotificationIcon(notification.type)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-200 break-words">{notification.message}</p>
          <p className="text-xs text-gray-500 mt-1">{formatTime(notification.createdAt)}</p>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-start gap-2">
          {!notification.isRead && (
            <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5" title="Unread"></span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            disabled={isDeleting}
            className="text-gray-500 hover:text-red-400 transition-colors"
            aria-label="Delete notification"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default NotificationDropdown;
