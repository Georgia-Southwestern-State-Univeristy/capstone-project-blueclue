import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import DirectMessage from '../models/DirectMessage.js';
import Notification from '../models/Notification.js';
import { emitNotificationToUser, emitUnreadCountToUser } from '../services/socketService.js';

const router = express.Router();

/**
 * GET /api/messages/:userId  — get conversation with a specific user
 * Query: ?limit=50&before=ISO_DATE
 */
router.get('/:userId', authenticateToken, async (req, res, next) => {
  try {
    const myId = req.user.id;
    const otherId = parseInt(req.params.userId, 10);
    if (!otherId || otherId === myId) {
      return res.status(400).json({ status: 'error', message: 'Invalid user ID' });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const before = req.query.before || undefined;

    const messages = await DirectMessage.getConversation(myId, otherId, { limit, before });

    // Mark as read
    await DirectMessage.markRead(myId, otherId);

    res.json({ status: 'success', data: messages });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/messages/:userId  — send a message to a user
 * Body: { message: string }
 */
router.post('/:userId', authenticateToken, async (req, res, next) => {
  try {
    const myId = req.user.id;
    const otherId = parseInt(req.params.userId, 10);
    if (!otherId || otherId === myId) {
      return res.status(400).json({ status: 'error', message: 'Invalid user ID' });
    }

    const { message } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ status: 'error', message: 'Message is required' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ status: 'error', message: 'Message too long (max 2000)' });
    }

    const dm = await DirectMessage.create({
      senderId: myId,
      receiverId: otherId,
      message: message.trim(),
    });

    // Emit via Socket.IO if available
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${otherId}`).emit('direct_message', {
        id: dm.id,
        sender_id: myId,
        receiver_id: otherId,
        message: dm.message,
        created_at: dm.created_at,
        sender_first_name: req.user.first_name,
        sender_last_name: req.user.last_name,
      });
    }

    // Create a push notification for the receiver
    try {
      const senderName = [req.user.first_name, req.user.last_name].filter(Boolean).join(' ') || 'Someone';
      const preview = dm.message.length > 100 ? dm.message.substring(0, 100) + '…' : dm.message;
      const notification = await Notification.create({
        user_id: otherId,
        type: 'direct_message',
        message: `New message from ${senderName}: ${preview}`,
        metadata: { sender_id: myId },
      });

      if (io) {
        emitNotificationToUser(io, otherId, notification);
        const unreadCount = await Notification.getUnreadCount(otherId);
        emitUnreadCountToUser(io, otherId, unreadCount);
      }
    } catch (notifErr) {
      console.error('Failed to create DM notification:', notifErr);
      // Don't fail the request if notification fails
    }

    res.status(201).json({ status: 'success', data: dm });
  } catch (err) {
    next(err);
  }
});

export default router;
