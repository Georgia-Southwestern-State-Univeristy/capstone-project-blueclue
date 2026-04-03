// src/controllers/configController.js
import AIConfiguration from '../models/AIConfiguration.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../middleware/errorHandler.js';

/**
 * Authorization check - only management and admin can access
 */
const checkAuthorization = (req) => {
    if (!['management', 'admin'].includes(req.user?.role)) {
        throw new ForbiddenError('Insufficient permissions. Management or admin role required.');
    }
};

/**
 * Get all AI configurations
 * GET /api/config/ai
 */
export const getAllConfigurations = async (req, res) => {
        checkAuthorization(req);

        const configurations = await AIConfiguration.getAll();

        res.json({
            status: 'success',
            data: configurations
        });

};

/**
 * Get specific configuration
 * GET /api/config/ai/:key
 */
export const getConfiguration = async (req, res) => {
        checkAuthorization(req);

        const { key } = req.params;
        const config = await AIConfiguration.getByKey(key);

        if (!config) {
            throw new NotFoundError(`Configuration '${key}' not found`);
        }

        res.json({
            status: 'success',
            data: config
        });

};

/**
 * Update priority weights configuration
 * PUT /api/config/ai/priority-weights
 */
export const updatePriorityWeights = async (req, res) => {
        checkAuthorization(req);

        const {
            aiWeight,
            userWeight,
            highConfidenceThreshold,
            mediumConfidenceThreshold,
            enableAIPriority,
            showWarningOnOverride
        } = req.body;

        // Validation
        const errors = [];

        if (typeof aiWeight !== 'number' || aiWeight < 0 || aiWeight > 1) {
            errors.push('aiWeight must be a number between 0 and 1');
        }

        if (typeof userWeight !== 'number' || userWeight < 0 || userWeight > 1) {
            errors.push('userWeight must be a number between 0 and 1');
        }

        if (typeof highConfidenceThreshold !== 'number' || highConfidenceThreshold < 0 || highConfidenceThreshold > 1) {
            errors.push('highConfidenceThreshold must be a number between 0 and 1');
        }

        if (typeof mediumConfidenceThreshold !== 'number' || mediumConfidenceThreshold < 0 || mediumConfidenceThreshold > 1) {
            errors.push('mediumConfidenceThreshold must be a number between 0 and 1');
        }

        if (highConfidenceThreshold && mediumConfidenceThreshold && highConfidenceThreshold <= mediumConfidenceThreshold) {
            errors.push('highConfidenceThreshold must be greater than mediumConfidenceThreshold');
        }

        if (errors.length > 0) {
            throw new BadRequestError('Validation failed', errors);
        }

        // Update configuration
        const updatedConfig = await AIConfiguration.updatePriorityWeights({
            aiWeight,
            userWeight,
            highConfidenceThreshold,
            mediumConfidenceThreshold,
            enableAIPriority: enableAIPriority !== false, // Default to true
            showWarningOnOverride: showWarningOnOverride !== false // Default to true
        }, req.user.id);

        res.json({
            status: 'success',
            message: 'Priority weights configuration updated successfully',
            data: updatedConfig
        });

};

/**
 * Reset configuration to defaults
 * POST /api/config/ai/:key/reset
 */
export const resetConfiguration = async (req, res) => {
        checkAuthorization(req);

        const { key } = req.params;

        const defaults = {
            priority_weights: {
                aiWeight: 0.7,
                userWeight: 0.3,
                highConfidenceThreshold: 0.8,
                mediumConfidenceThreshold: 0.5,
                enableAIPriority: true,
                showWarningOnOverride: true
            },
            ai_analytics: {
                trackOverrides: true,
                trackAccuracy: true,
                minimumSampleSize: 50
            }
        };

        if (!defaults[key]) {
            throw new NotFoundError(`No default configuration available for '${key}'`);
        }

        const updatedConfig = await AIConfiguration.update(key, defaults[key], req.user.id);

        res.json({
            status: 'success',
            message: `Configuration '${key}' reset to defaults`,
            data: updatedConfig
        });

};

/**
 * Get configuration history
 * GET /api/config/ai/:key/history
 */
export const getConfigurationHistory = async (req, res) => {
        checkAuthorization(req);

        const { key } = req.params;
        const { limit = 50 } = req.query;

        const history = await AIConfiguration.getHistory(key, parseInt(limit));

        res.json({
            status: 'success',
            data: history
        });

};

export default {
    getAllConfigurations,
    getConfiguration,
    updatePriorityWeights,
    resetConfiguration,
    getConfigurationHistory
};
