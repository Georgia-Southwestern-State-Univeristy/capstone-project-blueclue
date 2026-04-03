// Development Email Testing Route
// For testing email templates and email service functionality in development

import express from 'express';
import { 
    sendWelcomeEmail, 
    sendVerificationEmail,
    sendTicketConfirmation,
    sendTicketStatusUpdate,
    sendPasswordResetEmail,
    getEmailServiceStatus,
    isEmailServiceReady
} from '../services/emailService.js';

const router = express.Router();

// Only enable these routes in development/test environments
if (process.env.NODE_ENV !== 'production') {
    
    /**
     * GET /api/dev/email-status
     * Check email service configuration and status
     */
    router.get('/email-status', (req, res) => {
        const status = getEmailServiceStatus();
        res.json({
            ready: isEmailServiceReady(),
            ...status,
            message: status.configured 
                ? 'Email service is configured and ready' 
                : 'Email service will run in development mode (console only)'
        });
    });

    /**
     * POST /api/dev/email-test/welcome
     * Test welcome email template
     * Body: { email, firstName, verificationToken }
     */
    router.post('/email-test/welcome', async (req, res) => {
        try {
            const { email, firstName, verificationToken } = req.body;
            
            if (!email || !firstName) {
                return res.status(400).json({ 
                    error: 'Missing required fields: email, firstName' 
                });
            }

            const token = verificationToken || 'test-token-123456';
            await sendWelcomeEmail(email, firstName, token);
            
            res.json({ 
                success: true, 
                message: 'Welcome email sent/logged',
                mode: process.env.EMAIL_USER ? 'production' : 'development'
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/dev/email-test/verification
     * Test verification email template
     * Body: { email, firstName, verificationToken }
     */
    router.post('/email-test/verification', async (req, res) => {
        try {
            const { email, firstName, verificationToken } = req.body;
            
            if (!email || !firstName) {
                return res.status(400).json({ 
                    error: 'Missing required fields: email, firstName' 
                });
            }

            const token = verificationToken || 'test-token-123456';
            await sendVerificationEmail(email, firstName, token);
            
            res.json({ 
                success: true, 
                message: 'Verification email sent/logged',
                mode: process.env.EMAIL_USER ? 'production' : 'development'
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/dev/email-test/ticket-created
     * Test ticket creation email template
     * Body: { email, ticketId, subject, priority, category, description }
     */
    router.post('/email-test/ticket-created', async (req, res) => {
        try {
            const { email, ticketId, subject, priority, category, description } = req.body;
            
            if (!email || !ticketId || !subject) {
                return res.status(400).json({ 
                    error: 'Missing required fields: email, ticketId, subject' 
                });
            }

            const ticketData = {
                ticket_id: ticketId,
                subject,
                priority: priority || 'medium',
                category: category || 'technical',
                description: description || 'Test ticket description'
            };

            await sendTicketConfirmation(email, ticketData);
            
            res.json({ 
                success: true, 
                message: 'Ticket confirmation email sent/logged',
                mode: process.env.EMAIL_USER ? 'production' : 'development'
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/dev/email-test/ticket-status
     * Test ticket status update email template
     * Body: { email, ticketId, subject, oldStatus, newStatus, assignedTechnician, updateComment }
     */
    router.post('/email-test/ticket-status', async (req, res) => {
        try {
            const { email, ticketId, subject, oldStatus, newStatus, assignedTechnician, updateComment } = req.body;
            
            if (!email || !ticketId || !subject || !oldStatus || !newStatus) {
                return res.status(400).json({ 
                    error: 'Missing required fields: email, ticketId, subject, oldStatus, newStatus' 
                });
            }

            const ticketData = {
                ticket_id: ticketId,
                subject,
                old_status: oldStatus,
                status: newStatus,
                assigned_technician_name: assignedTechnician || null,
                updated_at: new Date().toISOString()
            };

            await sendTicketStatusUpdate(email, ticketData, updateComment);
            
            res.json({ 
                success: true, 
                message: 'Status update email sent/logged',
                mode: process.env.EMAIL_USER ? 'production' : 'development'
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/dev/email-test/password-reset
     * Test password reset email template
     * Body: { email, firstName, resetToken }
     */
    router.post('/email-test/password-reset', async (req, res) => {
        try {
            const { email, firstName, resetToken } = req.body;
            
            if (!email || !firstName) {
                return res.status(400).json({ 
                    error: 'Missing required fields: email, firstName' 
                });
            }

            const token = resetToken || 'test-reset-token-123456';
            await sendPasswordResetEmail(email, firstName, token);
            
            res.json({ 
                success: true, 
                message: 'Password reset email sent/logged',
                mode: process.env.EMAIL_USER ? 'production' : 'development'
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/dev/email-test/examples
     * Get example payloads for testing each email type
     */
    router.get('/email-test/examples', (req, res) => {
        res.json({
            message: 'Example payloads for testing email endpoints',
            examples: {
                welcome: {
                    endpoint: 'POST /api/dev/email-test/welcome',
                    payload: {
                        email: 'user@example.com',
                        firstName: 'John',
                        verificationToken: 'test-token-123'
                    }
                },
                verification: {
                    endpoint: 'POST /api/dev/email-test/verification',
                    payload: {
                        email: 'user@example.com',
                        firstName: 'John',
                        verificationToken: 'verify-token-456'
                    }
                },
                ticketCreated: {
                    endpoint: 'POST /api/dev/email-test/ticket-created',
                    payload: {
                        email: 'user@example.com',
                        ticketId: 1001,
                        subject: 'Test Ticket',
                        priority: 'high',
                        category: 'technical',
                        description: 'This is a test ticket description'
                    }
                },
                ticketStatus: {
                    endpoint: 'POST /api/dev/email-test/ticket-status',
                    payload: {
                        email: 'user@example.com',
                        ticketId: 1001,
                        subject: 'Test Ticket',
                        oldStatus: 'open',
                        newStatus: 'in-progress',
                        assignedTechnician: 'Jane Doe',
                        updateComment: 'Working on this issue now'
                    }
                },
                passwordReset: {
                    endpoint: 'POST /api/dev/email-test/password-reset',
                    payload: {
                        email: 'user@example.com',
                        firstName: 'John',
                        resetToken: 'reset-token-789'
                    }
                }
            },
            status: {
                endpoint: 'GET /api/dev/email-status',
                description: 'Check email service configuration'
            }
        });
    });

    /**
     * GET /api/dev/test-500
     * Trigger an unhandled error to verify the global errorHandler returns { status: 'error', ... }
     */
    router.get('/test-500', (req, res) => {
        throw new Error('Intentional test error — verifying 500 error handler shape');
    });

} else {
    // In production, return 404 for all dev routes
    router.use((req, res) => {
        res.status(404).json({ error: 'Development routes not available in production' });
    });
}

export default router;
