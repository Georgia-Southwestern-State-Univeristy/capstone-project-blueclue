/**
 * Admin Controller
 * HTTP handlers for admin dashboard and email management
 * Part 6: Admin Management Features
 */

import * as adminService from '../services/adminService.js';
import pool from '../config/database.js';
import { 
    BadRequestError, 
    NotFoundError 
} from '../middleware/errorHandler.js';

/**
 * GET /api/admin/email-logs
 * Get paginated list of email logs with filtering
 */
export const getEmailLogs = async (req, res) => {
  const options = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 50,
    status: req.query.status,
    isBlocked: req.query.isBlocked === 'true' ? true : req.query.isBlocked === 'false' ? false : undefined,
    isSpam: req.query.isSpam === 'true' ? true : req.query.isSpam === 'false' ? false : undefined,
    senderEmail: req.query.senderEmail,
    startDate: req.query.startDate,
    endDate: req.query.endDate
  };

  const result = await adminService.getEmailLogs(options);

  res.json({
    status: 'success',
    data: result
  });
};

/**
 * GET /api/admin/email-logs/:id
 * Get full details of a specific email log
 */
export const getEmailLogDetails = async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    throw new BadRequestError('Invalid email log ID');
  }

  const emailLog = await adminService.getEmailLogDetails(parseInt(id));

  res.json({
    status: 'success',
    data: emailLog
  });
};

/**
 * POST /api/admin/email-logs/:id/retry
 * Retry creating ticket from a failed email parse
 */
export const retryFailedParse = async (req, res) => {
  const { id } = req.params;
  const overrides = req.body.overrides || {};

  if (!id || isNaN(id)) {
    throw new BadRequestError('Invalid email log ID');
  }

  const result = await adminService.retryFailedParse(parseInt(id), overrides);

  res.json({
    status: 'success',
    data: result,
    message: `Ticket #${result.ticket_number} created successfully from email log #${id}`
  });
};

/**
 * GET /api/admin/dashboard/stats
 * Get dashboard statistics
 */
export const getDashboardStats = async (req, res) => {
  const days = parseInt(req.query.days) || 7;

  const stats = await adminService.getDashboardStats(days);

  res.json({
    status: 'success',
    data: stats
  });
};

/**
 * GET /api/admin/allowlist
 * Get all allowlisted domains
 */
export const getAllowlist = async (req, res) => {
  const activeOnly = req.query.activeOnly !== 'false'; // Default true

  const allowlist = await adminService.getAllowlist(activeOnly);

  res.json({
    status: 'success',
    data: allowlist,
    count: allowlist.length
  });
};

/**
 * POST /api/admin/allowlist
 * Add domain to allowlist
 */
export const addToAllowlist = async (req, res) => {
  const { domain, reason } = req.body;
  const addedBy = req.user?.email || req.user?.username || 'admin'; // From auth middleware

  if (!domain) {
    throw new BadRequestError('Domain is required');
  }

  const entry = await adminService.addToAllowlist(domain, reason || 'Manually added', addedBy);

  res.status(201).json({
    status: 'success',
    data: entry,
    message: `Domain '${domain}' added to allowlist`
  });
};

/**
 * DELETE /api/admin/allowlist/:domain
 * Remove domain from allowlist
 */
export const removeFromAllowlist = async (req, res) => {
  const { domain } = req.params;

  if (!domain) {
    throw new BadRequestError('Domain is required');
  }

  const success = await adminService.removeFromAllowlist(domain);

  if (!success) {
    throw new NotFoundError(`Domain '${domain}' not found in allowlist`);
  }

  res.json({
    status: 'success',
    message: `Domain '${domain}' removed from allowlist`
  });
};

/**
 * GET /api/admin/settings
 * Get all system settings
 */
export const getSystemSettings = async (req, res) => {
  const publicOnly = req.query.public === 'true';

  const settings = await adminService.getSystemSettings(publicOnly);

  res.json({
    status: 'success',
    data: settings
  });
};

/**
 * PUT /api/admin/settings/:key
 * Update a specific system setting
 */
export const updateSystemSetting = async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  const updatedBy = req.user?.email || req.user?.username || 'admin';

  if (!key) {
    throw new BadRequestError('Setting key is required');
  }

  if (value === undefined) {
    throw new BadRequestError('Setting value is required');
  }

  const setting = await adminService.updateSystemSetting(key, value, updatedBy);

  res.json({
    status: 'success',
    data: setting,
    message: `Setting '${key}' updated successfully`
  });
};

/**
 * GET /api/admin/security-alerts
 * Get security alerts from spam protection
 */
export const getSecurityAlerts = async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const unresolvedOnly = req.query.unresolvedOnly === 'true';

  const alerts = await adminService.getSecurityAlerts(limit, unresolvedOnly);

  res.json({
    status: 'success',
    data: alerts,
    count: alerts.length
  });
};

/**
 * POST /api/admin/security-alerts/:id/resolve
 * Mark a security alert as resolved
 */
export const resolveSecurityAlert = async (req, res) => {
  const { id } = req.params;
  const resolvedBy = req.user?.email || req.user?.username || 'admin';

  if (!id || isNaN(id)) {
    throw new BadRequestError('Invalid alert ID');
  }

  const alert = await adminService.resolveSecurityAlert(parseInt(id), resolvedBy);

  res.json({
    status: 'success',
    data: alert,
    message: `Security alert #${id} resolved`
  });
};

export default {
  getEmailLogs,
  getEmailLogDetails,
  retryFailedParse,
  getDashboardStats,
  getAllowlist,
  addToAllowlist,
  removeFromAllowlist,
  getSystemSettings,
  updateSystemSetting,
  getSecurityAlerts,
  resolveSecurityAlert
};
