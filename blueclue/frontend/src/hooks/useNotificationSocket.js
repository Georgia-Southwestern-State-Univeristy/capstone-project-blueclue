// Custom hook for real-time notification updates via WebSocket
import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

/**
 * Custom hook for real-time notifications
 * @param {Function} onNewNotification - Callback when new notification received
 * @param {Function} onUnreadCountUpdate - Callback when unread count updates
 * @returns {Object} { isConnected, refreshNotifications }
 */
export const useNotificationSocket = (onNewNotification, onUnreadCountUpdate) => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    const token = localStorage.getItem('blueclue_token');
    
    if (!token) {
      console.log('No token available for WebSocket connection');
      return;
    }

    // Don't create multiple connections
    if (socketRef.current?.connected) {
      console.log('WebSocket already connected');
      return;
    }

    console.log('Connecting to WebSocket server...');
    
    const socket = io(SOCKET_URL, {
      auth: {
        token
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    });

    socket.on('connected', (data) => {
      console.log('WebSocket connection confirmed:', data);
    });

    socket.on('new_notification', (notification) => {
      console.log('New notification received:', notification);
      if (onNewNotification) {
        onNewNotification(notification);
      }
    });

    socket.on('unread_count_update', (data) => {
      console.log('Unread count updated:', data.unreadCount);
      if (onUnreadCountUpdate) {
        onUnreadCountUpdate(data.unreadCount);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error.message);
      setIsConnected(false);
    });

    socketRef.current = socket;
  }, [onNewNotification, onUnreadCountUpdate]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('Disconnecting WebSocket...');
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const refreshNotifications = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('refresh_notifications');
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    refreshNotifications
  };
};

export default useNotificationSocket;
