// ============================================================================
// Webhook Controller
// ============================================================================
// Handles incoming webhooks for inbound email processing

import { 
    createTicketFromEmail, 
    handleReplyEmail, 
    validateEmailData 
} from '../services/inboundEmailService.js';
import { verifyChallenge } from '../services/spamProtectionService.js';

/**
 * Check if email is a reply based on headers
 */
const isReplyEmail = (emailData) => {
    return !!(emailData['In-Reply-To'] || emailData['in-reply-to'] || 
              emailData['References'] || emailData['references']);
};

/**
 * Handle Mailgun inbound email webhook
 * POST /api/webhooks/inbound-email
 * 
 * Receives parsed email data from Mailgun and either:
 * - Creates a new support ticket (if new email)
 * - Adds a comment to existing ticket (if reply email)
 */
export const handleInboundEmail = async (req, res) => {
    try {
        console.log('📧 Received inbound email webhook');
        console.log('📧 Headers:', JSON.stringify(req.headers, null, 2));

        // Mailgun sends data in req.body (already parsed by express.urlencoded)
        const emailData = req.body;

        // Log received data for debugging (sanitize sensitive info)
        console.log('📧 Email data:', JSON.stringify({
            sender: emailData.sender,
            from: emailData.from,
            subject: emailData.subject,
            timestamp: emailData.timestamp,
            hasInReplyTo: !!emailData['In-Reply-To'],
            hasReferences: !!emailData['References'],
            hasBodyPlain: !!emailData['body-plain'],
            hasBodyHtml: !!emailData['body-html']
        }, null, 2));

        // Validate email data
        const validation = validateEmailData(emailData);
        if (!validation.valid) {
            console.error('❌ Invalid email data:', validation.error);
            return res.status(400).json({
                status: 'error',
                message: validation.error
            });
        }

        // Check if this is a reply to an existing ticket
        const isReply = isReplyEmail(emailData);
        console.log(`   Email type: ${isReply ? '💬 REPLY' : '📝 NEW'}`);

        // Route to appropriate handler
        if (isReply) {
            // Handle reply - add as comment to existing ticket
            const replyResult = await handleReplyEmail(emailData);

            if (!replyResult.success) {
                // If reply handling failed, check if we should fallback to new ticket
                if (replyResult.fallbackToNewTicket) {
                    console.log('⚠️  Reply handling failed, creating new ticket instead...');
                    const result = await createTicketFromEmail(emailData);
                    return res.status(200).json({
                        status: 'success',
                        message: 'Created new ticket (reply handling fallback)',
                        type: 'new_ticket',
                        data: {
                            ticket_id: result.ticket.id,
                            ticket_number: result.ticket.ticket_number,
                            user_id: result.userId,
                            is_new_user: result.isNewUser
                        }
                    });
                }

                // Unauthorized or other error
                return res.status(403).json({
                    status: 'error',
                    message: replyResult.message || 'Failed to process reply',
                    reason: replyResult.reason
                });
            }

            // Reply added successfully
            console.log(`✅ Reply processed: Comment #${replyResult.commentId} added to ticket #${replyResult.ticketId}`);
            console.log(`   Technician notified: ${replyResult.technician_notified ? 'YES' : 'NO'}`);

            return res.status(200).json({
                status: 'success',
                message: 'Reply added as comment to ticket',
                type: 'reply_comment',
                data: {
                    ticket_id: replyResult.ticketId,
                    comment_id: replyResult.commentId,
                    user_id: replyResult.userId,
                    technician_notified: replyResult.technician_notified
                }
            });
        }

        // Create new ticket from email
        const result = await createTicketFromEmail(emailData);

        // Log success
        console.log(`✅ Successfully created ticket #${result.ticket.id} from email`);
        console.log(`   User ID: ${result.userId} (${result.isNewUser ? 'NEW' : 'EXISTING'})`);
        if (result.isNewUser) {
            console.log(`   📧 Welcome email sent: ${result.sentWelcomeEmail ? 'YES' : 'NO'}`);
            console.log(`   ✅ Email verified: ${result.emailVerified ? 'YES' : 'NO (verification required)'}`);
        } else if (result.sentVerificationReminder) {
            console.log(`   📧 Verification reminder sent to unverified user`);
        }
        console.log(`   Priority Source: ${result.prioritySource || 'default'}`);
        if (result.threadId) {
            console.log(`   Thread ID: ${result.threadId}`);
        }
        if (result.hasAttachments) {
            console.log(`   Attachments: ${result.attachmentCount} file(s)`);
        }
        console.log(`   AI Classification: ${result.aiClassification.used ? 'YES' : 'NO'}`);
        if (result.aiClassification.used) {
            console.log(`   Category: ${result.aiClassification.category} (${result.aiClassification.confidence}% confidence)`);
            console.log(`   Priority: ${result.aiClassification.priority}`);
        }

        // Return success response to Mailgun
        res.status(200).json({
            status: 'success',
            message: 'Ticket created successfully from email',
            data: {
                ticket_id: result.ticket.id,
                ticket_number: result.ticket.ticket_number,
                user_id: result.userId,
                is_new_user: result.isNewUser,
                email_verified: result.emailVerified || false,
                sent_welcome_email: result.sentWelcomeEmail || false,
                sent_verification_reminder: result.sentVerificationReminder || false,
                thread_id: result.threadId || null,
                has_attachments: result.hasAttachments || false,
                attachment_count: result.attachmentCount || 0,
                priority_source: result.prioritySource || 'default',
                ai_classification: result.aiClassification
            }
        });

    } catch (error) {
        console.error('❌ Webhook error:', error);
        
        // Return error response
        // Note: Mailgun will retry failed webhooks
        res.status(500).json({
            status: 'error',
            message: 'Failed to process inbound email',
            error: error.message
        });
    }
};

/**
 * Health check endpoint for webhook
 * GET /api/webhooks/health
 */
export const webhookHealth = async (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Webhook endpoint is operational',
        timestamp: new Date().toISOString(),
        endpoints: {
            inbound_email: {
                method: 'POST',
                path: '/api/webhooks/inbound-email',
                description: 'Receives parsed email data from Mailgun'
            }
        }
    });
};

/**
 * Test endpoint for webhook (development only)
 * POST /api/webhooks/test-email
 * 
 * Allows manual testing of email-to-ticket conversion and reply handling
 * Pass inReplyTo field to test reply-to-update feature
 */
export const testInboundEmail = async (req, res) => {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
            status: 'error',
            message: 'Test endpoint not available in production'
        });
    }

    try {
        const { sender, subject, body, inReplyTo } = req.body;

        if (!sender || !subject || !body) {
            return res.status(400).json({
                status: 'error',
                message: 'Test requires: sender, subject, body'
            });
        }

        // Simulate Mailgun email data format
        const mockEmailData = {
            sender: sender,
            from: `Test User <${sender}>`,
            subject: subject,
            'body-plain': body,
            timestamp: Math.floor(Date.now() / 1000).toString(),
            'stripped-text': body,
            ...req.body // Pass through any additional fields (In-Reply-To, attachments, etc.)
        };

        // Add In-Reply-To if provided for reply testing
        if (inReplyTo) {
            mockEmailData['In-Reply-To'] = inReplyTo;
            console.log(`🧪 Testing reply-to-update with thread ID: ${inReplyTo}`);
        }

        // Check if this is a reply
        const isReply = isReplyEmail(mockEmailData);

        if (isReply) {
            // Handle as reply
            const replyResult = await handleReplyEmail(mockEmailData);

            if (!replyResult.success) {
                // Fallback to new ticket if needed
                if (replyResult.fallbackToNewTicket) {
                    console.log('⚠️  Test reply handling failed, creating new ticket...');
                    const result = await createTicketFromEmail(mockEmailData);
                    return res.status(200).json({
                        status: 'success',
                        message: 'Test: Created new ticket (reply fallback)',
                        type: 'new_ticket',
                        data: {
                            ticket_id: result.ticket.id,
                            ticket_number: result.ticket.ticket_number,
                            user_id: result.userId
                        }
                    });
                }

                return res.status(403).json({
                    status: 'error',
                    message: replyResult.message || 'Test reply failed',
                    reason: replyResult.reason
                });
            }

            return res.status(200).json({
                status: 'success',
                message: 'Test: Reply added as comment',
                type: 'reply_comment',
                data: {
                    ticket_id: replyResult.ticketId,
                    comment_id: replyResult.commentId,
                    user_id: replyResult.userId,
                    technician_notified: replyResult.technician_notified
                }
            });
        }

        // Create new ticket
        const result = await createTicketFromEmail(mockEmailData);

        res.status(200).json({
            status: 'success',
            message: 'Test email processed successfully',
            type: 'new_ticket',
            data: {
                ticket_id: result.ticket.id,
                ticket_number: result.ticket.ticket_number,
                user_id: result.userId,
                is_new_user: result.isNewUser,
                email_verified: result.emailVerified || false,
                sent_welcome_email: result.sentWelcomeEmail || false,
                sent_verification_reminder: result.sentVerificationReminder || false,
                thread_id: result.threadId || null,
                has_attachments: result.hasAttachments || false,
                attachment_count: result.attachmentCount || 0,
                priority_source: result.prioritySource || 'default',
                ai_classification: result.aiClassification
            }
        });

    } catch (error) {
        console.error('Test webhook error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to process test email',
            error: error.message
        });
    }
};

/**
 * Handle email verification challenge (Part 5)
 * GET /api/webhooks/verify-email/:token
 * 
 * Verifies the challenge token and processes the original email
 */
export const handleEmailVerification = async (req, res) => {
    try {
        const { token } = req.params;
        
        console.log(`🔒 Processing email verification for token: ${token.substring(0, 10)}...`);
        
        if (!token) {
            return res.status(400).json({
                status: 'error',
                message: 'Verification token is required'
            });
        }
        
        // Verify the challenge token
        const verificationResult = await verifyChallenge(token);
        
        if (!verificationResult.success) {
            return res.status(400).json({
                status: 'error',
                message: verificationResult.reason || 'Invalid or expired verification token'
            });
        }
        
        // Process the original email that was held pending verification
        const originalEmailData = verificationResult.emailData;
        
        console.log(`✅ Email verified for ${verificationResult.email}. Processing original email...`);
        
        // Check if it's a reply or new ticket
        const isReply = isReplyEmail(originalEmailData);
        
        if (isReply) {
            const replyResult = await handleReplyEmail(originalEmailData);
            
            if (!replyResult.success) {
                // If reply fails (no ticket found), create new ticket instead
                const ticketResult = await createTicketFromEmail(originalEmailData);
                
                return res.status(200).json({
                    status: 'success',
                    message: 'Email verified and ticket created (thread not found, created new ticket)',
                    type: 'new_ticket_after_verification',
                    data: {
                        email: verificationResult.email,
                        ticket_id: ticketResult.ticket.id,
                        ticket_number: ticketResult.ticket.ticket_number
                    }
                });
            }
            
            return res.status(200).json({
                status: 'success',
                message: 'Email verified and comment added to ticket',
                type: 'reply_after_verification',
                data: {
                    email: verificationResult.email,
                    ticket_id: replyResult.ticketId,
                    comment_id: replyResult.commentId
                }
            });
        }
        
        // Create new ticket
        const result = await createTicketFromEmail(originalEmailData);
        
        if (!result.success) {
            return res.status(400).json({
                status: 'error',
                message: result.message || 'Failed to create ticket after verification'
            });
        }
        
        return res.status(200).json({
            status: 'success',
            message: 'Email verified and ticket created successfully',
            type: 'new_ticket_after_verification',
            data: {
                email: verificationResult.email,
                ticket_id: result.ticket.id,
                ticket_number: result.ticket.ticket_number,
                user_id: result.userId,
                is_new_user: result.isNewUser
            }
        });
        
    } catch (error) {
        console.error('❌ Email verification error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to process email verification',
            error: error.message
        });
    }
};
