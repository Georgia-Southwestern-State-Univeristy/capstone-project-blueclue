// src/routes/notifications.js
import express from 'express';
import {
    createNotification,
    getUserNotifications,
    markNotificationAsRead,
    deleteNotification,
    markAllNotificationsAsRead,
    deleteAllReadNotifications
} from '../controllers/notificationController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   POST /api/notifications
 * @desc    Create a new notification
 * @access  Private (requires authentication)
 */
router.post('/', authenticateToken, createNotification);

/**
 * @route   GET /api/notifications
 * @desc    Get user notifications with pagination
 * @access  Private (requires authentication)
 */
router.get('/', authenticateToken, getUserNotifications);

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all notifications as read for the authenticated user
 * @access  Private (requires authentication)
 */
router.patch('/read-all', authenticateToken, markAllNotificationsAsRead);

/**
 * @route   DELETE /api/notifications/read
 * @desc    Delete all read notifications for the authenticated user
 * @access  Private (requires authentication)
 */
router.delete('/read', authenticateToken, deleteAllReadNotifications);

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark a notification as read
 * @access  Private (requires authentication)
 */
router.patch('/:id/read', authenticateToken, markNotificationAsRead);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  Private (requires authentication)
 */
router.delete('/:id', authenticateToken, deleteNotification);

export default router;