// ============================================================================
// Alert Rules Routes
// ============================================================================
// Routes for managing security alert rules
// Note: Admin authentication is already enforced by parent router (admin.js)

import express from 'express';
import {
    getAllAlertRules,
    getAlertRuleById,
    createAlertRule,
    updateAlertRule,
    deleteAlertRule,
    toggleAlertRule
} from '../controllers/alertRulesController.js';

const router = express.Router();

// GET /api/admin/alert-rules - Get all alert rules
router.get('/', getAllAlertRules);

// GET /api/admin/alert-rules/:id - Get a specific alert rule
router.get('/:id', getAlertRuleById);

// POST /api/admin/alert-rules - Create a new alert rule
router.post('/', createAlertRule);

// PATCH /api/admin/alert-rules/:id - Update an alert rule
router.patch('/:id', updateAlertRule);

// PATCH /api/admin/alert-rules/:id/toggle - Quick enable/disable toggle
router.patch('/:id/toggle', toggleAlertRule);

// DELETE /api/admin/alert-rules/:id - Delete an alert rule
router.delete('/:id', deleteAlertRule);

export default router;
