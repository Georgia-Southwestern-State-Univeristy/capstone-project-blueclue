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

// All routes require authentication
router.use(authenticateToken);

// Ticket comments
router.get('/tickets/:ticketId/comments', getCommentsByTicket);
router.post('/tickets/:ticketId/comments', createComment);
router.get('/tickets/:ticketId/comments/search', searchComments);

// Individual comment operations
router.patch('/comments/:commentId', updateComment);
router.delete('/comments/:commentId', deleteComment);

// Comment reactions
router.post('/comments/:commentId/reactions', addReaction);
router.delete('/comments/:commentId/reactions/:emoji', removeReaction);

export default router;
