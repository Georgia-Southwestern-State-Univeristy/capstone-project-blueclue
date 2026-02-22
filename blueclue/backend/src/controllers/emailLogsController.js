import pool from '../config/database.js';
import {
    sendVerificationEmail,
    sendWelcomeEmail,
    sendTicketConfirmation,
    sendTicketStatusUpdate,
    sendTicketAssignment,
    sendPasswordResetEmail
} from '../services/emailService.js';

/**
 * Get email logs with pagination and filtering
 * @route GET /api/admin/email-logs
 * @access Admin
 */
export const getEmailLogs = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            status,
            emailType,
            startDate,
            endDate,
            recipientEmail
        } = req.query;

        const offset = (page - 1) * limit;
        const params = [];
        let paramCount = 1;

        // Build WHERE clause based on filters
        let whereConditions = [];
        
        if (status) {
            whereConditions.push(`status = $${paramCount++}`);
            params.push(status);
        }
        
        if (emailType) {
            whereConditions.push(`email_type = $${paramCount++}`);
            params.push(emailType);
        }
        
        if (startDate) {
            whereConditions.push(`created_at >= $${paramCount++}`);
            params.push(startDate);
        }
        
        if (endDate) {
            whereConditions.push(`created_at <= $${paramCount++}`);
            params.push(endDate);
        }
        
        if (recipientEmail) {
            whereConditions.push(`recipient_email ILIKE $${paramCount++}`);
            params.push(`%${recipientEmail}%`);
        }

        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        // Get paginated logs
        const logsQuery = `
            SELECT 
                id,
                recipient_email,
                recipient_user_id,
                email_type,
                subject,
                status,
                message_id,
                error_message,
                retry_count,
                sent_at,
                created_at,
                metadata
            FROM email_logs
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramCount++} OFFSET $${paramCount}
        `;
        params.push(limit, offset);

        const logsResult = await pool.query(logsQuery, params);

        // Get total count for pagination
        const countQuery = `
            SELECT COUNT(*) as total
            FROM email_logs
            ${whereClause}
        `;
        const countResult = await pool.query(countQuery, params.slice(0, paramCount - 2));

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / limit);

        res.json({
            status: 'success',
            data: {
                logs: logsResult.rows,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    pageSize: parseInt(limit),
                    totalItems: total
                }
            }
        });

    } catch (error) {
        console.error('Error fetching email logs:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch email logs',
            error: error.message
        });
    }
};

/**
 * Get email statistics
 * @route GET /api/admin/email-stats
 * @access Admin
 */
export const getEmailStats = async (req, res) => {
    try {
        const { timeRange = '24h' } = req.query;
        
        // Determine interval based on time range
        const intervalMap = {
            '1h': '1 hour',
            '24h': '24 hours',
            '7d': '7 days',
            '30d': '30 days',
            '90d': '90 days'
        };
        const interval = intervalMap[timeRange] || '24 hours';

        // Get overall statistics
        const overallStats = await pool.query(`
            SELECT 
                COUNT(*) as total_emails,
                COUNT(*) FILTER (WHERE status = 'success') as successful,
                COUNT(*) FILTER (WHERE status = 'failed') as failed,
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                ROUND(
                    COUNT(*) FILTER (WHERE status = 'success')::numeric / 
                    NULLIF(COUNT(*) FILTER (WHERE status != 'pending'), 0) * 100,
                    2
                ) as success_rate,
                COUNT(DISTINCT email_type) as types_count
            FROM email_logs
            WHERE created_at >= NOW() - INTERVAL '${interval}'
        `);

        // Get statistics by email type
        const byType = await pool.query(`
            SELECT 
                email_type,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'success') as successful,
                COUNT(*) FILTER (WHERE status = 'failed') as failed,
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                ROUND(
                    COUNT(*) FILTER (WHERE status = 'success')::numeric / 
                    NULLIF(COUNT(*) FILTER (WHERE status != 'pending'), 0) * 100,
                    2
                ) as success_rate
            FROM email_logs
            WHERE created_at >= NOW() - INTERVAL '${interval}'
            GROUP BY email_type
            ORDER BY total DESC
        `);

        // Get recent failures with details
        const recentFailures = await pool.query(`
            SELECT 
                id,
                recipient_email,
                email_type,
                subject,
                error_message,
                retry_count,
                created_at
            FROM email_logs
            WHERE status = 'failed'
                AND created_at >= NOW() - INTERVAL '${interval}'
            ORDER BY created_at DESC
            LIMIT 10
        `);

        // Get hourly send volume for the last 24 hours
        const hourlyVolume = await pool.query(`
            SELECT 
                DATE_TRUNC('hour', created_at) as hour,
                COUNT(*) as count,
                COUNT(*) FILTER (WHERE status = 'success') as successful,
                COUNT(*) FILTER (WHERE status = 'failed') as failed
            FROM email_logs
            WHERE created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY hour
            ORDER BY hour DESC
        `);

        res.json({
            status: 'success',
            data: {
                timeRange,
                summary: overallStats.rows[0],
                byType: byType.rows,
                recentFailures: recentFailures.rows,
                hourlyVolume: hourlyVolume.rows
            }
        });

    } catch (error) {
        console.error('Error fetching email statistics:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch email statistics',
            error: error.message
        });
    }
};

/**
 * Get a specific email log by ID
 * @route GET /api/admin/email-logs/:id
 * @access Admin
 */
export const getEmailLogById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'SELECT * FROM email_logs WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Email log not found'
            });
        }

        res.json({
            status: 'success',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Error fetching email log:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch email log',
            error: error.message
        });
    }
};

/**
 * Delete old email logs (successful emails older than 90 days)
 * @route POST /api/admin/email-logs/cleanup
 * @access Admin
 */
export const cleanupOldLogs = async (req, res) => {
    try {
        const result = await pool.query('SELECT cleanup_old_email_logs()');
        const deletedCount = result.rows[0].cleanup_old_email_logs;

        res.json({
            status: 'success',
            message: `Successfully cleaned up ${deletedCount} old email logs`,
            data: {
                deletedCount
            }
        });

    } catch (error) {
        console.error('Error cleaning up email logs:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to cleanup email logs',
            error: error.message
        });
    }
};

/**
 * Get email delivery rate alert status
 * @route GET /api/admin/email-alerts
 * @access Admin
 */
export const getEmailAlerts = async (req, res) => {
    try {
        // Check failure rate in the last hour
        const hourlyCheck = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'failed') as failed,
                ROUND(
                    COUNT(*) FILTER (WHERE status = 'failed')::numeric / 
                    NULLIF(COUNT(*), 0) * 100,
                    2
                ) as failure_rate
            FROM email_logs
            WHERE created_at >= NOW() - INTERVAL '1 hour'
                AND status != 'pending'
        `);

        const stats = hourlyCheck.rows[0];
        const alerts = [];

        // Alert if failure rate > 20%
        if (stats.total > 0 && stats.failure_rate > 20) {
            alerts.push({
                severity: 'high',
                type: 'high_failure_rate',
                message: `Email failure rate is ${stats.failure_rate}% in the last hour`,
                details: {
                    total: stats.total,
                    failed: stats.failed,
                    failureRate: stats.failure_rate
                }
            });
        }

        // Alert if no emails sent in last hour (potential system issue)
        if (stats.total === 0) {
            alerts.push({
                severity: 'medium',
                type: 'no_emails_sent',
                message: 'No emails have been sent in the last hour',
                details: {
                    lastHourTotal: 0
                }
            });
        }

        // Check for pending emails stuck for more than 5 minutes
        const stuckPending = await pool.query(`
            SELECT COUNT(*) as stuck_count
            FROM email_logs
            WHERE status = 'pending'
                AND created_at < NOW() - INTERVAL '5 minutes'
        `);

        if (stuckPending.rows[0].stuck_count > 0) {
            alerts.push({
                severity: 'medium',
                type: 'stuck_pending_emails',
                message: `${stuckPending.rows[0].stuck_count} emails stuck in pending status`,
                details: {
                    count: stuckPending.rows[0].stuck_count
                }
            });
        }

        res.json({
            status: 'success',
            data: {
                hasAlerts: alerts.length > 0,
                alerts,
                lastChecked: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error checking email alerts:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to check email alerts',
            error: error.message
        });
    }
};

/**
 * Resend a failed email
 * @route POST /api/admin/email-resend/:id
 * @access Admin
 */
export const resendFailedEmail = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Fetch the email log
        const logResult = await pool.query(
            'SELECT * FROM email_logs WHERE id = $1',
            [id]
        );
        
        if (logResult.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Email log not found'
            });
        }
        
        const log = logResult.rows[0];
        
        // Check if email is actually failed or pending
        if (log.status === 'success') {
            return res.status(400).json({
                status: 'error',
                message: 'Cannot resend successful emails'
            });
        }
        
        // Reconstruct and resend based on email type
        let resendResult;
        
        switch(log.email_type) {
            case 'verification':
                if (!log.metadata?.verificationToken) {
                    throw new Error('Missing verification token in metadata');
                }
                // We need to fetch the user's name - use a default if not available
                resendResult = await sendVerificationEmail(
                    log.recipient_email,
                    'User', // Default name - ideally fetch from users table
                    log.metadata.verificationToken,
                    log.recipient_user_id
                );
                break;
                
            case 'welcome':
                resendResult = await sendWelcomeEmail(
                    log.recipient_email,
                    'User', // Default name
                    log.metadata?.verificationToken || null,
                    log.recipient_user_id
                );
                break;
                
            case 'ticket-created':
                if (!log.metadata?.ticket_id) {
                    throw new Error('Missing ticket_id in metadata');
                }
                // Fetch ticket details
                const ticketResult = await pool.query(
                    'SELECT * FROM tickets WHERE id = $1',
                    [log.metadata.ticket_id]
                );
                if (ticketResult.rows.length === 0) {
                    throw new Error('Ticket not found');
                }
                resendResult = await sendTicketConfirmation(
                    log.recipient_email,
                    ticketResult.rows[0],
                    log.recipient_user_id
                );
                break;
                
            case 'ticket-status-changed':
                if (!log.metadata?.ticket_id) {
                    throw new Error('Missing ticket_id in metadata');
                }
                // Fetch ticket details
                const ticketStatusResult = await pool.query(
                    'SELECT * FROM tickets WHERE id = $1',
                    [log.metadata.ticket_id]
                );
                if (ticketStatusResult.rows.length === 0) {
                    throw new Error('Ticket not found');
                }
                resendResult = await sendTicketStatusUpdate(
                    log.recipient_email,
                    ticketStatusResult.rows[0],
                    log.metadata.old_status || 'unknown',
                    log.metadata.new_status || ticketStatusResult.rows[0].status,
                    log.recipient_user_id
                );
                break;
                
            case 'ticket-assigned':
                if (!log.metadata?.ticket_id) {
                    throw new Error('Missing ticket_id in metadata');
                }
                // Fetch ticket and technician details
                const ticketAssignResult = await pool.query(
                    'SELECT t.*, u.first_name, u.last_name, c.first_name as customer_first, c.last_name as customer_last FROM tickets t JOIN users u ON t.assigned_to = u.id LEFT JOIN users c ON t.customer_id = c.id WHERE t.id = $1',
                    [log.metadata.ticket_id]
                );
                if (ticketAssignResult.rows.length === 0) {
                    throw new Error('Ticket not found');
                }
                const techName = log.metadata.assigned_to_name || `${ticketAssignResult.rows[0].first_name} ${ticketAssignResult.rows[0].last_name}`;
                const requesterName = `${ticketAssignResult.rows[0].customer_first} ${ticketAssignResult.rows[0].customer_last}`;
                resendResult = await sendTicketAssignment(
                    log.recipient_email,
                    techName,
                    ticketAssignResult.rows[0],
                    requesterName,
                    log.recipient_user_id
                );
                break;
                
            case 'password-reset':
                if (!log.metadata?.resetToken) {
                    throw new Error('Missing reset token in metadata');
                }
                resendResult = await sendPasswordResetEmail(
                    log.recipient_email,
                    'User', // Default name
                    log.metadata.resetToken,
                    log.recipient_user_id
                );
                break;
                
            default:
                return res.status(400).json({
                    status: 'error',
                    message: `Cannot resend email type: ${log.email_type}`
                });
        }
        
        res.json({
            status: 'success',
            message: 'Email resent successfully',
            data: {
                originalLogId: log.id,
                emailType: log.email_type,
                recipient: log.recipient_email,
                resentAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Error resending email:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to resend email',
            error: error.message
        });
    }
};

/**
 * Resend multiple failed emails in bulk
 * @route POST /api/admin/email-resend-bulk
 * @access Admin
 */
export const resendBulkFailedEmails = async (req, res) => {
    try {
        const {
            emailType,
            startDate,
            endDate,
            recipientEmail,
            maxEmails = 50
        } = req.body;

        const params = [];
        let paramCount = 1;

        // Build WHERE clause - only failed or pending emails
        let whereConditions = ["status IN ('failed', 'pending')"];
        
        if (emailType) {
            whereConditions.push(`email_type = $${paramCount++}`);
            params.push(emailType);
        }
        
        if (startDate) {
            whereConditions.push(`created_at >= $${paramCount++}`);
            params.push(startDate);
        }
        
        if (endDate) {
            whereConditions.push(`created_at <= $${paramCount++}`);
            params.push(endDate);
        }
        
        if (recipientEmail) {
            whereConditions.push(`recipient_email ILIKE $${paramCount++}`);
            params.push(`%${recipientEmail}%`);
        }

        const whereClause = whereConditions.length > 0
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        // Add LIMIT
        params.push(maxEmails);
        const limitClause = `LIMIT $${paramCount++}`;

        // Fetch failed/pending emails
        const logsResult = await pool.query(
            `SELECT id FROM email_logs 
             ${whereClause}
             ORDER BY created_at ASC
             ${limitClause}`,
            params
        );

        if (logsResult.rows.length === 0) {
            return res.json({
                status: 'success',
                message: 'No failed/pending emails found matching criteria',
                data: {
                    processed: 0,
                    successful: 0,
                    failed: 0,
                    results: []
                }
            });
        }

        // Resend each email
        const results = [];
        let successCount = 0;
        let failCount = 0;

        for (const row of logsResult.rows) {
            try {
                // Call resendFailedEmail logic for each
                const logDetailResult = await pool.query(
                    'SELECT * FROM email_logs WHERE id = $1',
                    [row.id]
                );
                
                if (logDetailResult.rows.length === 0) continue;
                
                const log = logDetailResult.rows[0];
                
                // Skip successful emails
                if (log.status === 'success') {
                    results.push({
                        id: log.id,
                        recipient: log.recipient_email,
                        status: 'skipped',
                        reason: 'Email already successful'
                    });
                    continue;
                }
                
                // Attempt resend (reuse logic from resendFailedEmail)
                await resendEmailByLog(log);
                
                successCount++;
                results.push({
                    id: log.id,
                    recipient: log.recipient_email,
                    emailType: log.email_type,
                    status: 'success',
                    resentAt: new Date().toISOString()
                });
                
            } catch (error) {
                failCount++;
                results.push({
                    id: row.id,
                    status: 'failed',
                    error: error.message
                });
            }
        }

        res.json({
            status: 'success',
            message: `Processed ${logsResult.rows.length} emails`,
            data: {
                processed: logsResult.rows.length,
                successful: successCount,
                failed: failCount,
                results
            }
        });

    } catch (error) {
        console.error('Error resending bulk emails:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to resend bulk emails',
            error: error.message
        });
    }
};

/**
 * Helper function to resend email based on log entry
 * @private
 */
async function resendEmailByLog(log) {
    switch(log.email_type) {
        case 'verification':
            if (!log.metadata?.verificationToken) {
                throw new Error('Missing verification token');
            }
            return await sendVerificationEmail(
                log.recipient_email,
                'User',
                log.metadata.verificationToken,
                log.recipient_user_id
            );
            
        case 'welcome':
            return await sendWelcomeEmail(
                log.recipient_email,
                'User',
                log.metadata?.verificationToken || null,
                log.recipient_user_id
            );
            
        case 'ticket-created':
            if (!log.metadata?.ticket_id) throw new Error('Missing ticket_id');
            const ticketResult = await pool.query('SELECT * FROM tickets WHERE id = $1', [log.metadata.ticket_id]);
            if (ticketResult.rows.length === 0) throw new Error('Ticket not found');
            return await sendTicketConfirmation(log.recipient_email, ticketResult.rows[0], log.recipient_user_id);
            
        case 'ticket-status-changed':
            if (!log.metadata?.ticket_id) throw new Error('Missing ticket_id');
            const ticketStatusResult = await pool.query('SELECT * FROM tickets WHERE id = $1', [log.metadata.ticket_id]);
            if (ticketStatusResult.rows.length === 0) throw new Error('Ticket not found');
            return await sendTicketStatusUpdate(
                log.recipient_email,
                ticketStatusResult.rows[0],
                log.metadata.old_status || 'unknown',
                log.metadata.new_status || ticketStatusResult.rows[0].status,
                log.recipient_user_id
            );
            
        case 'ticket-assigned':
            if (!log.metadata?.ticket_id) throw new Error('Missing ticket_id');
            const ticketAssignResult = await pool.query(
                'SELECT t.*, u.first_name, u.last_name, c.first_name as customer_first, c.last_name as customer_last FROM tickets t JOIN users u ON t.assigned_to = u.id LEFT JOIN users c ON t.customer_id = c.id WHERE t.id = $1',
                [log.metadata.ticket_id]
            );
            if (ticketAssignResult.rows.length === 0) throw new Error('Ticket not found');
            const techName = log.metadata.assigned_to_name || `${ticketAssignResult.rows[0].first_name} ${ticketAssignResult.rows[0].last_name}`;
            const requesterName = `${ticketAssignResult.rows[0].customer_first} ${ticketAssignResult.rows[0].customer_last}`;
            return await sendTicketAssignment(log.recipient_email, techName, ticketAssignResult.rows[0], requesterName, log.recipient_user_id);
            
        case 'password-reset':
            if (!log.metadata?.resetToken) throw new Error('Missing reset token');
            return await sendPasswordResetEmail(log.recipient_email, 'User', log.metadata.resetToken, log.recipient_user_id);
            
        default:
            throw new Error(`Unsupported email type: ${log.email_type}`);
    }
}
