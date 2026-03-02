import express from 'express';
import * as knowledgeBaseController from '../controllers/knowledgeBaseController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// ============================================================================
// ARTICLE ROUTES
// ============================================================================

// Get all articles (management view - requires authentication)
router.get('/articles', 
    authenticateToken, 
    requireRole(['admin', 'technician', 'management']),
    knowledgeBaseController.getAllArticles
);

// Get single article by ID
router.get('/articles/:id', 
    authenticateToken,
    requireRole(['admin', 'technician', 'management']),
    knowledgeBaseController.getArticleById
);

// Create new article
router.post('/articles', 
    authenticateToken,
    requireRole(['admin', 'technician', 'management']),
    knowledgeBaseController.createArticle
);

// Update article
router.put('/articles/:id', 
    authenticateToken,
    requireRole(['admin', 'technician', 'management']),
    knowledgeBaseController.updateArticle
);

// Delete article (soft delete)
router.delete('/articles/:id', 
    authenticateToken,
    requireRole(['admin', 'technician', 'management']),
    knowledgeBaseController.deleteArticle
);

// Toggle publish status
router.patch('/articles/:id/publish', 
    authenticateToken,
    requireRole(['admin', 'technician', 'management']),
    knowledgeBaseController.togglePublishArticle
);

// Increment view count (for tracking analytics)
router.post('/articles/:id/view',
    knowledgeBaseController.incrementViewCount
);

// Submit feedback/vote on article (optional auth - allows anonymous)
router.post('/articles/:id/feedback',
    knowledgeBaseController.submitFeedback
);

// ============================================================================
// CATEGORY ROUTES
// ============================================================================

// Get all categories
router.get('/categories', 
    authenticateToken,
    requireRole(['admin', 'technician', 'management']),
    knowledgeBaseController.getCategories
);

// Create new category
router.post('/categories', 
    authenticateToken,
    requireRole(['admin', 'management']),
    knowledgeBaseController.createCategory
);

// Update category
router.put('/categories/:id', 
    authenticateToken,
    requireRole(['admin', 'management']),
    knowledgeBaseController.updateCategory
);

// Delete category
router.delete('/categories/:id', 
    authenticateToken,
    requireRole(['admin', 'management']),
    knowledgeBaseController.deleteCategory
);

// ============================================================================
// TAG ROUTES
// ============================================================================

// Get all tags with usage counts
router.get('/tags', 
    authenticateToken,
    requireRole(['admin', 'technician', 'management']),
    knowledgeBaseController.getAllTags
);

// Bulk update tags for multiple articles
router.post('/tags/bulk-update', 
    authenticateToken,
    requireRole(['admin', 'technician', 'management']),
    knowledgeBaseController.bulkUpdateTags
);

// ============================================================================
// VERSION CONTROL ROUTES
// ============================================================================

// Get version history for an article
router.get('/articles/:id/versions', 
    authenticateToken,
    requireRole(['admin', 'technician', 'management']),
    knowledgeBaseController.getArticleVersions
);

// Get specific version details
router.get('/articles/:id/versions/:versionNumber', 
    authenticateToken,
    requireRole(['admin', 'technician', 'management']),
    knowledgeBaseController.getVersionById
);

// Restore article to previous version
router.post('/articles/:id/versions/:versionNumber/restore', 
    authenticateToken,
    requireRole(['admin', 'technician', 'management']),
    knowledgeBaseController.restoreVersion
);

// ============================================================================
// ANALYTICS ROUTES
// ============================================================================

// Get analytics dashboard data
router.get('/analytics', 
    authenticateToken,
    requireRole(['admin', 'technician', 'management']),
    knowledgeBaseController.getAnalytics
);

// ============================================================================
// SEARCH ROUTES
// ============================================================================

// Full-text search articles (public - no auth required)
router.get('/search', 
    knowledgeBaseController.searchArticles
);

// Get autocomplete suggestions (public - no auth required)
router.get('/search/autocomplete', 
    knowledgeBaseController.getSearchSuggestions
);

// Get related articles (public - no auth required)
router.get('/articles/:id/related',
    knowledgeBaseController.getRelatedArticles
);

// Get single public article (public - no auth required)
router.get('/public/articles/:id',
    knowledgeBaseController.getPublicArticle
);

export default router;
