// src/routes/widgets.js
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getAvailableWidgets,
  validateWidgets,
  validateLayout,
} from '../controllers/widgetController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/widgets/available
 * @desc    Get widgets available to the authenticated user
 * @query   category - Optional category filter (tickets, analytics, performance, management)
 * @access  Private (all authenticated users)
 */
router.get('/available', getAvailableWidgets);

/**
 * @route   POST /api/widgets/validate
 * @desc    Validate if user can access specific widgets
 * @body    { widgetKeys: string[] }
 * @access  Private (all authenticated users)
 */
router.post('/validate', validateWidgets);

/**
 * @route   POST /api/widgets/validate-layout
 * @desc    Validate a complete dashboard layout before saving
 * @body    { layoutData: object }
 * @access  Private (all authenticated users)
 */
router.post('/validate-layout', validateLayout);

export default router;
