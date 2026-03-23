// src/routes/templates.js
import express from 'express';
import {
    getAllTemplates,
    getTemplateById,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplateCategories,
    getPopularTemplates,
    applyTemplate,
    recordTemplateUsage,
    getTemplateVersions,
    restoreTemplateVersion,
    exportTemplate,
    importTemplate,
    toggleTemplateStatus
} from '../controllers/templateController.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   GET /api/templates/categories
 * @desc    Get all template categories with counts
 * @access  Public
 */
router.get('/categories', getTemplateCategories);

/**
 * @route   GET /api/templates/popular
 * @desc    Get most used templates
 * @access  Public
 */
router.get('/popular', getPopularTemplates);

/**
 * @route   POST /api/templates/import
 * @desc    Import a template from JSON
 * @access  Management, Admin
 */
router.post('/import', authenticateToken, importTemplate);

/**
 * @route   GET /api/templates
 * @desc    Get all templates (active only for non-management)
 * @access  Public (filtered by role)
 */
router.get('/', optionalAuth, getAllTemplates);

/**
 * @route   POST /api/templates
 * @desc    Create a new template
 * @access  Management, Admin
 */
router.post('/', authenticateToken, createTemplate);

/**
 * @route   GET /api/templates/:id
 * @desc    Get a specific template
 * @access  Public (active templates), Management (all)
 */
router.get('/:id', optionalAuth, getTemplateById);

/**
 * @route   PATCH /api/templates/:id
 * @desc    Update a template
 * @access  Management, Admin
 */
router.patch('/:id', authenticateToken, updateTemplate);

/**
 * @route   DELETE /api/templates/:id
 * @desc    Delete a template
 * @access  Management, Admin
 */
router.delete('/:id', authenticateToken, deleteTemplate);

/**
 * @route   PATCH /api/templates/:id/toggle
 * @desc    Toggle template active/inactive status
 * @access  Management, Admin
 */
router.patch('/:id/toggle', authenticateToken, toggleTemplateStatus);

/**
 * @route   POST /api/templates/:id/apply
 * @desc    Apply template and get processed content with placeholders replaced
 * @access  Private (authenticated users)
 */
router.post('/:id/apply', optionalAuth, applyTemplate);

/**
 * @route   POST /api/templates/:id/usage
 * @desc    Record template usage when a ticket is created
 * @access  Private (authenticated users)
 */
router.post('/:id/usage', authenticateToken, recordTemplateUsage);

/**
 * @route   GET /api/templates/:id/versions
 * @desc    Get template version history
 * @access  Management, Admin
 */
router.get('/:id/versions', authenticateToken, getTemplateVersions);

/**
 * @route   POST /api/templates/:id/restore/:version
 * @desc    Restore template to a previous version
 * @access  Management, Admin
 */
router.post('/:id/restore/:version', authenticateToken, restoreTemplateVersion);

/**
 * @route   GET /api/templates/:id/export
 * @desc    Export template as JSON
 * @access  Management, Admin
 */
router.get('/:id/export', authenticateToken, exportTemplate);

export default router;
