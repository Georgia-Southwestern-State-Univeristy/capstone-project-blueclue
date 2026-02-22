// src/routes/config.js
import express from 'express';
import {
    getAllConfigurations,
    getConfiguration,
    updatePriorityWeights,
    resetConfiguration,
    getConfigurationHistory
} from '../controllers/configController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All config routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/config/ai
 * @desc    Get all AI configurations
 * @access  Management, Admin
 */
router.get('/ai', getAllConfigurations);

/**
 * @route   GET /api/config/ai/:key
 * @desc    Get specific configuration by key
 * @access  Management, Admin
 */
router.get('/ai/:key', getConfiguration);

/**
 * @route   PUT /api/config/ai/priority-weights
 * @desc    Update priority weights configuration
 * @access  Management, Admin
 */
router.put('/ai/priority-weights', updatePriorityWeights);

/**
 * @route   POST /api/config/ai/:key/reset
 * @desc    Reset configuration to defaults
 * @access  Management, Admin
 */
router.post('/ai/:key/reset', resetConfiguration);

/**
 * @route   GET /api/config/ai/:key/history
 * @desc    Get configuration change history
 * @access  Management, Admin
 */
router.get('/ai/:key/history', getConfigurationHistory);

export default router;
