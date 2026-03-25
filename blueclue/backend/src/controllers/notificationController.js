// src/controllers/notificationController.js
import Notification from '../models/Notification.js';
import NotificationPreference from '../models/NotificationPreference.js';
import { emitNotificationToUser, emitUnreadCountToUser } from '../services/socketService.js';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler.js';

// Valid notification types (must match database enum)
const VALID_TYPES = ['assignment', 'overdue', 'update_request', 'mention', 'comment'];

/**
 * Create a new notification
 * POST /api/notifications
 */
export const createNotification = async (req, res) => {
    const { user_id, type, message, ticket_id } = req.body;

    // Validation
    if (!user_id) {
        throw new BadRequestError('user_id is required');
    }

    if (!type) {
        throw new BadRequestError('type is required');
    }

    if (!VALID_TYPES.includes(type)) {
        throw new BadRequestError(`Invalid notification type. Must be one of: ${VALID_TYPES.join(', ')}`);
    }

    if (!message || message.trim() === '') {
        throw new BadRequestError('message is required');
    }

    if (message.length > 1000) {
        throw new BadRequestError('message must be 1000 characters or less');
    }

    try {
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
        // Handle foreign key violations
        if (error.code === '23503') {
            throw new BadRequestError('Invalid user_id or ticket_id');
        }
        throw error;
    }
};

/**
 * Get user notifications with pagination
 * GET /api/notifications
 */
export const getUserNotifications = async (req, res) => {
    // Get user ID from authenticated user
    const userId = req.user.id;

    // Parse pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Validate pagination parameters
    if (page < 1) {
        throw new BadRequestError('page must be greater than 0');
    }

    if (limit < 1 || limit > 100) {
        throw new BadRequestError('limit must be between 1 and 100');
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
};

/**
 * Mark a notification as read
 * PATCH /api/notifications/:id/read
 */
export const markNotificationAsRead = async (req, res) => {
    const notificationId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(notificationId)) {
        throw new BadRequestError('Invalid notification ID');
    }

    const notification = await Notification.markAsRead(notificationId, userId);

    if (!notification) {
        throw new NotFoundError('Notification not found or access denied');
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
};

/**
 * Delete a notification
 * DELETE /api/notifications/:id
 */
export const deleteNotification = async (req, res) => {
    const notificationId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(notificationId)) {
        throw new BadRequestError('Invalid notification ID');
    }

    const notification = await Notification.delete(notificationId, userId);

    if (!notification) {
        throw new NotFoundError('Notification not found or access denied');
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
};

/**
 * Mark all notifications as read for the authenticated user
 * PATCH /api/notifications/read-all
 */
export const markAllNotificationsAsRead = async (req, res) => {
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
};

/**
 * Delete all read notifications for the authenticated user
 * DELETE /api/notifications/read
 */
export const deleteAllReadNotifications = async (req, res) => {
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
};

/**
 * Get notification preferences for the authenticated user
 * GET /api/notifications/preferences
 */
export const getNotificationPreferences = async (req, res) => {
    const prefs = await NotificationPreference.getByUserId(req.user.id);
    res.json({ status: 'success', data: prefs });
};

/**
 * Update notification preferences for the authenticated user
 * PUT /api/notifications/preferences
 */
export const updateNotificationPreferences = async (req, res) => {
    const { browserNotifications, emailNotifications, types } = req.body;
    const prefs = await NotificationPreference.upsert(req.user.id, {
        browserNotifications,
        emailNotifications,
        types,
    });
    res.json({ status: 'success', data: prefs });
};