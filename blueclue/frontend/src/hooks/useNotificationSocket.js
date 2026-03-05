// Custom hook for real-time notification updates via WebSocket
import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

/**
 * Custom hook for real-time notifications and ticket change events.
 * @param {Function} onNewNotification   - Callback when a new notification arrives
 * @param {Function} onUnreadCountUpdate - Callback when unread count changes
 * @param {Function} onTicketChange      - Callback when ticket_created / ticket_updated fires
 * @returns {{ isConnected: boolean, refreshNotifications: Function }}
 */
export const useNotificationSocket = (onNewNotification, onUnreadCountUpdate, onTicketChange) => {
  const socketRef   = useRef(null);
  const debounceRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  // Debounce ticket-change refresh so rapid bursts only trigger one reload
  const fireTicketChange = useCallback((payload) => {
    if (!onTicketChange) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onTicketChange(payload), 300);
  }, [onTicketChange]);

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
      auth: { token },
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

    // Auto-refresh: listen for ticket mutations from other users/the server
    socket.on('ticket_created', (payload) => {
      console.log('ticket_created received:', payload);
      fireTicketChange({ event: 'ticket_created', ...payload });
    });

    socket.on('ticket_updated', (payload) => {
      console.log('ticket_updated received:', payload);
      fireTicketChange({ event: 'ticket_updated', ...payload });
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
  }, [onNewNotification, onUnreadCountUpdate, fireTicketChange]);

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
      clearTimeout(debounceRef.current);
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    refreshNotifications
  };
};

export default useNotificationSocket;