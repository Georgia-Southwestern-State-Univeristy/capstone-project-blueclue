// =====================================================================
// Search History Routes
// =====================================================================
// Protected routes for managing user search history
// All routes require authentication
// =====================================================================

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getRecentSearches,
  addSearchToHistory,
  deleteSearchHistoryItem
} from '../controllers/searchHistoryController.js';

const router = express.Router();

// Protect all routes with authentication
router.use(authenticateToken);

// Get recent searches by type (ticket or knowledge_base)
router.get('/:type', getRecentSearches);

// Add a new search to history
router.post('/:type', addSearchToHistory);

// Delete a specific search history item
router.delete('/:id', deleteSearchHistoryItem);

export default router;
