// ============================================================================
// Inbound Email Service
// ============================================================================
// Handles parsing of incoming emails and creation of support tickets

import pool from '../config/database.js';
import { classifyTicketWithFallback } from './aiService.js';
import Ticket from '../models/Ticket.js';
import AIClassification from '../models/AIClassification.js';
import { sendTicketConfirmation, sendEmailCreatedWelcome, sendVerificationEmail } from './emailService.js';
import crypto from 'crypto';
import { 
    checkSpamProtection, 
    incrementRateLimit, 
    createVerificationChallenge 
} from './spamProtectionService.js';

// ============================================================================
// EMAIL PARSING
// ============================================================================

/**
 * Extract plain text from HTML email body
 * Removes HTML tags and decodes common entities
 */
const htmlToPlainText = (html) => {
    if (!html) return '';
    
    return html
        // Remove script and style tags with content
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        // Replace line breaks with newlines
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        // Remove all other HTML tags
        .replace(/<[^>]+>/g, '')
        // Decode common HTML entities
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        // Clean up whitespace
        .replace(/\n\s*\n\s*\n/g, '\n\n') // Max 2 consecutive newlines
        .trim();
};

/**
 * Extract email subject and body from parsed email data
 * Handles both plain text and HTML emails
 */
const extractEmailContent = (emailData) => {
    const subject = emailData.subject || emailData.Subject || 'No Subject';
    
    // Try plain text first, then fall back to HTML
    let body = emailData['body-plain'] || 
               emailData['stripped-text'] || 
               emailData.text || 
               emailData['body-html'] || 
               emailData.html || 
               '';

    // If we got HTML, convert to plain text
    if (!emailData['body-plain'] && !emailData.text && body) {
        body = htmlToPlainText(body);
    }

    // Remove email signatures and quoted replies (common patterns)
    body = removeEmailSignatureAndQuotes(body);

    return {
        subject: subject.trim(),
        body: body.trim() || 'No content provided'
    };
};

/**
 * Remove common email signatures and quoted reply text
 */
const removeEmailSignatureAndQuotes = (text) => {
    if (!text) return '';

    // Split into lines
    let lines = text.split('\n');
    let cleanedLines = [];
    let hitSignature = false;

    for (let line of lines) {
        const trimmedLine = line.trim();
        
        // Check for common signature markers
        if (trimmedLine === '--' || 
            trimmedLine === '---' || 
            trimmedLine.toLowerCase().startsWith('sent from my') ||
            trimmedLine.toLowerCase().startsWith('get outlook for')) {
            hitSignature = true;
            break;
        }

        // Check for quoted reply markers (Gmail, Outlook, etc.)
        if (trimmedLine.startsWith('>') || 
            trimmedLine.startsWith('On ') && trimmedLine.includes('wrote:')) {
            break;
        }

        cleanedLines.push(line);
    }

    return cleanedLines.join('\n').trim();
};

/**
 * Extract sender name from email address or name field
 */
const extractSenderName = (emailData) => {
    // Try from field first (may contain name)
    const from = emailData.from || emailData.From || '';
    
    // Extract name from "Name <email@example.com>" format
    const nameMatch = from.match(/^([^<]+)</);
    if (nameMatch) {
        return nameMatch[1].trim();
    }

    // Extract from email local part (before @)
    const emailMatch = from.match(/([^@]+)@/);
    if (emailMatch) {
        return emailMatch[1].trim();
    }

    return 'Unknown Sender';
};

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * Find or create user based on email address
 * Returns user ID for ticket assignment
 * Handles verification for email-created accounts
 */
const findOrCreateUser = async (email, senderName, ticketId = null) => {
    try {
        // Check if user exists by email
        const existingUser = await pool.query(
            'SELECT id, email_verified, first_name, email_created FROM users WHERE LOWER(email) = LOWER($1)',
            [email]
        );

        if (existingUser.rows.length > 0) {
            const user = existingUser.rows[0];
            
            // User exists and is verified - normal flow
            if (user.email_verified) {
                console.log(`📧 Using existing verified user: ${email}`);
                return {
                    userId: user.id,
                    isNewUser: false,
                    emailVerified: true,
                    sentWelcomeEmail: false
                };
            }
            
            // User exists but unverified - send verification reminder
            console.log(`⚠️  User exists but unverified: ${email} - Sending verification reminder`);
            
            // Generate new verification token
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
            
            await pool.query(
                'UPDATE users SET email_verification_token = $1, email_verification_expires = $2 WHERE id = $3',
                [verificationToken, tokenExpiry, user.id]
            );
            
            // Send verification reminder
            try {
                await sendVerificationEmail(email, user.first_name, verificationToken, user.id);
                console.log(`📧 Verification reminder sent to ${email}`);
            } catch (emailError) {
                console.error('Failed to send verification reminder:', emailError.message);
            }
            
            return {
                userId: user.id,
                isNewUser: false,
                emailVerified: false,
                sentWelcomeEmail: false,
                sentVerificationReminder: true
            };
        }

        // User doesn't exist - create as email-created guest user
        console.log(`📧 Creating new email-created user: ${email}`);
        
        // Parse name (basic split on whitespace)
        const nameParts = senderName.split(/\s+/);
        const firstName = nameParts[0] || 'Guest';
        const lastName = nameParts.slice(1).join(' ') || 'User';

        // Generate temporary password (user will set real password after verification)
        const tempPassword = crypto.randomBytes(32).toString('hex');
        const bcrypt = await import('bcrypt');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Create guest user with email_created flag
        const newUser = await pool.query(
            `INSERT INTO users (
                email, 
                password_hash, 
                first_name, 
                last_name, 
                role, 
                email_verified,
                email_created,
                email_verification_token,
                email_verification_expires,
                email_notifications,
                force_password_change
            ) VALUES ($1, $2, $3, $4, 'customer', false, true, $5, $6, true, true)
            RETURNING id`,
            [email, hashedPassword, firstName, lastName, verificationToken, tokenExpiry]
        );

        const userId = newUser.rows[0].id;
        console.log(`✅ Created new email-created user #${userId}: ${email}`);

        // Send welcome email with account details and verification link
        try {
            await sendEmailCreatedWelcome(email, firstName, verificationToken, ticketId || '(processing)', userId);
            console.log(`📧 Welcome email sent to ${email}`);
        } catch (emailError) {
            console.error('Failed to send welcome email:', emailError.message);
            // Don't throw - user is created, email failure shouldn't block ticket creation
        }

        return {
            userId: userId,
            isNewUser: true,
            emailVerified: false,
            sentWelcomeEmail: true,
            verificationToken: verificationToken
        };

    } catch (error) {
        console.error('Error in findOrCreateUser:', error);
        throw error;
    }
};

// ============================================================================
// PRIORITY & THREAD DETECTION
// ============================================================================

/**
 * Detect priority from email content using keywords
 * Overrides AI classification if urgent keywords found
 */
const detectPriorityFromKeywords = (subject, body) => {
    const text = `${subject} ${body}`.toLowerCase();
    
    // High priority keywords
    const urgentKeywords = [
        'urgent', 'emergency', 'critical', 'asap', 'immediately',
        'down', 'outage', 'not working', 'broken', 'can\'t access',
        'cannot access', 'unable to', 'help needed', '!!!', 'urgent:'
    ];
    
    // Check for urgent keywords
    const hasUrgentKeyword = urgentKeywords.some(keyword => text.includes(keyword));
    
    if (hasUrgentKeyword) {
        console.log('🚨 HIGH priority detected from keywords');
        return 'high';
    }
    
    // Medium priority keywords
    const mediumKeywords = [
        'issue', 'problem', 'error', 'help', 'support', 'question'
    ];
    
    const hasMediumKeyword = mediumKeywords.some(keyword => text.includes(keyword));
    
    if (hasMediumKeyword) {
        return 'medium';
    }
    
    // Default to low if no priority indicators
    return 'low';
};

/**
 * Extract email thread ID for tracking conversations
 * Checks In-Reply-To and References headers
 */
const extractThreadId = (emailData) => {
    // Check for In-Reply-To header (direct reply)
    const inReplyTo = emailData['In-Reply-To'] || 
                      emailData['in-reply-to'] ||
                      emailData.inReplyTo;
    
    if (inReplyTo) {
        console.log(`📧 Email is reply to: ${inReplyTo}`);
        return inReplyTo;
    }
    
    // Check References header (thread chain)
    const references = emailData.References || 
                       emailData.references;
    
    if (references) {
        // References contains space-separated message IDs
        const messageIds = references.trim().split(/\s+/);
        if (messageIds.length > 0) {
            const originalId = messageIds[0]; // First message in thread
            console.log(`📧 Email thread reference: ${originalId}`);
            return originalId;
        }
    }
    
    return null;
};

/**
 * Extract attachment metadata from email
 * Note: Actual file handling would require additional storage setup
 */
const extractAttachmentInfo = (emailData) => {
    try {
        // Mailgun provides attachment count
        const attachmentCount = parseInt(emailData['attachment-count'] || emailData.attachments || 0);
        
        if (attachmentCount === 0) {
            return {
                hasAttachments: false,
                count: 0,
                attachments: []
            };
        }
        
        console.log(`📎 Email has ${attachmentCount} attachment(s)`);
        
        // Parse attachment data if provided
        const attachments = [];
        
        // Mailgun provides attachment info in specific fields
        for (let i = 1; i <= attachmentCount; i++) {
            const attachment = {
                name: emailData[`attachment-${i}`] || `attachment-${i}`,
                contentType: emailData[`content-type-${i}`] || 'application/octet-stream',
                size: parseInt(emailData[`size-${i}`] || 0),
                url: emailData[`url-${i}`] || null // Mailgun provides temporary URLs
            };
            attachments.push(attachment);
        }
        
        return {
            hasAttachments: true,
            count: attachmentCount,
            attachments: attachments
        };
        
    } catch (error) {
        console.warn('⚠️  Failed to parse attachment info:', error.message);
        return {
            hasAttachments: false,
            count: 0,
            attachments: []
        };
    }
};

// ============================================================================
// REPLY-TO-UPDATE HANDLING (Part 4)
// ============================================================================

/**
 * Check if email is a reply to an existing email thread
 * @param {Object} emailData - Raw email data from Mailgun
 * @returns {boolean} True if this is a reply email
 */
const isReplyEmail = (emailData) => {
    return !!(emailData['In-Reply-To'] || emailData['in-reply-to'] || 
              emailData['References'] || emailData['references']);
};

/**
 * Find ticket by email thread ID
 * @param {string} threadId - Thread ID from In-Reply-To or References header
 * @returns {Object|null} Ticket object or null if not found
 */
const findTicketByThreadId = async (threadId) => {
    if (!threadId) return null;
    
    try {
        const result = await pool.query(
            'SELECT * FROM tickets WHERE email_message_id = $1 LIMIT 1',
            [threadId]
        );
        
        if (result.rows.length > 0) {
            console.log(`✅ Found ticket #${result.rows[0].id} for thread ID: ${threadId}`);
            return result.rows[0];
        }
        
        console.log(`⚠️  No ticket found for thread ID: ${threadId}`);
        return null;
    } catch (error) {
        console.error('❌ Error finding ticket by thread ID:', error);
        return null;
    }
};

/**
 * Verify that sender is authorized to update the ticket
 * @param {number} ticketId - Ticket ID
 * @param {string} senderEmail - Email address of the person replying
 * @returns {Object} { authorized: boolean, userId: number|null, reason: string }
 */
const verifyReplyAuthorization = async (ticketId, senderEmail) => {
    try {
        // Find user by email (case-insensitive)
        const userResult = await pool.query(
            'SELECT u.id, u.email, t.customer_id FROM users u ' +
            'INNER JOIN tickets t ON t.customer_id = u.id ' +
            'WHERE LOWER(u.email) = LOWER($1) AND t.id = $2',
            [senderEmail, ticketId]
        );
        
        if (userResult.rows.length === 0) {
            return {
                authorized: false,
                userId: null,
                reason: 'You are not the owner of this ticket'
            };
        }
        
        return {
            authorized: true,
            userId: userResult.rows[0].id,
            reason: 'Authorized'
        };
    } catch (error) {
        console.error('❌ Error verifying reply authorization:', error);
        return {
            authorized: false,
            userId: null,
            reason: 'Authorization check failed'
        };
    }
};

/**
 * Add email reply as comment on ticket
 * @param {number} ticketId - Ticket ID
 * @param {number} userId - User ID of commenter
 * @param {string} commentText - Comment content
 * @returns {Object} Created comment object
 */
const addReplyAsComment = async (ticketId, userId, commentText) => {
    try {
        const result = await pool.query(
            `INSERT INTO ticket_comments 
            (ticket_id, user_id, user_type, content, is_internal) 
            VALUES ($1, $2, 'client', $3, false) 
            RETURNING *`,
            [ticketId, userId, commentText]
        );
        
        console.log(`✅ Added comment #${result.rows[0].id} to ticket #${ticketId}`);
        return result.rows[0];
    } catch (error) {
        console.error('❌ Error adding reply as comment:', error);
        throw error;
    }
};

/**
 * Notify assigned technician of new comment via email
 * @param {number} ticketId - Ticket ID
 * @param {string} commenterName - Name of person who commented
 * @param {string} commentText - Comment content
 */
const notifyTechnicianOfReply = async (ticketId, commenterName, commentText) => {
    try {
        // Find assigned technician
        const result = await pool.query(
            `SELECT u.email, u.first_name, t.subject 
            FROM tickets t
            INNER JOIN users u ON u.id = t.assigned_to
            WHERE t.id = $1 AND t.assigned_to IS NOT NULL`,
            [ticketId]
        );
        
        if (result.rows.length === 0) {
            console.log(`ℹ️  No technician assigned to ticket #${ticketId}, skipping notification`);
            return { notified: false, reason: 'No technician assigned' };
        }
        
        const tech = result.rows[0];
        const truncatedComment = commentText.length > 200 
            ? commentText.substring(0, 200) + '...'
            : commentText;
        
        // In dev mode, just log
        if (process.env.EMAIL_MODE === 'dev' || !process.env.MAILGUN_API_KEY) {
            console.log(`📧 [DEV] Would notify ${tech.email} about new comment on ticket #${ticketId}`);
            console.log(`   From: ${commenterName}`);
            console.log(`   Comment: ${truncatedComment}`);
            return { notified: true, email: tech.email };
        }
        
        // TODO: Send actual email notification (would need a new template)
        // For now, just log
        console.log(`📧 Notifying ${tech.email} about new comment on ticket #${ticketId}`);
        
        return { notified: true, email: tech.email };
    } catch (error) {
        console.error('❌ Error notifying technician:', error);
        return { notified: false, reason: error.message };
    }
};

// ============================================================================
// TICKET CREATION FROM EMAIL
// ============================================================================

/**
 * Parse email and create support ticket
 * Main entry point for webhook processing
 */
export const createTicketFromEmail = async (emailData) => {
    try {
        console.log('📧 Processing inbound email to create ticket...');

        // Extract sender email
        const senderEmail = emailData.sender || 
                           emailData.from?.match(/<(.+?)>/) ?.[1] || 
                           emailData.from || 
                           null;

        if (!senderEmail) {
            throw new Error('Cannot determine sender email address');
        }

        console.log(`📧 Sender: ${senderEmail}`);

        // ============================================================================
        // PART 5: SPAM PROTECTION & SECURITY
        // ============================================================================
        console.log('🛡️  Running spam protection checks...');
        
        const spamCheck = await checkSpamProtection(emailData);
        
        // If email is blocked, throw error with reason
        if (spamCheck.blocked) {
            console.warn(`⛔ Email blocked: ${spamCheck.reason}`);
            throw new Error(`Email blocked: ${spamCheck.reason}`);
        }
        
        // If email requires verification, create challenge and stop processing
        if (spamCheck.requiresVerification) {
            console.warn(`⚠️  Verification required (spam score: ${spamCheck.spamScore})`);
            
            const challenge = await createVerificationChallenge(emailData, spamCheck.spamScore);
            
            if (challenge.success) {
                return {
                    success: false,
                    requiresVerification: true,
                    reason: spamCheck.reason,
                    spamScore: spamCheck.spamScore,
                    message: 'Email verification required. Please check your email for verification instructions.'
                };
            } else {
                // If verification email fails, block the email
                throw new Error('Unable to send verification email. Please try again later.');
            }
        }
        
        console.log(`✅ Spam checks passed (score: ${spamCheck.spamScore}/100)`);

        // Extract email content
        const { subject, body } = extractEmailContent(emailData);
        
        if (!subject || !body) {
            throw new Error('Email must have both subject and body');
        }

        console.log(`📧 Subject: ${subject}`);
        console.log(`📧 Body length: ${body.length} chars`);

        // Check for email thread ID (for replies to existing tickets)
        const threadId = extractThreadId(emailData);
        
        // Extract attachment information
        const attachmentInfo = extractAttachmentInfo(emailData);
        if (attachmentInfo.hasAttachments) {
            console.log(`📎 ${attachmentInfo.count} attachment(s) detected`);
            attachmentInfo.attachments.forEach(att => {
                console.log(`   - ${att.name} (${att.contentType}, ${(att.size / 1024).toFixed(1)}KB)`);
            });
        }

        // Find or create user
        const senderName = extractSenderName(emailData);
        const userCreationResult = await findOrCreateUser(senderEmail, senderName, null);
        const { userId, isNewUser, emailVerified, sentWelcomeEmail, sentVerificationReminder } = userCreationResult;

        // Clean email content for ticket
        const ticketSubject = subject.trim();
        const ticketDescription = removeEmailSignatureAndQuotes(body);

        // Detect priority from keywords
        const keywordPriority = detectPriorityFromKeywords(ticketSubject, ticketDescription);

        // Get AI classification
        const ticketText = `${ticketSubject}. ${ticketDescription}`;
        const aiResult = await classifyTicketWithFallback(ticketText, {
            category: 'general',
            priority: keywordPriority // Use keyword-detected priority as fallback
        });

        // Extract email metadata for thread tracking (Part 4)
        const messageId = emailData['Message-Id'] || emailData['message-id'] || null;

        // Priority logic: keyword detection takes precedence over AI if "high"
        let finalPriority = aiResult.priority || keywordPriority;
        if (keywordPriority === 'high') {
            finalPriority = 'high'; // Urgent keywords always elevate to high
            console.log('🚨 Priority elevated to HIGH due to urgent keywords');
        }

        // Create ticket with enhanced metadata
        const ticket = await Ticket.create({
            subject: ticketSubject,
            description: ticketDescription,
            customer_id: userId,
            priority: finalPriority,
            user_priority: null, // Email submissions don't have user priority
            ai_priority: aiResult.aiClassified ? aiResult.priority : null,
            category: aiResult.category || 'general',
            ai_classified: aiResult.aiClassified,
            ai_confidence: aiResult.confidence,
            ai_fallback_used: aiResult.fallbackUsed,
            ai_keywords_matched: aiResult.aiClassified ? {
                category_keywords: aiResult.category_keywords || [],
                priority_keywords: aiResult.priority_keywords || []
            } : null,
            email_message_id: messageId // Store for reply-to-update tracking
        });

        console.log(`✅ Ticket #${ticket.id} created from email`);

        // Increment rate limit counter (Part 5)
        await incrementRateLimit(senderEmail);

        // Save AI classification if available
        if (aiResult.aiClassified) {
            await AIClassification.create({
                ticket_id: ticket.id,
                predicted_category: aiResult.category,
                predicted_priority: aiResult.priority,
                confidence: aiResult.confidence,
                keywords_matched: {
                    category_keywords: aiResult.category_keywords || [],
                    priority_keywords: aiResult.priority_keywords || []
                },
                fallback_used: aiResult.fallbackUsed
            });
        }

        // Send confirmation email to sender
        try {
            // Verify ticket.id exists before sending email
            if (!ticket.id) {
                console.error('❌ Cannot send confirmation email: ticket.id is undefined');
                console.error('Ticket object:', JSON.stringify(ticket, null, 2));
                throw new Error('Ticket ID is missing');
            }

            // Get user details
            const userResult = await pool.query(
                'SELECT email, first_name, email_notifications FROM users WHERE id = $1',
                [userId]
            );

            // Send confirmation if user has notifications enabled
            if (userResult.rows.length > 0 && userResult.rows[0].email_notifications !== false) {
                await sendTicketConfirmation(
                    userResult.rows[0].email,
                    ticket,
                    userId
                );
                console.log(`✅ Ticket confirmation email sent to ${userResult.rows[0].email}`);
            }
        } catch (emailError) {
            console.error('Failed to send confirmation email:', emailError.message);
            // Don't throw - ticket is already created
        }

        return {
            success: true,
            ticket: ticket,
            userId: userId,
            isNewUser: isNewUser,
            emailVerified: emailVerified || false,
            sentWelcomeEmail: sentWelcomeEmail || false,
            sentVerificationReminder: sentVerificationReminder || false,
            threadId: threadId,
            hasAttachments: attachmentInfo.hasAttachments,
            attachmentCount: attachmentInfo.count,
            aiClassification: {
                used: aiResult.aiClassified,
                category: aiResult.category,
                priority: aiResult.priority,
                confidence: aiResult.confidence
            },
            prioritySource: keywordPriority === 'high' ? 'keywords' : (aiResult.aiClassified ? 'ai' : 'default')
        };

    } catch (error) {
        console.error('❌ Error creating ticket from email:', error);
        throw error;
    }
};

/**
 * Handle reply email - add as comment to existing ticket (Part 4)
 * @param {Object} emailData - Raw email data from Mailgun
 * @returns {Object} Result with success status and details
 */
export const handleReplyEmail = async (emailData) => {
    try {
        console.log('💬 Processing email reply to add as comment...');

        // Extract sender email
        const senderEmail = emailData.sender || 
                           emailData.from?.match(/<(.+?)>/) ?.[1] || 
                           emailData.from || 
                           null;

        if (!senderEmail) {
            throw new Error('Cannot determine sender email address');
        }

        console.log(`   From: ${senderEmail}`);

        // Extract thread ID from In-Reply-To or References
        const threadId = extractThreadId(emailData);
        if (!threadId) {
            console.log('⚠️  No thread ID found in reply email, treating as new ticket');
            return {
                success: false,
                reason: 'no_thread_id',
                fallbackToNewTicket: true
            };
        }

        console.log(`   Thread ID: ${threadId}`);

        // Find the original ticket
        const ticket = await findTicketByThreadId(threadId);
        if (!ticket) {
            console.log('⚠️  No ticket found for thread ID, treating as new ticket');
            return {
                success: false,
                reason: 'ticket_not_found',
                fallbackToNewTicket: true
            };
        }

        console.log(`   Found ticket #${ticket.id}: "${ticket.subject}"`);

        // Verify sender is authorized (ticket owner)
        const authCheck = await verifyReplyAuthorization(ticket.id, senderEmail);
        if (!authCheck.authorized) {
            console.log(`❌ Unauthorized reply attempt from ${senderEmail}: ${authCheck.reason}`);
            return {
                success: false,
                reason: 'unauthorized',
                message: authCheck.reason,
                ticketId: ticket.id
            };
        }

        console.log(`✅ Sender authorized (User #${authCheck.userId})`);

        // Extract and clean email content
        const emailContent = extractEmailContent(emailData);
        const cleanedBody = removeEmailSignatureAndQuotes(emailContent.body);

        if (!cleanedBody || cleanedBody.trim().length === 0) {
            throw new Error('Reply email has no content after cleaning');
        }

        console.log(`   Reply content: ${cleanedBody.substring(0, 100)}...`);

        // Add reply as comment
        const comment = await addReplyAsComment(ticket.id, authCheck.userId, cleanedBody);

        // Notify assigned technician
        const senderName = extractSenderName(emailData);
        const notification = await notifyTechnicianOfReply(ticket.id, senderName, cleanedBody);

        console.log(`✅ Reply added as comment #${comment.id} on ticket #${ticket.id}`);

        return {
            success: true,
            ticketId: ticket.id,
            commentId: comment.id,
            userId: authCheck.userId,
            senderEmail,
            technician_notified: notification.notified
        };

    } catch (error) {
        console.error('❌ Error handling reply email:', error);
        throw error;
    }
};

/**
 * Validate email data has required fields
 */
export const validateEmailData = (emailData) => {
    const requiredFields = ['sender', 'subject'];
    const missingFields = requiredFields.filter(field => !emailData[field] && !emailData[field.charAt(0).toUpperCase() + field.slice(1)]);
    
    if (missingFields.length > 0) {
        return {
            valid: false,
            error: `Missing required fields: ${missingFields.join(', ')}`
        };
    }

    return { valid: true };
};
