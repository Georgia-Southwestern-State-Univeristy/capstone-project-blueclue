import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateToken } from '../middleware/auth.js';
import DirectMessage from '../models/DirectMessage.js';
import Notification from '../models/Notification.js';
import { emitNotificationToUser, emitUnreadCountToUser } from '../services/socketService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../../../uploads');

const router = express.Router();

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const MAX_B64_LEN = 6_800_000; // ~5 MB

/**
 * POST /api/messages/upload  — upload an image for a DM
 * Body: { filename, mimeType, dataBase64 }
 */
router.post('/upload', authenticateToken, async (req, res, next) => {
  try {
    const { filename, mimeType, dataBase64 } = req.body;
    const userId = req.user.id;

    if (!dataBase64 || !filename || !mimeType) {
      return res.status(400).json({ status: 'error', message: 'filename, mimeType, and dataBase64 are required' });
    }

    if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
      return res.status(415).json({ status: 'error', message: 'Only images are allowed (PNG, JPEG, GIF, WebP)' });
    }

    if (dataBase64.length > MAX_B64_LEN) {
      return res.status(413).json({ status: 'error', message: 'File too large. Maximum 5 MB.' });
    }

    const ext = path.extname(filename).replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'bin';
    const safeFilename = `dm_${userId}_${Date.now()}.${ext}`;
    const uploadDir = path.join(UPLOADS_DIR, 'dm');
    fs.mkdirSync(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, safeFilename);
    const fileBuffer = Buffer.from(dataBase64, 'base64');
    fs.writeFileSync(filePath, fileBuffer);

    const fileUrl = `/uploads/dm/${safeFilename}`;

    res.status(200).json({
      status: 'success',
      data: { url: fileUrl, filename: safeFilename, mimeType },
    });
  } catch (err) {
    next(err);
  }
});

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

    const { message, image_url } = req.body;
    if ((!message || typeof message !== 'string' || !message.trim()) && !image_url) {
      return res.status(400).json({ status: 'error', message: 'Message or image is required' });
    }
    if (message && message.length > 2000) {
      return res.status(400).json({ status: 'error', message: 'Message too long (max 2000)' });
    }

    const dm = await DirectMessage.create({
      senderId: myId,
      receiverId: otherId,
      message: message ? message.trim() : '',
      imageUrl: image_url || null,
    });

    // Emit via Socket.IO if available
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${otherId}`).emit('direct_message', {
        id: dm.id,
        sender_id: myId,
        receiver_id: otherId,
        message: dm.message,
        image_url: dm.image_url,
        created_at: dm.created_at,
        sender_first_name: req.user.firstName,
        sender_last_name: req.user.lastName,
      });
    }

    // Create a push notification for the receiver
    try {
      const senderName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || 'Someone';
      const preview = dm.image_url
        ? '📷 Sent an image'
        : dm.message.length > 100 ? dm.message.substring(0, 100) + '…' : dm.message;
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
