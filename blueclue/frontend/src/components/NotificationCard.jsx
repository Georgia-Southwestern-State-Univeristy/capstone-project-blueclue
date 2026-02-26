import { useState } from 'react';
import { markNotificationAsRead, deleteNotification } from '../services/notificationService';

function NotificationCard({ notification, onUpdate, onTicketClick }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleClick = async () => {
    // Mark as read first
    if (!notification.isRead) {
      try {
        await markNotificationAsRead(notification.id);
        onUpdate();
      } catch (err) {
        console.error('Failed to mark as read:', err);
      }
    }
    // If notification has a ticket, navigate to it
    if (notification.ticket_id && onTicketClick) {
      onTicketClick(notification.ticket_id);
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
      onClick={handleClick}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 ${getTypeColor(notification.type)}`}>
          {getNotificationIcon(notification.type)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-200 break-words">{notification.message}</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-gray-500">{formatTime(notification.createdAt)}</p>
            {notification.ticket_id && (
              <span className="text-xs text-blue-400 hover:text-blue-300">
                View ticket →
              </span>
            )}
          </div>
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

export default NotificationCard;