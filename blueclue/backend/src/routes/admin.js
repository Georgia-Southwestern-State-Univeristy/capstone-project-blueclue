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

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(checkRole('admin'));

// Email logs routes
router.get('/email-logs', getEmailLogs);
router.get('/email-logs/:id', getEmailLogById);
router.get('/email-stats', getEmailStats);
router.get('/email-alerts', getEmailAlerts);
router.post('/email-logs/cleanup', cleanupOldLogs);
router.post('/email-resend/:id', resendFailedEmail);
router.post('/email-resend-bulk', resendBulkFailedEmails);

export default router;
