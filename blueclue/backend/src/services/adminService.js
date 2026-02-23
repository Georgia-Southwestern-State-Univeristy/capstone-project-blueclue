/**
 * Admin Service
 * Handles admin dashboard, email log management, allowlist/blocklist, and system settings
 * Part 6: Admin Management Features
 */

import pool from '../config/database.js';

/**
 * Get paginated email spam logs with filtering
 * @param {Object} options - Filter options
 * @param {number} options.page - Page number (1-indexed)
 * @param {number} options.limit - Results per page
 * @param {string} options.status - Filter by processing_status (success, failed, retried)
 * @param {boolean} options.isBlocked - Filter by is_blocked status
 * @param {boolean} options.isSpam - Filter by is_spam status
 * @param {string} options.senderEmail - Filter by sender email address
 * @param {string} options.startDate - Filter from date (ISO string)
 * @param {string} options.endDate - Filter to date (ISO string)
 * @returns {Promise<Object>} Paginated email logs with metadata
 */
export async function getEmailLogs(options = {}) {
  const {
    page = 1,
    limit = 50,
    status,
    isBlocked,
    isSpam,
    senderEmail,
    startDate,
    endDate
  } = options;

  const offset = (page - 1) * limit;
  const conditions = [];
  const values = [];
  let valueIndex = 1;

  // Build WHERE clauses dynamically
  if (status) {
    conditions.push(`processing_status = $${valueIndex++}`);
    values.push(status);
  }

  if (typeof isBlocked === 'boolean') {
    conditions.push(`is_blocked = $${valueIndex++}`);
    values.push(isBlocked);
  }

  if (typeof isSpam === 'boolean') {
    conditions.push(`is_spam = $${valueIndex++}`);
    values.push(isSpam);
  }

  if (senderEmail) {
    conditions.push(`sender_email ILIKE $${valueIndex++}`);
    values.push(`%${senderEmail}%`);
  }

  if (startDate) {
    conditions.push(`created_at >= $${valueIndex++}`);
    values.push(startDate);
  }

  if (endDate) {
    conditions.push(`created_at <= $${valueIndex++}`);
    values.push(endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countQuery = `SELECT COUNT(*) FROM email_spam_logs ${whereClause}`;
  const countResult = await pool.query(countQuery, values);
  const totalCount = parseInt(countResult.rows[0].count);

  // Get paginated results
  const dataQuery = `
    SELECT 
      id,
      sender_email,
      sender_domain,
      subject,
      LEFT(body_preview, 100) as body_preview,
      spam_score,
      is_spam,
      is_blocked,
      block_reason,
      processing_status,
      processing_error,
      ticket_id,
      content_filters_triggered,
      created_at,
      retry_count
    FROM email_spam_logs
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${valueIndex} OFFSET $${valueIndex + 1}
  `;

  values.push(limit, offset);
  const dataResult = await pool.query(dataQuery, values);

  return {
    logs: dataResult.rows,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      hasNextPage: page < Math.ceil(totalCount / limit),
      hasPreviousPage: page > 1
    }
  };
}

/**
 * Get full details of a specific email log
 * @param {number} logId - Email spam log ID
 * @returns {Promise<Object>} Full email log details including raw data
 */
export async function getEmailLogDetails(logId) {
  const query = `
    SELECT 
      esl.*,
      t.ticket_number,
      t.title as ticket_title,
      t.status as ticket_status,
      u.email as user_email,
      u.name as user_name
    FROM email_spam_logs esl
    LEFT JOIN tickets t ON esl.ticket_id = t.id
    LEFT JOIN users u ON t.customer_id = u.id
    WHERE esl.id = $1
  `;

  const result = await pool.query(query, [logId]);

  if (result.rows.length === 0) {
    throw new Error(`Email log with ID ${logId} not found`);
  }

  return result.rows[0];
}

/**
 * Retry creating ticket from a failed email parse
 * @param {number} logId - Email spam log ID to retry
 * @param {Object} overrides - Optional field overrides (category, priority)
 * @returns {Promise<Object>} Created ticket information
 */
export async function retryFailedParse(logId, overrides = {}) {
  // Get the email log
  const logQuery = 'SELECT * FROM email_spam_logs WHERE id = $1';
  const logResult = await pool.query(logQuery, [logId]);

  if (logResult.rows.length === 0) {
    throw new Error(`Email log with ID ${logId} not found`);
  }

  const emailLog = logResult.rows[0];

  // Check if it already has a ticket
  if (emailLog.ticket_id) {
    throw new Error(`Email log ${logId} already has ticket #${emailLog.ticket_id}`);
  }

  // Check if raw email data exists
  if (!emailLog.raw_email_data) {
    throw new Error('Raw email data not available for retry. Cannot recreate ticket.');
  }

  // Import the email processing service
  const { createTicketFromEmail } = await import('./inboundEmailService.js');

  // Prepare email data with overrides
  const emailData = {
    ...emailLog.raw_email_data,
    ...overrides // Allow admin to override category/priority
  };

  // Attempt to create ticket
  try {
    const result = await createTicketFromEmail(emailData);

    // Update email log with success
    await pool.query(`
      UPDATE email_spam_logs
      SET 
        ticket_id = $1,
        processing_status = 'retried',
        retry_count = retry_count + 1,
        last_retry_at = CURRENT_TIMESTAMP,
        processing_error = NULL
      WHERE id = $2
    `, [result.ticket_id, logId]);

    return {
      success: true,
      ticket_id: result.ticket_id,
      ticket_number: result.ticket_number,
      message: 'Ticket created successfully from failed parse'
    };
  } catch (error) {
    // Update retry count even on failure
    await pool.query(`
      UPDATE email_spam_logs
      SET 
        retry_count = retry_count + 1,
        last_retry_at = CURRENT_TIMESTAMP,
        processing_error = $1
      WHERE id = $2
    `, [error.message, logId]);

    throw error;
  }
}

/**
 * Get dashboard statistics
 * @param {number} days - Number of days to include (default 7)
 * @returns {Promise<Object>} Dashboard statistics
 */
export async function getDashboardStats(days = 7) {
  const query = `
    SELECT 
      COUNT(*) as total_emails,
      COUNT(*) FILTER (WHERE is_blocked = TRUE) as blocked_count,
      COUNT(*) FILTER (WHERE is_spam = TRUE) as spam_count,
      COUNT(*) FILTER (WHERE ticket_id IS NOT NULL) as tickets_created,
      COUNT(*) FILTER (WHERE processing_status = 'failed') as failed_parses,
      COUNT(*) FILTER (WHERE retry_count > 0) as retried_count,
      AVG(spam_score) as avg_spam_score,
      MAX(spam_score) as max_spam_score,
      COUNT(DISTINCT sender_email) as unique_senders,
      COUNT(DISTINCT sender_domain) as unique_domains
    FROM email_spam_logs
    WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
  `;

  const result = await pool.query(query);
  const stats = result.rows[0];

  // Get daily breakdown
  const dailyQuery = `
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_blocked = TRUE) as blocked,
      COUNT(*) FILTER (WHERE ticket_id IS NOT NULL) as tickets
    FROM email_spam_logs
    WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `;

  const dailyResult = await pool.query(dailyQuery);

  // Get top blocked senders
  const topBlockedQuery = `
    SELECT sender_email, COUNT(*) as block_count
    FROM email_spam_logs
    WHERE is_blocked = TRUE AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
    GROUP BY sender_email
    ORDER BY block_count DESC
    LIMIT 10
  `;

  const topBlockedResult = await pool.query(topBlockedQuery);

  return {
    summary: {
      ...stats,
      avg_spam_score: parseFloat(stats.avg_spam_score || 0).toFixed(2),
      success_rate: stats.total_emails > 0
        ? ((stats.tickets_created / stats.total_emails) * 100).toFixed(2)
        : '0.00'
    },
    daily: dailyResult.rows,
    topBlockedSenders: topBlockedResult.rows
  };
}

/**
 * Get all allowlisted domains
 * @param {boolean} activeOnly - Only return active domains
 * @returns {Promise<Array>} List of allowlisted domains
 */
export async function getAllowlist(activeOnly = true) {
  const query = `
    SELECT *
    FROM domain_allowlist
    ${activeOnly ? 'WHERE is_active = TRUE' : ''}
    ORDER BY created_at DESC
  `;

  const result = await pool.query(query);
  return result.rows;
}

/**
 * Add domain to allowlist
 * @param {string} domain - Domain to allowlist
 * @param {string} reason - Reason for allowlisting
 * @param {string} addedBy - Admin username/email
 * @returns {Promise<Object>} Created allowlist entry
 */
export async function addToAllowlist(domain, reason, addedBy) {
  // Normalize domain (lowercase, no www)
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');

  const query = `
    INSERT INTO domain_allowlist (domain, reason, added_by, is_active)
    VALUES ($1, $2, $3, TRUE)
    ON CONFLICT (domain) DO UPDATE
    SET is_active = TRUE,
        reason = $2,
        updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;

  const result = await pool.query(query, [normalizedDomain, reason, addedBy]);
  return result.rows[0];
}

/**
 * Remove domain from allowlist (soft delete - set inactive)
 * @param {string} domain - Domain to remove
 * @returns {Promise<boolean>} Success status
 */
export async function removeFromAllowlist(domain) {
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');

  const query = `
    UPDATE domain_allowlist
    SET is_active = FALSE,
        updated_at = CURRENT_TIMESTAMP
    WHERE domain = $1
    RETURNING *
  `;

  const result = await pool.query(query, [normalizedDomain]);
  return result.rows.length > 0;
}

/**
 * Check if a domain is allowlisted
 * @param {string} domain - Domain to check
 * @returns {Promise<boolean>} True if domain is allowlisted and active
 */
export async function isAllowlisted(domain) {
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');

  const query = `
    SELECT 1
    FROM domain_allowlist
    WHERE domain = $1 AND is_active = TRUE
  `;

  const result = await pool.query(query, [normalizedDomain]);
  return result.rows.length > 0;
}

/**
 * Increment allowlist hit count
 * @param {string} domain - Domain that was used
 * @returns {Promise<void>}
 */
export async function incrementAllowlistCount(domain) {
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');

  await pool.query('SELECT increment_allowlist_hit_count($1)', [normalizedDomain]);
}

/**
 * Get all system settings
 * @param {boolean} publicOnly - Only return public settings
 * @returns {Promise<Object>} Settings as key-value object
 */
export async function getSystemSettings(publicOnly = false) {
  const query = `
    SELECT setting_key, setting_value, setting_type, description
    FROM system_settings
    ${publicOnly ? 'WHERE is_public = TRUE' : ''}
    ORDER BY setting_key
  `;

  const result = await pool.query(query);

  // Convert to key-value object with typed values
  const settings = {};
  for (const row of result.rows) {
    let value = row.setting_value;

    // Type conversion
    if (row.setting_type === 'boolean') {
      value = value === 'true';
    } else if (row.setting_type === 'number') {
      value = parseFloat(value);
    } else if (row.setting_type === 'json') {
      try {
        value = JSON.parse(value);
      } catch (e) {
        console.error(`Failed to parse JSON setting ${row.setting_key}:`, e);
      }
    }

    settings[row.setting_key] = value;
  }

  return settings;
}

/**
 * Get a specific system setting
 * @param {string} key - Setting key
 * @returns {Promise<any>} Setting value (typed)
 */
export async function getSystemSetting(key) {
  const query = `
    SELECT setting_value, setting_type
    FROM system_settings
    WHERE setting_key = $1
  `;

  const result = await pool.query(query, [key]);

  if (result.rows.length === 0) {
    return null;
  }

  const { setting_value, setting_type } = result.rows[0];

  // Type conversion
  if (setting_type === 'boolean') {
    return setting_value === 'true';
  } else if (setting_type === 'number') {
    return parseFloat(setting_value);
  } else if (setting_type === 'json') {
    try {
      return JSON.parse(setting_value);
    } catch (e) {
      console.error(`Failed to parse JSON setting ${key}:`, e);
      return setting_value;
    }
  }

  return setting_value;
}

/**
 * Update a system setting
 * @param {string} key - Setting key
 * @param {any} value - New value
 * @param {string} updatedBy - Admin username/email
 * @returns {Promise<Object>} Updated setting
 */
export async function updateSystemSetting(key, value, updatedBy) {
  // Convert value to string based on type
  let stringValue = String(value);

  if (typeof value === 'object') {
    stringValue = JSON.stringify(value);
  }

  const query = `
    UPDATE system_settings
    SET 
      setting_value = $1,
      updated_by = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE setting_key = $3
    RETURNING *
  `;

  const result = await pool.query(query, [stringValue, updatedBy, key]);

  if (result.rows.length === 0) {
    throw new Error(`Setting '${key}' not found`);
  }

  return result.rows[0];
}

/**
 * Get security alerts (from Part 5 spam protection)
 * @param {number} limit - Number of alerts to return
 * @param {boolean} unresolvedOnly - Only return unresolved alerts
 * @returns {Promise<Array>} List of security alerts
 */
export async function getSecurityAlerts(limit = 50, unresolvedOnly = false) {
  const query = `
    SELECT *
    FROM security_alerts
    ${unresolvedOnly ? 'WHERE is_resolved = FALSE' : ''}
    ORDER BY created_at DESC
    LIMIT $1
  `;

  const result = await pool.query(query, [limit]);
  return result.rows;
}

/**
 * Mark security alert as resolved
 * @param {number} alertId - Alert ID
 * @param {string} resolvedBy - Admin username/email
 * @returns {Promise<Object>} Updated alert
 */
export async function resolveSecurityAlert(alertId, resolvedBy) {
  const query = `
    UPDATE security_alerts
    SET 
      is_resolved = TRUE,
      resolved_at = CURRENT_TIMESTAMP,
      resolved_by = $1
    WHERE id = $2
    RETURNING *
  `;

  const result = await pool.query(query, [resolvedBy, alertId]);

  if (result.rows.length === 0) {
    throw new Error(`Security alert ${alertId} not found`);
  }

  return result.rows[0];
}

export default {
  getEmailLogs,
  getEmailLogDetails,
  retryFailedParse,
  getDashboardStats,
  getAllowlist,
  addToAllowlist,
  removeFromAllowlist,
  isAllowlisted,
  incrementAllowlistCount,
  getSystemSettings,
  getSystemSetting,
  updateSystemSetting,
  getSecurityAlerts,
  resolveSecurityAlert
};
