// src/routes/commentRoutes.js
import express from 'express';
import {
    getCommentsByTicket,
    createComment,
    updateComment,
    deleteComment,
    addReaction,
    removeReaction,
    searchComments
} from '../controllers/commentController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Ticket comments (all require authentication)
router.get('/tickets/:ticketId/comments', authenticateToken, getCommentsByTicket);
router.post('/tickets/:ticketId/comments', authenticateToken, createComment);
router.get('/tickets/:ticketId/comments/search', authenticateToken, searchComments);

// Individual comment operations
router.patch('/comments/:commentId', authenticateToken, updateComment);
router.delete('/comments/:commentId', authenticateToken, deleteComment);

// Comment reactions
router.post('/comments/:commentId/reactions', authenticateToken, addReaction);
router.delete('/comments/:commentId/reactions/:emoji', authenticateToken, removeReaction);

export default router;
