// Socket.io service for real-time notifications
import jwt from 'jsonwebtoken';

// Store connected users (userId -> socketId mapping)
const connectedUsers = new Map();

/**
 * Initialize Socket.io event handlers
 * @param {Server} io - Socket.io server instance
 */
export const initializeSocketHandlers = (io) => {
  // Socket.io authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`User ${userId} connected via WebSocket`);

    // Store the connection
    connectedUsers.set(userId, socket.id);

    // Send connection confirmation
    socket.emit('connected', { 
      message: 'Successfully connected to notification service',
      userId 
    });

    // Handle manual refresh request
    socket.on('refresh_notifications', () => {
      console.log(`User ${userId} requested notification refresh`);
      // Client will handle fetching notifications via HTTP API
      socket.emit('notifications_refresh_requested');
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User ${userId} disconnected from WebSocket`);
      connectedUsers.delete(userId);
    });
  });
};

/**
 * Emit a notification to a specific user
 * @param {Server} io - Socket.io server instance
 * @param {number} userId - Target user ID
 * @param {Object} notification - Notification data
 */
export const emitNotificationToUser = (io, userId, notification) => {
  const socketId = connectedUsers.get(userId);
  
  if (socketId) {
    io.to(socketId).emit('new_notification', notification);
    console.log(`Notification sent to user ${userId}`);
    return true;
  } else {
    console.log(`User ${userId} not connected to WebSocket`);
    return false;
  }
};

/**
 * Emit notification count update to a specific user
 * @param {Server} io - Socket.io server instance
 * @param {number} userId - Target user ID
 * @param {number} unreadCount - Unread notification count
 */
export const emitUnreadCountToUser = (io, userId, unreadCount) => {
  const socketId = connectedUsers.get(userId);
  
  if (socketId) {
    io.to(socketId).emit('unread_count_update', { unreadCount });
    console.log(`Unread count (${unreadCount}) sent to user ${userId}`);
    return true;
  }
  return false;
};

/**
 * Broadcast notification to multiple users
 * @param {Server} io - Socket.io server instance
 * @param {Array<number>} userIds - Array of user IDs
 * @param {Object} notification - Notification data
 */
export const broadcastNotification = (io, userIds, notification) => {
  let sentCount = 0;
  
  userIds.forEach(userId => {
    if (emitNotificationToUser(io, userId, notification)) {
      sentCount++;
    }
  });
  
  console.log(`Notification broadcast to ${sentCount}/${userIds.length} users`);
  return sentCount;
};

/**
 * Emit any named event to a specific user
 * @param {Server} io - Socket.io server instance
 * @param {number} userId - Target user ID
 * @param {string} event - Event name
 * @param {Object} data - Payload
 */
export const emitEventToUser = (io, userId, event, data) => {
  const socketId = connectedUsers.get(userId);
  if (socketId) {
    io.to(socketId).emit(event, data);
    return true;
  }
  return false;
};

/**
 * Get list of currently connected users
 * @returns {Array<number>} Array of connected user IDs
 */
export const getConnectedUsers = () => {
  return Array.from(connectedUsers.keys());
};

/**
 * Check if a user is connected
 * @param {number} userId - User ID to check
 * @returns {boolean} True if user is connected
 */
export const isUserConnected = (userId) => {
  return connectedUsers.has(userId);
};