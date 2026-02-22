// ============================================================================
// Audit Trail Routes
// ============================================================================
// Routes for querying privilege and category access audit logs

import express from 'express';
import authenticateToken from '../middleware/auth.js';
import * as auditController from '../controllers/auditController.js';

const router = express.Router();

// All audit routes require authentication
router.use(authenticateToken);

// ============================================================================
// Audit Log Routes (Admin/Management only)
// ============================================================================

// GET /api/audit/privileges - Get filtered audit log
router.get('/privileges', auditController.getPrivilegeAuditLog);

// GET /api/audit/privileges/user/:userId - Get audit log for specific user
router.get('/privileges/user/:userId', auditController.getUserAuditLog);

// GET /api/audit/privileges/recent - Get recent changes
router.get('/privileges/recent', auditController.getRecentAuditLog);

// GET /api/audit/privileges/summary - Get audit statistics
router.get('/privileges/summary', auditController.getAuditSummary);

export default router;
