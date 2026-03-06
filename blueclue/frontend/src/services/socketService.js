// Socket service for real-time updates
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';

let socket = null;

export const getSocket = () => {
  // Only create a new socket instance if one doesn't exist yet.
  // Never recreate during socket.io's own reconnect window — that causes
  // an exponential connection storm where each effect re-run spawns another socket.
  if (!socket) {
    const token = localStorage.getItem('blueclue_token');
    
    if (!token) {
      console.warn('No token available for WebSocket connection');
      return null;
    }

    socket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      console.log('Socket.IO connected');
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error.message);
    });
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export default { getSocket, disconnectSocket };
