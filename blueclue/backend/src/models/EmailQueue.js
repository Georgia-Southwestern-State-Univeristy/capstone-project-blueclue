// ============================================================================
// EmailQueue Model
// ============================================================================
// Database operations for the email_queue table
// Handles queuing, dequeuing, status updates, and retry logic

import pool from '../config/database.js';

/**
 * Email queue statuses
 */
export const EMAIL_STATUS = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    DEAD_LETTER: 'dead_letter'
};

/**
 * Retry configuration
 */
const MAX_ATTEMPTS = 3;
const BACKOFF_DELAYS = [1000, 3000, 9000]; // 1s, 3s, 9s

class EmailQueue {
    /**
     * Add email to queue
     * @param {Object} emailData - Email details
     * @param {string} emailData.recipientEmail - Recipient email address
     * @param {number|null} emailData.recipientUserId - User ID if known
     * @param {string} emailData.subject - Email subject
     * @param {string} emailData.bodyHtml - HTML email body
     * @param {string|null} emailData.bodyText - Plain text fallback
     * @param {string} emailData.emailType - Email type (verification, welcome, etc.)
     * @param {string|null} emailData.templateName - Template used
     * @param {Object} emailData.metadata - Additional context
     * @param {string|null} emailData.idempotencyKey - Unique key to prevent duplicates
     * @returns {Promise<Object>} Created queue entry
     */
    static async enqueue(emailData) {
        const {
            recipientEmail,
            recipientUserId = null,
            subject,
            bodyHtml,
            bodyText = null,
            emailType,
            templateName = null,
            metadata = {},
            idempotencyKey = null
        } = emailData;

        // Validate required fields
        if (!recipientEmail || !subject || !bodyHtml || !emailType) {
            throw new Error('Missing required email fields: recipientEmail, subject, bodyHtml, emailType');
        }

        // Check for duplicate if idempotencyKey provided
        if (idempotencyKey) {
            const existing = await pool.query(
                'SELECT id, status FROM email_queue WHERE idempotency_key = $1',
                [idempotencyKey]
            );

            if (existing.rows.length > 0) {
                const existingEmail = existing.rows[0];
                // If already completed, return existing entry
                if (existingEmail.status === EMAIL_STATUS.COMPLETED) {
                    console.log(`✅ Email already sent (idempotency key: ${idempotencyKey})`);
                    return existingEmail;
                }
                // If pending/processing, return existing entry to avoid duplicate
                console.log(`⚠️  Email already queued (idempotency key: ${idempotencyKey})`);
                return existingEmail;
            }
        }

        // Insert into queue
        const result = await pool.query(
            `INSERT INTO email_queue (
                recipient_email, 
                recipient_user_id, 
                subject, 
                body_html, 
                body_text, 
                email_type,
                template_name,
                metadata,
                status,
                attempts,
                idempotency_key,
                next_retry_at,
                backoff_delay
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, CURRENT_TIMESTAMP, $11)
            RETURNING *`,
            [
                recipientEmail,
                recipientUserId,
                subject,
                bodyHtml,
                bodyText,
                emailType,
                templateName,
                JSON.stringify(metadata),
                EMAIL_STATUS.PENDING,
                idempotencyKey,
                BACKOFF_DELAYS[0] // Initial delay: 1s
            ]
        );

        console.log(`📬 Email queued: ${emailType} to ${recipientEmail} (ID: ${result.rows[0].id})`);
        return result.rows[0];
    }

    /**
     * Get next batch of emails ready for processing
     * @param {number} limit - Max number of emails to fetch
     * @returns {Promise<Array>} Array of email queue entries
     */
    static async getReadyForProcessing(limit = 10) {
        const result = await pool.query(
            `SELECT * FROM email_queue
             WHERE status IN ($1, $2)
             AND attempts < $3
             AND (next_retry_at IS NULL OR next_retry_at <= CURRENT_TIMESTAMP)
             ORDER BY created_at ASC
             LIMIT $4
             FOR UPDATE SKIP LOCKED`, // Prevent concurrent processing
            [EMAIL_STATUS.PENDING, EMAIL_STATUS.PROCESSING, MAX_ATTEMPTS, limit]
        );

        return result.rows;
    }

    /**
     * Mark email as processing
     * @param {number} id - Queue entry ID
     * @returns {Promise<Object>} Updated entry
     */
    static async markAsProcessing(id) {
        const result = await pool.query(
            `UPDATE email_queue 
             SET status = $1,
                 last_attempted_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [EMAIL_STATUS.PROCESSING, id]
        );

        return result.rows[0];
    }

    /**
     * Mark email as successfully sent
     * @param {number} id - Queue entry ID
     * @param {string} messageId - SMTP message ID
     * @returns {Promise<Object>} Updated entry
     */
    static async markAsCompleted(id, messageId) {
        const result = await pool.query(
            `UPDATE email_queue 
             SET status = $1,
                 message_id = $2,
                 completed_at = CURRENT_TIMESTAMP,
                 error_message = NULL,
                 error_stack = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [EMAIL_STATUS.COMPLETED, messageId, id]
        );

        console.log(`✅ Email sent successfully (Queue ID: ${id}, Message ID: ${messageId})`);
        return result.rows[0];
    }

    /**
     * Mark email as failed and schedule retry with exponential backoff
     * @param {number} id - Queue entry ID
     * @param {Error} error - Error object
     * @param {number} currentAttempts - Current attempt count
     * @returns {Promise<Object>} Updated entry
     */
    static async markAsFailed(id, error, currentAttempts) {
        const nextAttempts = currentAttempts + 1;
        
        // Determine if we should retry or mark as dead letter
        if (nextAttempts >= MAX_ATTEMPTS) {
            // Max retries exceeded - mark as dead letter
            const result = await pool.query(
                `UPDATE email_queue 
                 SET status = $1,
                     attempts = $2,
                     error_message = $3,
                     error_stack = $4,
                     last_attempted_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $5
                 RETURNING *`,
                [
                    EMAIL_STATUS.DEAD_LETTER,
                    nextAttempts,
                    error.message || 'Unknown error',
                    error.stack || null,
                    id
                ]
            );

            console.error(`❌ Email delivery failed permanently (Queue ID: ${id}, Attempts: ${nextAttempts})`);
            console.error(`   Error: ${error.message}`);
            
            return result.rows[0];
        }

        // Schedule retry with exponential backoff
        const backoffDelay = BACKOFF_DELAYS[nextAttempts - 1]; // -1 because we incremented attempts
        const nextRetryAt = new Date(Date.now() + backoffDelay);

        const result = await pool.query(
            `UPDATE email_queue 
             SET status = $1,
                 attempts = $2,
                 error_message = $3,
                 error_stack = $4,
                 last_attempted_at = CURRENT_TIMESTAMP,
                 next_retry_at = $5,
                 backoff_delay = $6,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $7
             RETURNING *`,
            [
                EMAIL_STATUS.PENDING, // Back to pending for retry
                nextAttempts,
                error.message || 'Unknown error',
                error.stack || null,
                nextRetryAt,
                backoffDelay,
                id
            ]
        );

        console.warn(`⚠️  Email send failed (Queue ID: ${id}, Attempt ${nextAttempts}/${MAX_ATTEMPTS})`);
        console.warn(`   Retry scheduled at: ${nextRetryAt.toISOString()} (delay: ${backoffDelay}ms)`);
        console.warn(`   Error: ${error.message}`);

        return result.rows[0];
    }

    /**
     * Get queue entry by ID
     * @param {number} id - Queue entry ID
     * @returns {Promise<Object|null>} Queue entry or null
     */
    static async getById(id) {
        const result = await pool.query(
            'SELECT * FROM email_queue WHERE id = $1',
            [id]
        );

        return result.rows[0] || null;
    }

    /**
     * Get queue entries by status
     * @param {string} status - Status to filter by
     * @param {number} limit - Max results
     * @returns {Promise<Array>} Array of queue entries
     */
    static async getByStatus(status, limit = 100) {
        const result = await pool.query(
            `SELECT * FROM email_queue 
             WHERE status = $1 
             ORDER BY created_at DESC 
             LIMIT $2`,
            [status, limit]
        );

        return result.rows;
    }

    /**
     * Get dead letter emails for manual investigation
     * @param {number} limit - Max results
     * @returns {Promise<Array>} Array of dead letter entries
     */
    static async getDeadLetters(limit = 50) {
        return this.getByStatus(EMAIL_STATUS.DEAD_LETTER, limit);
    }

    /**
     * Get queue statistics
     * @returns {Promise<Object>} Queue stats
     */
    static async getStats() {
        const result = await pool.query(
            `SELECT 
                status,
                COUNT(*) as count,
                MIN(created_at) as oldest,
                MAX(created_at) as newest
             FROM email_queue
             GROUP BY status`
        );

        const stats = {
            pending: 0,
            processing: 0,
            completed: 0,
            dead_letter: 0,
            total: 0
        };

        result.rows.forEach(row => {
            stats[row.status] = parseInt(row.count);
            stats.total += parseInt(row.count);
        });

        return stats;
    }

    /**
     * Clean up old completed emails (for archival/maintenance)
     * @param {number} daysOld - Delete emails older than this many days
     * @returns {Promise<number>} Number of deleted entries
     */
    static async cleanupCompleted(daysOld = 30) {
        const result = await pool.query(
            `DELETE FROM email_queue 
             WHERE status = $1 
             AND completed_at < CURRENT_TIMESTAMP - INTERVAL '${daysOld} days'
             RETURNING id`,
            [EMAIL_STATUS.COMPLETED]
        );

        const deletedCount = result.rows.length;
        if (deletedCount > 0) {
            console.log(`🗑️  Cleaned up ${deletedCount} completed emails older than ${daysOld} days`);
        }

        return deletedCount;
    }

    /**
     * Retry a dead letter email manually
     * @param {number} id - Queue entry ID
     * @returns {Promise<Object>} Updated entry
     */
    static async retryDeadLetter(id) {
        const result = await pool.query(
            `UPDATE email_queue 
             SET status = $1,
                 attempts = 0,
                 next_retry_at = CURRENT_TIMESTAMP,
                 backoff_delay = $2,
                 error_message = NULL,
                 error_stack = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3 AND status = $4
             RETURNING *`,
            [EMAIL_STATUS.PENDING, BACKOFF_DELAYS[0], id, EMAIL_STATUS.DEAD_LETTER]
        );

        if (result.rows.length === 0) {
            throw new Error(`Email ${id} not found or not in dead_letter status`);
        }

        console.log(`🔄 Dead letter email ${id} reset for retry`);
        return result.rows[0];
    }
}

export default EmailQueue;
