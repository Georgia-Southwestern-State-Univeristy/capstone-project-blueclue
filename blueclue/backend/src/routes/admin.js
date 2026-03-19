import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { checkRole } from '../middleware/rbac.js';
import {
    getEmailLogs,
    getEmailStats,
    getEmailLogById,
    cleanupOldLogs,
    getEmailAlerts,
    resendFailedEmail,
    resendBulkFailedEmails
} from '../controllers/emailLogsController.js';
import * as adminController from '../controllers/adminController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ==================== Audit Health (Management + Admin) ====================
/**
 * GET /api/admin/audit-health
 * Get audit logging health status (login attempts, privilege audit, ticket history)
 * Returns: { health: [...], overall_healthy: true/false }
 * Accessible to: management, admin
 */
router.get('/audit-health', checkRole('management', 'admin'), adminController.getAuditLogHealth);

// ==================== Technician Management (Management + Admin) ====================

/**
 * POST /api/admin/technicians
 * Create a new technician account
 * Body: { firstName, lastName, email, role }
 * Accessible to: management, admin
 */
router.post('/technicians', checkRole('management', 'admin'), adminController.createTechnician);

/**
 * GET /api/admin/technicians
 * Get list of all technicians/staff
 * Accessible to: management, admin
 */
router.get('/technicians', checkRole('management', 'admin'), adminController.getTechnicians);

// All remaining /api/admin routes require admin
router.use(checkRole('admin'));

// ==================== OUTBOUND Email Logs (Existing) ====================
// Email logs routes for confirmation/verification emails
router.get('/email-logs', getEmailLogs);
router.get('/email-logs/:id', getEmailLogById);
router.get('/email-stats', getEmailStats);
router.get('/email-alerts', getEmailAlerts);
router.post('/email-logs/cleanup', cleanupOldLogs);
router.post('/email-resend/:id', resendFailedEmail);
router.post('/email-resend-bulk', resendBulkFailedEmails);

// ==================== INBOUND Email Management (Part 6) ====================
// Email spam logs routes for inbound ticket emails

/**
 * GET /api/admin/inbound-logs
 * Get paginated list of inbound email spam logs
 * Query params: page, limit, status, isBlocked, isSpam, senderEmail, startDate, endDate
 */
router.get('/inbound-logs', adminController.getEmailLogs);

/**
 * GET /api/admin/inbound-logs/:id
 * Get full details of a specific inbound email log including raw data
 */
router.get('/inbound-logs/:id', adminController.getEmailLogDetails);

/**
 * POST /api/admin/inbound-logs/:id/retry
 * Retry creating ticket from a failed email parse
 * Body: { overrides: { category, priority } } (optional)
 */
router.post('/inbound-logs/:id/retry', adminController.retryFailedParse);

// ==================== Dashboard Statistics (Part 6) ====================

/**
 * GET /api/admin/dashboard/stats
 * Get dashboard statistics and metrics for inbound emails
 * Query params: days (default 7)
 */
router.get('/dashboard/stats', adminController.getDashboardStats);

// ==================== Domain Allowlist Management (Part 6) ====================

/**
 * GET /api/admin/allowlist
 * Get all allowlisted domains
 * Query params: activeOnly (default true)
 */
router.get('/allowlist', adminController.getAllowlist);

/**
 * POST /api/admin/allowlist
 * Add a domain to the allowlist
 * Body: { domain: string, reason: string (optional) }
 */
router.post('/allowlist', adminController.addToAllowlist);

/**
 * DELETE /api/admin/allowlist/:domain
 * Remove a domain from the allowlist (soft delete - sets inactive)
 */
router.delete('/allowlist/:domain', adminController.removeFromAllowlist);

// ==================== System Settings (Part 6) ====================

/**
 * GET /api/admin/settings
 * Get all system settings
 * Query params: public (default false)
 */
router.get('/settings', adminController.getSystemSettings);

/**
 * PUT /api/admin/settings/:key
 * Update a specific system setting
 * Body: { value: any }
 */
router.put('/settings/:key', adminController.updateSystemSetting);

// ==================== Security Alerts (Part 6) ====================

/**
 * GET /api/admin/security-alerts
 * Get security alerts from spam protection
 * Query params: limit (default 50), unresolvedOnly (default false)
 */
router.get('/security-alerts', adminController.getSecurityAlerts);

/**
 * POST /api/admin/security-alerts/:id/resolve
 * Mark a security alert as resolved
 */
router.post('/security-alerts/:id/resolve', adminController.resolveSecurityAlert);

// ==================== Alert Rules ====================

/**
 * Alert Rules Management
 * All alert rules routes are mounted at /api/admin/alert-rules
 */
import alertRulesRouter from './alertRules.js';
router.use('/alert-rules', alertRulesRouter);

export default router;
