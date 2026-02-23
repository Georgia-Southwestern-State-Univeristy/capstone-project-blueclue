// ============================================================================
// Webhook Routes
// ============================================================================
// Routes for handling incoming webhooks (inbound email, etc.)

import express from 'express';
import { 
    handleInboundEmail, 
    webhookHealth, 
    testInboundEmail,
    handleEmailVerification 
} from '../controllers/webhookController.js';
import { 
    validateMailgunSignature, 
    validateWebhookRequest,
    rateLimitWebhook 
} from '../middleware/webhookValidation.js';

const router = express.Router();

// ============================================================================
// PUBLIC WEBHOOK ENDPOINTS (No authentication required)
// ============================================================================

/**
 * Health check
 * GET /api/webhooks/health
 */
router.get('/health', webhookHealth);

/**
 * Inbound email webhook - receives emails from Mailgun
 * POST /api/webhooks/inbound-email
 * 
 * Middleware order:
 * 1. validateWebhookRequest - basic validation
 * 2. rateLimitWebhook - prevent abuse
 * 3. validateMailgunSignature - verify authenticity
 * 4. handleInboundEmail - process email and create ticket
 */
router.post('/inbound-email',
    validateWebhookRequest,
    rateLimitWebhook,
    validateMailgunSignature,
    handleInboundEmail
);

/**
 * Test endpoint for development
 * POST /api/webhooks/test-email
 * 
 * Only available in development mode
 * Allows manual testing without Mailgun
 */
router.post('/test-email', testInboundEmail);

/**
 * Email verification endpoint (Part 5)
 * GET /api/webhooks/verify-email/:token
 * 
 * Verifies email challenge token and processes original email
 * Public endpoint - no authentication required
 */
router.get('/verify-email/:token', handleEmailVerification);

export default router;
