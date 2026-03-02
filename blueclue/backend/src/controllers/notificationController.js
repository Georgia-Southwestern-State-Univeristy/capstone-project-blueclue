// src/controllers/notificationController.js
import Notification from '../models/Notification.js';
import { emitNotificationToUser, emitUnreadCountToUser } from '../services/socketService.js';

// Valid notification types (must match database enum)
const VALID_TYPES = ['assignment', 'overdue', 'update_request', 'mention', 'comment'];

/**
 * Create a new notification
 * POST /api/notifications
 */
export const createNotification = async (req, res) => {
    try {
        const { user_id, type, message, ticket_id } = req.body;

        // Validation
        if (!user_id) {
            return res.status(400).json({
                status: 'error',
                message: 'user_id is required'
            });
        }

        if (!type) {
            return res.status(400).json({
                status: 'error',
                message: 'type is required'
            });
        }

        if (!VALID_TYPES.includes(type)) {
            return res.status(400).json({
                status: 'error',
                message: `Invalid notification type. Must be one of: ${VALID_TYPES.join(', ')}`
            });
        }

        if (!message || message.trim() === '') {
            return res.status(400).json({
                status: 'error',
                message: 'message is required'
            });
        }

        if (message.length > 1000) {
            return res.status(400).json({
                status: 'error',
                message: 'message must be 1000 characters or less'
            });
        }

        const notification = await Notification.create({
            user_id,
            type,
            message: message.trim(),
            ticket_id: ticket_id || null
        });

        // Emit real-time notification via WebSocket
        const io = req.app.get('io');
        if (io) {
            emitNotificationToUser(io, user_id, notification);
            
            // Get updated unread count and emit it
            const unreadCount = await Notification.getUnreadCount(user_id);
            emitUnreadCountToUser(io, user_id, unreadCount);
        }

        res.status(201).json({
            status: 'success',
            message: 'Notification created successfully',
            data: notification
        });
    } catch (error) {
        console.error('Error creating notification:', error);
        
        // Handle foreign key violations
        if (error.code === '23503') {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid user_id or ticket_id'
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Failed to create notification'
        });
    }
};

/**
 * Get user notifications with pagination
 * GET /api/notifications
 */
export const getUserNotifications = async (req, res) => {
    try {
        // Get user ID from authenticated user
        const userId = req.user.id;

        // Parse pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        // Validate pagination parameters
        if (page < 1) {
            return res.status(400).json({
                status: 'error',
                message: 'page must be greater than 0'
            });
        }

        if (limit < 1 || limit > 100) {
            return res.status(400).json({
                status: 'error',
                message: 'limit must be between 1 and 100'
            });
        }

        const result = await Notification.getByUserId(userId, limit, offset);

        res.json({
            status: 'success',
            data: {
                notifications: result.notifications,
                pagination: {
                    page,
                    limit,
                    total: result.total,
                    total_pages: Math.ceil(result.total / limit)
                },
                unread_count: result.unread_count
            }
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch notifications'
        });
    }
};

/**
 * Mark a notification as read
 * PATCH /api/notifications/:id/read
 */
export const markNotificationAsRead = async (req, res) => {
    try {
        const notificationId = parseInt(req.params.id);
        const userId = req.user.id;

        if (isNaN(notificationId)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid notification ID'
            });
        }

        const notification = await Notification.markAsRead(notificationId, userId);

        if (!notification) {
            return res.status(404).json({
                status: 'error',
                message: 'Notification not found or access denied'
            });
        }

        // Emit real-time update via WebSocket
        const io = req.app.get('io');
        if (io) {
            const unreadCount = await Notification.getUnreadCount(userId);
            emitUnreadCountToUser(io, userId, unreadCount);
        }

        res.json({
            status: 'success',
            message: 'Notification marked as read',
            data: notification
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to mark notification as read'
        });
    }
};

/**
 * Delete a notification
 * DELETE /api/notifications/:id
 */
export const deleteNotification = async (req, res) => {
    try {
        const notificationId = parseInt(req.params.id);
        const userId = req.user.id;

        if (isNaN(notificationId)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid notification ID'
            });
        }

        const notification = await Notification.delete(notificationId, userId);

        if (!notification) {
            return res.status(404).json({
                status: 'error',
                message: 'Notification not found or access denied'
            });
        }

        // Emit real-time update via WebSocket
        const io = req.app.get('io');
        if (io) {
            const unreadCount = await Notification.getUnreadCount(userId);
            emitUnreadCountToUser(io, userId, unreadCount);
        }

        res.json({
            status: 'success',
            message: 'Notification deleted successfully',
            data: notification
        });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete notification'
        });
    }
};

/**
 * Mark all notifications as read for the authenticated user
 * PATCH /api/notifications/read-all
 */
export const markAllNotificationsAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const count = await Notification.markAllAsRead(userId);

        // Emit real-time update via WebSocket
        const io = req.app.get('io');
        if (io) {
            emitUnreadCountToUser(io, userId, 0); // All marked as read, so count is 0
        }

        res.json({
            status: 'success',
            message: `${count} notification(s) marked as read`,
            data: { count }
        });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to mark all notifications as read'
        });
    }
};

/**
 * Delete all read notifications for the authenticated user
 * DELETE /api/notifications/read
 */
export const deleteAllReadNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const count = await Notification.deleteAllRead(userId);

        // Emit real-time update via WebSocket (unread count shouldn't change, but refresh list)
        const io = req.app.get('io');
        if (io) {
            const unreadCount = await Notification.getUnreadCount(userId);
            emitUnreadCountToUser(io, userId, unreadCount);
        }

        res.json({
            status: 'success',
            message: `${count} notification(s) deleted`,
            data: { count }
        });
    } catch (error) {
        console.error('Error deleting read notifications:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete read notifications'
        });
    }
};