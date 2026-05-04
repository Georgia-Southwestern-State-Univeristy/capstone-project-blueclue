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
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Ticket comments (all require authentication)
router.get('/tickets/:ticketId/comments', authenticateToken, asyncHandler(getCommentsByTicket));
router.post('/tickets/:ticketId/comments', authenticateToken, asyncHandler(createComment));
router.get('/tickets/:ticketId/comments/search', authenticateToken, asyncHandler(searchComments));

// Individual comment operations
router.patch('/comments/:commentId', authenticateToken, asyncHandler(updateComment));
router.delete('/comments/:commentId', authenticateToken, asyncHandler(deleteComment));

// Comment reactions
router.post('/comments/:commentId/reactions', authenticateToken, asyncHandler(addReaction));
router.delete('/comments/:commentId/reactions/:emoji', authenticateToken, asyncHandler(removeReaction));

export default router;
