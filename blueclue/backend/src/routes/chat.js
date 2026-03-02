import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  sendMessage,
  getHistory,
  getConversations,
  submitFeedback,
  clearHistory,
  endConversation
} from '../controllers/chatController.js';

const router = express.Router();

/**
 * Chat Routes
 * All routes require authentication
 */

/**
 * @route   POST /api/chat/message
 * @desc    Send a message and get bot response
 * @access  Private (authenticated users)
 */
router.post('/message', authenticateToken, sendMessage);

/**
 * @route   GET /api/chat/history
 * @desc    Get chat history for a conversation
 * @query   conversationId - ID of the conversation
 * @access  Private (authenticated users)
 */
router.get('/history', authenticateToken, getHistory);

/**
 * @route   GET /api/chat/conversations
 * @desc    Get all conversations for the logged-in user
 * @access  Private (authenticated users)
 */
router.get('/conversations', authenticateToken, getConversations);

/**
 * @route   POST /api/chat/feedback
 * @desc    Submit feedback on a bot response
 * @access  Private (authenticated users)
 */
router.post('/feedback', authenticateToken, submitFeedback);

/**
 * @route   POST /api/chat/clear
 * @desc    Clear chat history
 * @access  Private (authenticated users)
 */
router.post('/clear', authenticateToken, clearHistory);

/**
 * @route   POST /api/chat/end
 * @desc    End a conversation
 * @access  Private (authenticated users)
 */
router.post('/end', authenticateToken, endConversation);

export default router;
