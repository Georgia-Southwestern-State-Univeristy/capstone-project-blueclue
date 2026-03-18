// ============================================================================
// Alert Detection Service
// ============================================================================
// Monitors for suspicious activity and triggers security alerts based on
// configurable rules

import pool from '../config/database.js';

/**
 * Check for repeated failed login attempts
 * Detects when a single user has multiple failed logins in a short time window
 */
async function checkFailedLoginAttempts() {
    try {
        // Get enabled failed_login rules
        const rulesResult = await pool.query(
            `SELECT id, parameters, severity 
             FROM alert_rules 
             WHERE rule_type = 'failed_login' AND is_enabled = TRUE`
        );

        for (const rule of rulesResult.rows) {
            const { threshold, window_minutes } = rule.parameters;
            
            // Find users with excessive failed logins in the time window
            const alertsResult = await pool.query(
                `SELECT 
                    user_id,
                    username,
                    email,
                    ip_address,
                    COUNT(*) as failed_count,
                    MAX(created_at) as last_attempt,
                    ARRAY_AGG(DISTINCT ip_address) as ip_addresses
                 FROM login_attempts
                 WHERE success = FALSE
                   AND created_at > NOW() - INTERVAL '${window_minutes} minutes'
                   AND user_id IS NOT NULL
                 GROUP BY user_id, username, email, ip_address
                 HAVING COUNT(*) >= $1`,
                [threshold]
            );

            // Create alerts for each user with excessive failures
            for (const alert of alertsResult.rows) {
                await createSecurityAlert({
                    alertType: 'repeated_failed_logins',
                    severity: rule.severity,
                    ruleId: rule.id,
                    affectedUserId: alert.user_id,
                    emailAddress: alert.email,
                    description: `User ${alert.username || alert.email} has ${alert.failed_count} failed login attempts in ${window_minutes} minutes`,
                    metadata: {
                        failed_count: alert.failed_count,
                        window_minutes,
                        last_attempt: alert.last_attempt,
                        ip_addresses: alert.ip_addresses
                    }
                });
            }
        }
    } catch (error) {
        console.error('❌ Error checking failed login attempts:', error);
    }
}

/**
 * Check for failed logins from a single IP address (possible brute force)
 */
async function checkFailedLoginsByIP() {
    try {
        const rulesResult = await pool.query(
            `SELECT id, parameters, severity 
             FROM alert_rules 
             WHERE rule_type = 'failed_login_ip' AND is_enabled = TRUE`
        );

        for (const rule of rulesResult.rows) {
            const { threshold, window_minutes } = rule.parameters;
            
            // Find IPs with excessive failed logins across ANY accounts
            const alertsResult = await pool.query(
                `SELECT 
                    ip_address,
                    COUNT(*) as failed_count,
                    COUNT(DISTINCT user_id) as unique_users_targeted,
                    ARRAY_AGG(DISTINCT username) FILTER (WHERE username IS NOT NULL) as usernames,
                    ARRAY_AGG(DISTINCT email) FILTER (WHERE email IS NOT NULL) as emails,
                    MAX(created_at) as last_attempt
                 FROM login_attempts
                 WHERE success = FALSE
                   AND created_at > NOW() - INTERVAL '${window_minutes} minutes'
                   AND ip_address IS NOT NULL
                 GROUP BY ip_address
                 HAVING COUNT(*) >= $1`,
                [threshold]
            );

            // Create alerts for suspicious IPs
            for (const alert of alertsResult.rows) {
                await createSecurityAlert({
                    alertType: 'excessive_failed_logins_single_ip',
                    severity: rule.severity,
                    ruleId: rule.id,
                    affectedUserId: null,
                    emailAddress: null,
                    description: `IP ${alert.ip_address} has ${alert.failed_count} failed login attempts across ${alert.unique_users_targeted} accounts in ${window_minutes} minutes`,
                    metadata: {
                        ip_address: alert.ip_address,
                        failed_count: alert.failed_count,
                        unique_users_targeted: alert.unique_users_targeted,
                        usernames: alert.usernames,
                        emails: alert.emails,
                        window_minutes,
                        last_attempt: alert.last_attempt
                    }
                });
            }
        }
    } catch (error) {
        console.error('❌ Error checking failed logins by IP:', error);
    }
}

/**
 * Check for admin/management logins from new IP addresses
 */
async function checkAdminNewIPLogins() {
    try {
        const rulesResult = await pool.query(
            `SELECT id, parameters, severity 
             FROM alert_rules 
             WHERE rule_type = 'new_ip_admin' AND is_enabled = TRUE`
        );

        for (const rule of rulesResult.rows) {
            const roles = rule.parameters.roles || ['admin', 'management'];
            
            // Find recent successful logins from new IPs for admin/management users
            const alertsResult = await pool.query(
                `SELECT 
                    la.user_id,
                    la.username,
                    la.email,
                    la.ip_address,
                    la.created_at,
                    u.role,
                    u.first_name,
                    u.last_name
                 FROM login_attempts la
                 JOIN users u ON la.user_id = u.id
                 WHERE la.success = TRUE
                   AND la.is_new_ip = TRUE
                   AND u.role = ANY($1)
                   AND la.created_at > NOW() - INTERVAL '5 minutes'`,
                [roles]
            );

            // Create alerts for each new IP login
            for (const alert of alertsResult.rows) {
                await createSecurityAlert({
                    alertType: 'admin_new_ip',
                    severity: rule.severity,
                    ruleId: rule.id,
                    affectedUserId: alert.user_id,
                    emailAddress: alert.email,
                    description: `${alert.role} user ${alert.first_name} ${alert.last_name} (${alert.username || alert.email}) logged in from new IP: ${alert.ip_address}`,
                    metadata: {
                        user_id: alert.user_id,
                        username: alert.username,
                        email: alert.email,
                        role: alert.role,
                        ip_address: alert.ip_address,
                        login_time: alert.created_at
                    }
                });
            }
        }
    } catch (error) {
        console.error('❌ Error checking admin new IP logins:', error);
    }
}

/**
 * Check for bulk record deletions
 */
async function checkBulkDeletions() {
    try {
        const rulesResult = await pool.query(
            `SELECT id, parameters, severity 
             FROM alert_rules 
             WHERE rule_type = 'bulk_delete' AND is_enabled = TRUE`
        );

        for (const rule of rulesResult.rows) {
            const { threshold, window_minutes, table } = rule.parameters;
            let tableName = table;
            let changeType = null;

            // Check ticket deletions
            if (tableName === 'tickets') {
                const result = await pool.query(
                    `SELECT 
                        changed_by,
                        u.username,
                        u.first_name,
                        u.last_name,
                        COUNT(*) as delete_count,
                        MAX(th.created_at) as last_deletion,
                        ARRAY_AGG(ticket_id) as ticket_ids
                     FROM ticket_history th
                     JOIN users u ON th.changed_by = u.id
                     WHERE th.change_type = 'ticket_deleted'
                       AND th.created_at > NOW() - INTERVAL '${window_minutes} minutes'
                     GROUP BY changed_by, u.username, u.first_name, u.last_name
                     HAVING COUNT(*) >= $1`,
                    [threshold]
                );

                for (const alert of result.rows) {
                    await createSecurityAlert({
                        alertType: 'bulk_ticket_deletion',
                        severity: rule.severity,
                        ruleId: rule.id,
                        affectedUserId: alert.changed_by,
                        emailAddress: null,
                        description: `User ${alert.first_name} ${alert.last_name} (${alert.username}) deleted ${alert.delete_count} tickets in ${window_minutes} minutes`,
                        metadata: {
                            user_id: alert.changed_by,
                            username: alert.username,
                            delete_count: alert.delete_count,
                            window_minutes,
                            last_deletion: alert.last_deletion,
                            ticket_ids: alert.ticket_ids.slice(0, 20) // Limit to first 20 for metadata
                        }
                    });
                }
            }

            // Check user deletions via privilege audit log
            if (tableName === 'users') {
                const result = await pool.query(
                    `SELECT 
                        changed_by,
                        u.username,
                        u.first_name,
                        u.last_name,
                        COUNT(*) as delete_count,
                        MAX(changed_at) as last_deletion,
                        ARRAY_AGG(user_id) as deleted_user_ids
                     FROM privilege_audit_log pal
                     LEFT JOIN users u ON pal.changed_by = u.id
                     WHERE pal.action = 'DELETE'
                       AND pal.table_name = 'user_privileges'
                       AND pal.changed_at > NOW() - INTERVAL '${window_minutes} minutes'
                     GROUP BY changed_by, u.username, u.first_name, u.last_name
                     HAVING COUNT(*) >= $1`,
                    [threshold]
                );

                for (const alert of result.rows) {
                    await createSecurityAlert({
                        alertType: 'bulk_user_deletion',
                        severity: rule.severity,
                        ruleId: rule.id,
                        affectedUserId: alert.changed_by,
                        emailAddress: null,
                        description: `User ${alert.first_name || ''} ${alert.last_name || ''} (${alert.username || 'System'}) deleted ${alert.delete_count} user privileges in ${window_minutes} minutes`,
                        metadata: {
                            user_id: alert.changed_by,
                            username: alert.username,
                            delete_count: alert.delete_count,
                            window_minutes,
                            last_deletion: alert.last_deletion,
                            deleted_user_ids: alert.deleted_user_ids.slice(0, 20)
                        }
                    });
                }
            }
        }
    } catch (error) {
        console.error('❌ Error checking bulk deletions:', error);
    }
}

/**
 * Create a security alert (avoiding duplicates)
 * @param {Object} params - Alert parameters
 */
async function createSecurityAlert({ alertType, severity, ruleId, affectedUserId, emailAddress, description, metadata }) {
    try {
        // Check if a similar unresolved alert already exists (within last hour)
        const existingAlert = await pool.query(
            `SELECT id FROM security_alerts
             WHERE alert_type = $1
               AND is_resolved = FALSE
               AND created_at > NOW() - INTERVAL '1 hour'
               AND (
                   (affected_user_id = $2 AND affected_user_id IS NOT NULL)
                   OR (email_address = $3 AND email_address IS NOT NULL)
                   OR (metadata->>'ip_address' = $4 AND $4 IS NOT NULL)
               )
             LIMIT 1`,
            [alertType, affectedUserId, emailAddress, metadata?.ip_address || null]
        );

        // Don't create duplicate alerts
        if (existingAlert.rows.length > 0) {
            console.log(`⏭️  Skipping duplicate alert: ${alertType}`);
            return null;
        }

        // Create the alert
        const result = await pool.query(
            `INSERT INTO security_alerts 
             (alert_type, severity, rule_id, affected_user_id, email_address, description, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [alertType, severity, ruleId, affectedUserId, emailAddress, description, JSON.stringify(metadata)]
        );

        console.log(`🚨 Security alert created: ${alertType} (${severity}) - ${description}`);
        return result.rows[0].id;
    } catch (error) {
        console.error('❌ Error creating security alert:', error);
        return null;
    }
}

/**
 * Run all alert detection checks
 */
export async function runAlertDetection() {
    console.log('🔍 Running alert detection checks...');
    
    try {
        await Promise.all([
            checkFailedLoginAttempts(),
            checkFailedLoginsByIP(),
            checkAdminNewIPLogins(),
            checkBulkDeletions()
        ]);
        
        console.log('✅ Alert detection checks completed');
    } catch (error) {
        console.error('❌ Error running alert detection:', error);
    }
}

/**
 * Update audit log health status
 */
export async function updateAuditLogHealth() {
    try {
        await pool.query('SELECT update_audit_log_health()');
        console.log('✅ Audit log health status updated');
    } catch (error) {
        console.error('❌ Error updating audit log health:', error);
    }
}

/**
 * Get the latest audit log health status
 */
export async function getAuditLogHealth() {
    try {
        const result = await pool.query(
            `SELECT * FROM audit_log_health ORDER BY last_check_at DESC`
        );
        return result.rows;
    } catch (error) {
        console.error('❌ Error getting audit log health:', error);
        return [];
    }
}

export default {
    runAlertDetection,
    updateAuditLogHealth,
    getAuditLogHealth
};
