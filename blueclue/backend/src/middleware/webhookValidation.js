// ============================================================================
// Webhook Validation Middleware
// ============================================================================
// Validates incoming webhooks to prevent spam and forgery

import crypto from 'crypto';
import {
    AppError,
    BadRequestError,
    ForbiddenError,
    InternalServerError
} from './errorHandler.js';

/**
 * Validate Mailgun webhook signature
 * 
 * Mailgun signs all webhook requests. This middleware verifies the signature
 * to ensure the request is legitimate and hasn't been tampered with.
 * 
 * Required environment variable: MAILGUN_WEBHOOK_SIGNING_KEY
 * 
 * @see https://documentation.mailgun.com/en/latest/user_manual.html#securing-webhooks
 */
export const validateMailgunSignature = (req, res, next) => {
    const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;

    if (!signingKey) {
        console.error('❌ MAILGUN_WEBHOOK_SIGNING_KEY not configured');
        return next(new InternalServerError('Webhook signing key not configured'));
    }

    try {
        // Mailgun sends signature data in the body
        // Support both JSON format (new) and form-urlencoded (legacy)
        let timestamp, token, signature;
        
        if (req.body.signature && typeof req.body.signature === 'object') {
            // JSON format: signature is nested object
            timestamp = req.body.signature.timestamp;
            token = req.body.signature.token;
            signature = req.body.signature.signature;
        } else {
            // Form-urlencoded format: flat structure
            timestamp = req.body.timestamp;
            token = req.body.token;
            signature = req.body.signature;
        }

        if (!timestamp || !token || !signature) {
            console.error('❌ Missing signature fields in webhook');
            console.error('   Body structure:', JSON.stringify(req.body, null, 2).substring(0, 500));
            return next(new ForbiddenError('Invalid webhook signature format'));
        }

        // Verify signature using HMAC-SHA256
        // Mailgun signature = HMAC-SHA256(timestamp + token, signing_key)
        const encodedData = timestamp + token;
        const hmac = crypto.createHmac('sha256', signingKey);
        hmac.update(encodedData);
        const calculatedSignature = hmac.digest('hex');

        if (calculatedSignature !== signature) {
            console.error('❌ Invalid webhook signature');
            console.error(`   Expected: ${calculatedSignature}`);
            console.error(`   Received: ${signature}`);
            return next(new ForbiddenError('Invalid webhook signature'));
        }

        // Check timestamp to prevent replay attacks (allow 5 minute window)
        const parsedTimestamp = parseInt(timestamp);
        if (isNaN(parsedTimestamp)) {
            console.error('❌ Invalid timestamp format');
            return next(new ForbiddenError('Invalid webhook timestamp format'));
        }

        const currentTimestamp = Math.floor(Date.now() / 1000);
        const timestampAge = currentTimestamp - parsedTimestamp;
        
        if (timestampAge > 300) { // 5 minutes
            console.error(`❌ Webhook timestamp too old: ${timestampAge}s`);
            return next(new ForbiddenError('Webhook timestamp expired'));
        }

        console.log('✅ Mailgun webhook signature validated');
        next();

    } catch (error) {
        console.error('❌ Signature validation error:', error);
        return next(new InternalServerError('Failed to validate webhook signature'));
    }
};

/**
 * Validate request has required webhook fields
 * Basic validation before processing
 */
export const validateWebhookRequest = (req, res, next) => {
    // Check content type
    const contentType = req.headers['content-type'];
    
    if (!contentType || !contentType.includes('application/x-www-form-urlencoded')) {
        console.warn(`⚠️  Unexpected content type: ${contentType}`);
        // Don't block - Mailgun uses form-urlencoded but allow other formats for testing
    }

    // Check if body exists
    if (!req.body || Object.keys(req.body).length === 0) {
        console.error('❌ Empty webhook body');
        return next(new BadRequestError('Webhook body is required'));
    }

    next();
};

/**
 * Rate limiting middleware for webhooks
 * Prevents abuse even if signature validation is bypassed
 */
const requestCounts = new Map();

export const rateLimitWebhook = (req, res, next) => {
    const sender = req.body.sender || req.ip;
    const now = Date.now();
    const windowMs = 60000; // 1 minute window
    const maxRequests = 10; // Max 10 requests per minute per sender

    // Clean up old entries
    for (const [key, value] of requestCounts.entries()) {
        if (now - value.timestamp > windowMs) {
            requestCounts.delete(key);
        }
    }

    // Check rate limit
    const requestData = requestCounts.get(sender);
    
    if (requestData) {
        if (now - requestData.timestamp < windowMs) {
            requestData.count++;
            
            if (requestData.count > maxRequests) {
                console.warn(`⚠️  Rate limit exceeded for ${sender}`);
                return next(new AppError('Too many requests', 429));
            }
        } else {
            requestCounts.set(sender, { count: 1, timestamp: now });
        }
    } else {
        requestCounts.set(sender, { count: 1, timestamp: now });
    }

    next();
};
