// ============================================================================
// Email Service
// ============================================================================
// Handles all email sending with Nodemailer, templates, and retry logic

import nodemailer from 'nodemailer';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';
import EmailQueue from '../models/EmailQueue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

const EMAIL_CONFIG = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
};

const EMAIL_FROM = process.env.EMAIL_FROM || process.env.EMAIL_USER;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Email queue mode - set to true to use async queue processing
// Using a getter function to allow dynamic evaluation in tests
const getUseEmailQueue = () => process.env.USE_EMAIL_QUEUE === 'true' || process.env.NODE_ENV === 'production';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

// ============================================================================
// TRANSPORTER SETUP
// ============================================================================

let transporter = null;
let isConfigured = false;

/**
 * Initialize email transporter
 * Validates configuration on startup
 */
const initializeTransporter = () => {
    if (NODE_ENV === 'test') {
        console.log('📧 Email service: TEST MODE - Emails will be mocked');
        // Create transporter even in test mode so mocked nodemailer is used
        transporter = nodemailer.createTransport(EMAIL_CONFIG);
        isConfigured = true;
        return;
    }

    if (NODE_ENV === 'development' && !process.env.EMAIL_USER) {
        console.log('📧 Email service: DEV MODE - Emails will be logged to console');
        isConfigured = true;
        return;
    }

    // Validate required environment variables
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('⚠️  Email service: Missing EMAIL_USER or EMAIL_PASS - Email functionality disabled');
        isConfigured = false;
        return;
    }

    try {
        transporter = nodemailer.createTransport(EMAIL_CONFIG);
        isConfigured = true;
        console.log('✅ Email service configured successfully');

        // Verify connection
        transporter.verify((error, success) => {
            if (error) {
                console.error('❌ Email service verification failed:', error.message);
                isConfigured = false;
            } else {
                console.log('✅ Email service ready to send emails');
            }
        });
    } catch (error) {
        console.error('❌ Failed to initialize email service:', error.message);
        isConfigured = false;
    }
};

// Initialize on module load
initializeTransporter();

// ============================================================================
// EMAIL LOGGING
// ============================================================================

/**
 * Log email send attempt to database
 * @param {string} recipientEmail - Email address
 * @param {number|null} userId - User ID if registered user
 * @param {string} emailType - Type (verification, welcome, ticket-created, etc.)
 * @param {string} subject - Email subject
 * @param {string} status - success/failed/pending
 * @param {string|null} messageId - SMTP message ID
 * @param {string|null} errorMessage - Error if failed
 * @param {number} retryCount - Number of retry attempts
 * @param {object} metadata - Additional data (ticket_id, etc.)
 */
const logEmailAttempt = async (recipientEmail, userId, emailType, subject, status, messageId = null, errorMessage = null, retryCount = 0, metadata = {}) => {
    try {
        // Ensure status is always a string to avoid type inconsistency
        const statusValue = status || 'pending';
        
        await pool.query(
            `INSERT INTO email_logs (recipient_email, recipient_user_id, email_type, subject, status, message_id, error_message, retry_count, metadata, sent_at)
             VALUES ($1, $2, $3, $4, $5::text, $6, $7, $8, $9, CASE WHEN $5::text = 'success' THEN NOW() ELSE NULL END)`,
            [recipientEmail, userId, emailType, subject, statusValue, messageId, errorMessage, retryCount, JSON.stringify(metadata)]
        );
    } catch (error) {
        console.error('Failed to log email attempt:', error.message);
    }
};

// ============================================================================
// CORE SEND FUNCTIONS
// ============================================================================

/**
 * Send email with retry logic
 * @param {Object} mailOptions - Nodemailer mail options
 * @param {number} retryCount - Current retry attempt
 * @returns {Promise<Object>} Send result
 */
const sendEmailWithRetry = async (mailOptions, retryCount = 0) => {
    // Extract logging metadata from mailOptions
    const emailType = mailOptions.emailType || 'unknown';
    const userId = mailOptions.userId || null;
    const metadata = mailOptions.metadata || {};
    
    try {
        // Log as pending on first attempt
        if (retryCount === 0) {
            await logEmailAttempt(
                mailOptions.to,
                userId,
                emailType,
                mailOptions.subject,
                'pending',
                null,
                null,
                0,
                metadata
            );
        }
        
        // DEV MODE or NOT CONFIGURED: Log to console instead of sending
        if ((NODE_ENV === 'development' && !transporter) || !isConfigured || !transporter) {
            console.log('\n📧 ===== EMAIL (DEV MODE) =====');
            console.log('From:', mailOptions.from);
            console.log('To:', mailOptions.to);
            console.log('Subject:', mailOptions.subject);
            console.log('Text:', mailOptions.text);
            if (mailOptions.html) {
                console.log('HTML Length:', mailOptions.html.length, 'characters');
            }
            console.log('==============================\n');
            
            await logEmailAttempt(
                mailOptions.to,
                userId,
                emailType,
                mailOptions.subject,
                'success',
                'dev-mode-no-send',
                null,
                retryCount,
                metadata
            );
            
            return {
                success: true,
                messageId: 'dev-mode-no-send',
                mode: 'development'
            };
        }

        // PRODUCTION/TEST MODE: Actually send email (or use mocked transporter in tests)
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully:', info.messageId);
        
        // Log success
        await logEmailAttempt(
            mailOptions.to,
            userId,
            emailType,
            mailOptions.subject,
            'success',
            info.messageId,
            null,
            retryCount,
            metadata
        );
        
        return {
            success: true,
            messageId: info.messageId,
            mode: NODE_ENV === 'test' ? 'test' : 'production'
        };

    } catch (error) {
        console.error(`❌ Email send failed (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error.message);

        // Retry logic
        if (retryCount < MAX_RETRIES - 1) {
            const delay = RETRY_DELAY * (retryCount + 1); // Exponential backoff
            console.log(`🔄 Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return sendEmailWithRetry(mailOptions, retryCount + 1);
        }

        // All retries failed - log as failed
        await logEmailAttempt(
            mailOptions.to,
            userId,
            emailType,
            mailOptions.subject,
            'failed',
            null,
            error.message,
            retryCount,
            metadata
        );
        
        throw new Error(`Failed to send email after ${MAX_RETRIES} attempts: ${error.message}`);
    }
};

/**
 * Send email (main public function)
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 * @param {string} text - Plain text fallback
 * @param {string} emailType - Email type for logging (verification, welcome, etc.)
 * @param {number|null} userId - User ID for logging
 * @param {object} metadata - Additional metadata for logging
 * @returns {Promise<Object>} Send result or queue entry
 */
export const sendEmail = async (to, subject, html, text, emailType = 'unknown', userId = null, metadata = {}) => {
    if (!to || !subject || (!html && !text)) {
        throw new Error('Missing required email parameters: to, subject, and content are required');
    }

    // If queue mode is enabled, queue the email instead of sending immediately
    if (getUseEmailQueue()) {
        try {
            // Generate idempotency key if possible
            let idempotencyKey = null;
            if (metadata.ticket_id && emailType) {
                idempotencyKey = `${emailType}-${metadata.ticket_id}-${userId || 'guest'}-${Date.now()}`;
            }

            const queueEntry = await EmailQueue.enqueue({
                recipientEmail: to,
                recipientUserId: userId,
                subject,
                bodyHtml: html,
                bodyText: text,
                emailType,
                templateName: null,
                metadata,
                idempotencyKey
            });

            console.log(`📬 Email queued successfully (Queue ID: ${queueEntry.id})`);
            
            return {
                success: true,
                queued: true,
                queueId: queueEntry.id,
                mode: 'queue'
            };
        } catch (error) {
            console.error('❌ Failed to queue email:', error.message);
            // Fallback to direct send if queue fails
            console.warn('⚠️  Falling back to direct email send...');
            return sendEmailDirect(to, subject, html, text, emailType, userId, metadata);
        }
    }

    // Direct send mode (development or queue disabled)
    return sendEmailDirect(to, subject, html, text, emailType, userId, metadata);
};

/**
 * Send email directly without queue (used by CRON job and fallback)
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 * @param {string} text - Plain text fallback
 * @param {string} emailType - Email type for logging
 * @param {number|null} userId - User ID for logging
 * @param {object} metadata - Additional metadata for logging
 * @returns {Promise<Object>} Send result
 */
export const sendEmailDirect = async (to, subject, html, text, emailType = 'unknown', userId = null, metadata = {}) => {
    const mailOptions = {
        from: `"BlueClue Support" <${EMAIL_FROM}>`,
        to,
        subject,
        text: text || 'Please view this email in an HTML-compatible email client.',
        html: html || text,
        emailType,
        userId,
        metadata
    };

    return sendEmailWithRetry(mailOptions);
};

/**
 * Send templated email
 * @param {string} to - Recipient email
 * @param {string} templateName - Template file name (without .html)
 * @param {Object} data - Data to inject into template
 * @param {string} emailType - Email type for logging
 * @param {number|null} userId - User ID for logging
 * @param {object} metadata - Additional metadata for logging
 * @returns {Promise<Object>} Send result
 */
export const sendTemplateEmail = async (to, templateName, data, emailType = 'unknown', userId = null, metadata = {}) => {
    try {
        // Load HTML template
        const templatePath = join(__dirname, '../templates/emails', `${templateName}.html`);
        let htmlContent = await readFile(templatePath, 'utf-8');

        // Load text template (fallback)
        let textContent = '';
        try {
            const textPath = join(__dirname, '../templates/emails', `${templateName}.txt`);
            textContent = await readFile(textPath, 'utf-8');
        } catch (error) {
            // Text template is optional, use HTML stripped version as fallback
            textContent = htmlContent.replace(/<[^>]*>/g, '');
        }

        // Replace placeholders with data
        Object.keys(data).forEach(key => {
            const placeholder = new RegExp(`{{${key}}}`, 'g');
            htmlContent = htmlContent.replace(placeholder, data[key] || '');
            textContent = textContent.replace(placeholder, data[key] || '');
        });

        // Extract subject from data or use default
        const subject = data.subject || 'BlueClue Notification';

        return sendEmail(to, subject, htmlContent, textContent, emailType, userId, metadata);

    } catch (error) {
        console.error('❌ Template email error:', error.message);
        throw new Error(`Failed to send template email '${templateName}': ${error.message}`);
    }
};

// ============================================================================
// SPECIALIZED EMAIL FUNCTIONS
// ============================================================================

/**
 * Send welcome email to new user
 * @param {string} email - User email
 * @param {string} firstName - User first name
 * @param {string|null} verificationToken - Email verification token (null if already verified)
 * @param {number|null} userId - User ID for logging
 */
export const sendWelcomeEmail = async (email, firstName, verificationToken = null, userId = null) => {
    // If already verified, link to login page. Otherwise, verification link.
    const verificationLink = verificationToken 
        ? `${FRONTEND_URL}/verify-email/${verificationToken}`
        : `${FRONTEND_URL}/login`;
    
    return sendTemplateEmail(
        email,
        'welcome',
        {
            subject: 'Welcome to BlueClue Support Portal',
            firstName,
            verificationLink,
            frontendUrl: FRONTEND_URL
        },
        'welcome',
        userId,
        { verificationToken: verificationToken || 'already_verified' }
    );
};

/**
 * Send welcome email for accounts created via email submission
 * @param {string} email - User email
 * @param {string} firstName - User first name
 * @param {string} verificationToken - Email verification token
 * @param {number} ticketId - Ticket ID that triggered account creation
 * @param {number|null} userId - User ID for logging
 */
export const sendEmailCreatedWelcome = async (email, firstName, verificationToken, ticketId, userId = null) => {
    const verificationLink = `${FRONTEND_URL}/verify-email/${verificationToken}`;
    
    return sendTemplateEmail(
        email,
        'welcome-email-created',
        {
            subject: 'Your BlueClue Account is Ready - Verify Email',
            firstName,
            email,
            verificationLink,
            ticketId,
            frontendUrl: FRONTEND_URL
        },
        'welcome-email-created',
        userId,
        { verificationToken, ticket_id: ticketId }
    );
};

/**
 * Send email verification
 * @param {string} email - User email
 * @param {string} firstName - User first name
 * @param {string} verificationToken - Verification token
 * @param {number|null} userId - User ID for logging
 */
export const sendVerificationEmail = async (email, firstName, verificationToken, userId = null) => {
    const verificationLink = `${FRONTEND_URL}/verify-email/${verificationToken}`;
    
    return sendTemplateEmail(
        email,
        'verification',
        {
            subject: 'Verify Your Email Address - BlueClue',
            firstName,
            verificationLink,
            frontendUrl: FRONTEND_URL
        },
        'verification',
        userId,
        { verificationToken }
    );
};

/**
 * Send ticket submission confirmation
 * @param {string} email - Customer email
 * @param {Object} ticket - Ticket data
 * @param {number|null} userId - User ID for logging
 */
export const sendTicketConfirmation = async (email, ticket, userId = null) => {
    return sendTemplateEmail(
        email,
        'ticket-created',
        {
            subject: `Ticket #${ticket.id} Submitted - BlueClue Support`,
            ticketId: ticket.id,
            ticketSubject: ticket.subject,
            description: ticket.description || 'No description provided',
            priority: ticket.priority || 'medium',
            category: ticket.category || 'General',
            ticketUrl: `${FRONTEND_URL}/tickets/${ticket.id}`,
            frontendUrl: FRONTEND_URL
        },
        'ticket-created',
        userId,
        { ticket_id: ticket.id, priority: ticket.priority, category: ticket.category }
    );
};

/**
 * Send ticket status change notification
 * @param {string} email - Customer email
 * @param {Object} ticket - Ticket data
 * @param {string} oldStatus - Previous status
 * @param {string} newStatus - New status
 * @param {number|null} userId - User ID for logging
 */
export const sendTicketStatusUpdate = async (email, ticket, oldStatus, newStatus, userId = null) => {
    return sendTemplateEmail(
        email,
        'ticket-status-changed',
        {
            subject: `Ticket #${ticket.id} Status Update - BlueClue Support`,
            ticketId: ticket.id,
            ticketSubject: ticket.subject,
            oldStatus,
            newStatus,
            ticketUrl: `${FRONTEND_URL}/tickets/${ticket.id}`,
            frontendUrl: FRONTEND_URL
        },
        'ticket-status-changed',
        userId,
        { ticket_id: ticket.id, old_status: oldStatus, new_status: newStatus }
    );
};

/**
 * Send ticket assignment notification to technician
 * @param {string} email - Technician email
 * @param {string} technicianName - Technician name
 * @param {Object} ticket - Ticket data
 * @param {string} requesterName - Name of the person who created the ticket
 * @param {number|null} userId - User ID for logging
 */
export const sendTicketAssignment = async (email, technicianName, ticket, requesterName, userId = null) => {
    return sendTemplateEmail(
        email,
        'ticket-assigned',
        {
            subject: `Ticket #${ticket.id} Assigned to You - BlueClue Support`,
            technicianName,
            ticketId: ticket.id,
            subject: ticket.subject,
            description: ticket.description,
            priority: ticket.priority,
            category: ticket.category,
            status: ticket.status,
            requesterName,
            createdAt: new Date(ticket.created_at).toLocaleString(),
            dashboardUrl: `${FRONTEND_URL}/technician-dashboard`,
            frontendUrl: FRONTEND_URL
        },
        'ticket-assigned',
        userId,
        { ticket_id: ticket.id, assigned_to_name: technicianName, priority: ticket.priority }
    );
};

/**
 * Send password reset email
 * @param {string} email - User email
 * @param {string} firstName - User first name
 * @param {string} resetToken - Password reset token
 * @param {number|null} userId - User ID for logging
 */
export const sendPasswordResetEmail = async (email, firstName, resetToken, userId = null) => {
    const resetLink = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    return sendTemplateEmail(
        email,
        'password-reset',
        {
            subject: 'Password Reset Request - BlueClue',
            firstName,
            resetLink,
            frontendUrl: FRONTEND_URL
        },
        'password-reset',
        userId,
        { resetToken }
    );
};

/**
 * Send new comment notification to technician
 * @param {string} email - Technician email
 * @param {string} technicianName - Technician name
 * @param {string} commenterName - Name of person who commented
 * @param {Object} ticket - Ticket data
 * @param {string} commentContent - Comment text
 * @param {number|null} userId - User ID for logging
 */
export const sendCommentNotificationToTech = async (email, technicianName, commenterName, ticket, commentContent, userId = null) => {
    const ticketUrl = `${FRONTEND_URL}/tickets/${ticket.id}`;
    
    return sendTemplateEmail(
        email,
        'comment-new-for-tech',
        {
            subject: `New Comment on Ticket #${ticket.id} - BlueClue Support`,
            technicianName,
            commenterName,
            ticketId: ticket.id,
            ticketSubject: ticket.subject,
            commentContent: commentContent.substring(0, 500), // Limit to 500 chars in email
            ticketUrl,
            frontendUrl: FRONTEND_URL
        },
        'comment-new-tech',
        userId,
        { ticket_id: ticket.id, commenter_name: commenterName }
    );
};

/**
 * Send new comment notification to client
 * @param {string} email - Client email
 * @param {string} clientName - Client name
 * @param {string} technicianName - Technician name who commented
 * @param {Object} ticket - Ticket data
 * @param {string} commentContent - Comment text
 * @param {number|null} userId - User ID for logging
 */
export const sendCommentNotificationToClient = async (email, clientName, technicianName, ticket, commentContent, userId = null) => {
    const ticketUrl = `${FRONTEND_URL}/tickets/${ticket.id}`;
    
    return sendTemplateEmail(
        email,
        'comment-new-for-client',
        {
            subject: `New Response on Your Ticket #${ticket.id} - BlueClue Support`,
            clientName,
            technicianName,
            ticketId: ticket.id,
            ticketSubject: ticket.subject,
            commentContent: commentContent.substring(0, 500), // Limit to 500 chars in email
            ticketUrl,
            frontendUrl: FRONTEND_URL
        },
        'comment-new-client',
        userId,
        { ticket_id: ticket.id, technician_name: technicianName }
    );
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if email service is configured and ready
 * @returns {boolean}
 */
export const isEmailServiceReady = () => {
    return isConfigured;
};

/**
 * Send technician invitation email with set-password link
 * @param {string} email - Technician email
 * @param {string} firstName - Technician first name
 * @param {string} tempPassword - Temporary password for first login
 * @param {string} role - Assigned role (technician, senior_technician, management)
 * @param {number|null} userId - User ID for logging
 */
export const sendTechnicianInvitation = async (email, firstName, tempPassword, role, username, userId = null) => {
    const loginUrl = `${FRONTEND_URL}/login`;
    
    // Format role for display
    const roleDisplay = role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    return sendTemplateEmail(
        email,
        'technician-invitation',
        {
            subject: 'Welcome to BlueClue - Set Your Password',
            firstName,
            email,
            username,
            tempPassword,
            role: roleDisplay,
            loginUrl,
            frontendUrl: FRONTEND_URL
        },
        'technician-invitation',
        userId,
        { role }
    );
};

/**
 * Get email service status
 * @returns {Object} Status information
 */
export const getEmailServiceStatus = () => {
    return {
        configured: isConfigured,
        mode: NODE_ENV,
        host: EMAIL_CONFIG.host,
        port: EMAIL_CONFIG.port,
        from: EMAIL_FROM,
        hasCredentials: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
    };
};

/**
 * Reinitialize email service (useful after env changes)
 */
export const reinitializeEmailService = () => {
    transporter = null;
    initializeTransporter();
};

// ============================================================================
// EMAIL QUEUE PROCESSING
// ============================================================================

/**
 * Process a single queued email
 * @param {Object} queueEntry - Email queue entry from database
 * @returns {Promise<Object>} Result of send attempt
 */
export const processQueuedEmail = async (queueEntry) => {
    const { id, recipient_email, subject, body_html, body_text, email_type, recipient_user_id, metadata, attempts } = queueEntry;

    console.log(`📤 Processing queued email (ID: ${id}, Attempt: ${attempts + 1}/3)`);

    try {
        // Mark as processing
        await EmailQueue.markAsProcessing(id);

        // Send the email directly
        const result = await sendEmailDirect(
            recipient_email,
            subject,
            body_html,
            body_text,
            email_type,
            recipient_user_id,
            typeof metadata === 'string' ? JSON.parse(metadata) : metadata
        );

        // Mark as completed
        await EmailQueue.markAsCompleted(id, result.messageId);

        return {
            success: true,
            queueId: id,
            messageId: result.messageId
        };

    } catch (error) {
        console.error(`❌ Failed to process queued email (ID: ${id}):`, error.message);

        // Mark as failed (will schedule retry or dead letter)
        await EmailQueue.markAsFailed(id, error, attempts);

        return {
            success: false,
            queueId: id,
            error: error.message,
            willRetry: attempts + 1 < 3
        };
    }
};

/**
 * Process batch of queued emails
 * Called by CRON job
 * @param {number} batchSize - Max number of emails to process
 * @returns {Promise<Object>} Processing results
 */
export const processEmailQueue = async (batchSize = 10) => {
    console.log(`🔄 Processing email queue (batch size: ${batchSize})...`);

    try {
        // Get emails ready for processing
        const emails = await EmailQueue.getReadyForProcessing(batchSize);

        if (emails.length === 0) {
            console.log('   No emails in queue');
            return {
                success: true,
                processed: 0,
                succeeded: 0,
                failed: 0
            };
        }

        console.log(`   Found ${emails.length} email(s) to process`);

        // Process each email
        const results = await Promise.allSettled(
            emails.map(email => processQueuedEmail(email))
        );

        // Count successes and failures
        const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

        console.log(`✅ Email queue processing complete: ${succeeded} sent, ${failed} failed`);

        return {
            success: true,
            processed: emails.length,
            succeeded,
            failed
        };

    } catch (error) {
        console.error('❌ Email queue processing error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
};

export default {
    sendEmail,
    sendEmailDirect,
    sendTemplateEmail,
    sendWelcomeEmail,
    sendEmailCreatedWelcome,
    sendVerificationEmail,
    sendTicketConfirmation,
    sendTicketStatusUpdate,
    sendTicketAssignment,
    sendPasswordResetEmail,
    sendCommentNotificationToTech,
    sendCommentNotificationToClient,
    sendTechnicianInvitation,
    isEmailServiceReady,
    getEmailServiceStatus,
    reinitializeEmailService,
    processQueuedEmail,
    processEmailQueue
};
