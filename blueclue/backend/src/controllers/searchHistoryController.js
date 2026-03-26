// =====================================================================
// Search History Controller
// =====================================================================
// Handles user-specific search history for tickets and KB
// Features:
//   - Get recent 5 searches by type
//   - Add new search (with auto-deduplication)
//   - Delete individual history item
//   - User-specific isolation
// =====================================================================

import pool from '../config/database.js';

/**
 * Get recent searches for the authenticated user
 * @route GET /api/search-history/:type
 * @param {string} type - 'ticket' or 'knowledge_base'
 * @returns {Array} Recent searches (max 5)
 */
async function getRecentSearches(req, res) {
  try {
    const { type } = req.params;
    const userId = req.user.id;

    // Validate search type
    if (!['ticket', 'knowledge_base'].includes(type)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid search type. Must be "ticket" or "knowledge_base".' 
      });
    }

    const result = await pool.query(
      `SELECT id, query, created_at
       FROM search_history
       WHERE user_id = $1 AND search_type = $2
       ORDER BY created_at DESC
       LIMIT 5`,
      [userId, type]
    );

    res.json({
      success: true,
      searches: result.rows
    });
  } catch (error) {
    console.error('Error fetching search history:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch search history' 
    });
  }
}

/**
 * Add a new search to history
 * @route POST /api/search-history/:type
 * @body {string} query - The search query
 * @returns {Object} Success status
 */
async function addSearchToHistory(req, res) {
  try {
    const { type } = req.params;
    const { query } = req.body;
    const userId = req.user.id;

    // Validate inputs
    if (!['ticket', 'knowledge_base'].includes(type)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid search type. Must be "ticket" or "knowledge_base".' 
      });
    }

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Query is required and must be a non-empty string.' 
      });
    }

    const trimmedQuery = query.trim();

    // Check if this exact query already exists in recent history
    const existingCheck = await pool.query(
      `SELECT id FROM search_history
       WHERE user_id = $1 AND search_type = $2 AND query = $3
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, type, trimmedQuery]
    );

    if (existingCheck.rows.length > 0) {
      // Update timestamp by deleting and re-inserting
      await pool.query(
        'DELETE FROM search_history WHERE id = $1',
        [existingCheck.rows[0].id]
      );
    }

    // Insert the search (trigger will auto-limit to 5)
    await pool.query(
      `INSERT INTO search_history (user_id, search_type, query)
       VALUES ($1, $2, $3)`,
      [userId, type, trimmedQuery]
    );

    res.json({
      success: true,
      message: 'Search added to history'
    });
  } catch (error) {
    console.error('Error adding search to history:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add search to history' 
    });
  }
}

/**
 * Delete a specific search history item
 * @route DELETE /api/search-history/:id
 * @returns {Object} Success status
 */
async function deleteSearchHistoryItem(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid history item ID.' 
      });
    }

    // Delete only if it belongs to the current user
    const result = await pool.query(
      'DELETE FROM search_history WHERE id = $1 AND user_id = $2',
      [parseInt(id), userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Search history item not found or unauthorized.' 
      });
    }

    res.json({
      success: true,
      message: 'Search history item deleted'
    });
  } catch (error) {
    console.error('Error deleting search history item:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete search history item' 
    });
  }
}

export {
  getRecentSearches,
  addSearchToHistory,
  deleteSearchHistoryItem
};
