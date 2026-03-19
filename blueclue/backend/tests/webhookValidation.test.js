// ============================================================================
// Webhook Validation Middleware Tests
// ============================================================================
// Tests for Mailgun webhook signature validation

import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import { validateMailgunSignature } from '../src/middleware/webhookValidation.js';

/**
 * Helper function to generate valid Mailgun signature
 */
const generateValidSignature = (timestamp, token, signingKey) => {
    const encodedData = timestamp + token;
    const hmac = crypto.createHmac('sha256', signingKey);
    hmac.update(encodedData);
    return hmac.digest('hex');
};

/**
 * Helper to create mock Express req/res/next objects
 */
const createMocks = () => {
    const req = {
        body: {},
        headers: {}
    };
    const res = {};
    const next = vi.fn();
    return { req, res, next };
};

describe('validateMailgunSignature middleware', () => {
    const VALID_SIGNING_KEY = 'test-signing-key-12345';
    const originalEnv = process.env;

    beforeEach(() => {
        // Reset environment and mocks before each test
        vi.resetModules();
        process.env = { ...originalEnv };
        process.env.MAILGUN_WEBHOOK_SIGNING_KEY = VALID_SIGNING_KEY;
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    // ========================================================================
    // Test Case 1: Valid Signature Accepted
    // ========================================================================
    describe('Valid signature', () => {
        it('should accept request with valid signature (JSON format)', () => {
            const { req, res, next } = createMocks();
            
            const timestamp = Math.floor(Date.now() / 1000).toString();
            const token = 'random-token-abc123';
            const signature = generateValidSignature(timestamp, token, VALID_SIGNING_KEY);

            req.body = {
                signature: {
                    timestamp,
                    token,
                    signature
                },
                'event-data': {
                    sender: 'user@example.com',
                    subject: 'Test email'
                }
            };

            validateMailgunSignature(req, res, next);

            expect(next).toHaveBeenCalledOnce();
            expect(next).toHaveBeenCalledWith(); // Called without error
        });

        it('should accept request with valid signature (form-urlencoded format)', () => {
            const { req, res, next } = createMocks();
            
            const timestamp = Math.floor(Date.now() / 1000).toString();
            const token = 'random-token-xyz789';
            const signature = generateValidSignature(timestamp, token, VALID_SIGNING_KEY);

            req.body = {
                timestamp,
                token,
                signature,
                sender: 'user@example.com',
                subject: 'Test email'
            };

            validateMailgunSignature(req, res, next);

            expect(next).toHaveBeenCalledOnce();
            expect(next).toHaveBeenCalledWith(); // Called without error
        });

        it('should accept request with recent timestamp (within 5 minute window)', () => {
            const { req, res, next } = createMocks();
            
            // Timestamp from 4 minutes ago (within 5 minute window)
            const timestamp = (Math.floor(Date.now() / 1000) - 240).toString();
            const token = 'recent-token-123';
            const signature = generateValidSignature(timestamp, token, VALID_SIGNING_KEY);

            req.body = {
                signature: { timestamp, token, signature }
            };

            validateMailgunSignature(req, res, next);

            expect(next).toHaveBeenCalledOnce();
            expect(next).toHaveBeenCalledWith(); // Called without error
        });
    });

    // ========================================================================
    // Test Case 2: Invalid Signature Rejected
    // ========================================================================
    describe('Invalid signature', () => {
        it('should reject request with invalid signature', () => {
            const { req, res, next } = createMocks();
            
            const timestamp = Math.floor(Date.now() / 1000).toString();
            const token = 'random-token-abc123';
            const invalidSignature = 'invalid-signature-hash';

            req.body = {
                signature: {
                    timestamp,
                    token,
                    signature: invalidSignature
                }
            };

            validateMailgunSignature(req, res, next);

            expect(next).toHaveBeenCalledOnce();
            const error = next.mock.calls[0][0];
            expect(error).toBeDefined();
            expect(error.statusCode).toBe(403);
            expect(error.message).toBe('Invalid webhook signature');
        });

        it('should reject request with wrong signing key', () => {
            const { req, res, next } = createMocks();
            
            const timestamp = Math.floor(Date.now() / 1000).toString();
            const token = 'random-token-abc123';
            // Generate signature with wrong key
            const wrongKey = 'wrong-signing-key';
            const signature = generateValidSignature(timestamp, token, wrongKey);

            req.body = {
                signature: { timestamp, token, signature }
            };

            validateMailgunSignature(req, res, next);

            expect(next).toHaveBeenCalledOnce();
            const error = next.mock.calls[0][0];
            expect(error).toBeDefined();
            expect(error.statusCode).toBe(403);
            expect(error.message).toBe('Invalid webhook signature');
        });

        it('should reject request with tampered data', () => {
            const { req, res, next } = createMocks();
            
            const timestamp = Math.floor(Date.now() / 1000).toString();
            const token = 'original-token';
            const signature = generateValidSignature(timestamp, token, VALID_SIGNING_KEY);

            // Tamper with token after signature generation
            req.body = {
                signature: {
                    timestamp,
                    token: 'tampered-token', // Changed!
                    signature
                }
            };

            validateMailgunSignature(req, res, next);

            expect(next).toHaveBeenCalledOnce();
            const error = next.mock.calls[0][0];
            expect(error).toBeDefined();
            expect(error.statusCode).toBe(403);
        });

        it('should reject request with expired timestamp (older than 5 minutes)', () => {
            const { req, res, next } = createMocks();
            
            // Timestamp from 6 minutes ago (outside 5 minute window)
            const timestamp = (Math.floor(Date.now() / 1000) - 360).toString();
            const token = 'old-token-123';
            const signature = generateValidSignature(timestamp, token, VALID_SIGNING_KEY);

            req.body = {
                signature: { timestamp, token, signature }
            };

            validateMailgunSignature(req, res, next);

            expect(next).toHaveBeenCalledOnce();
            const error = next.mock.calls[0][0];
            expect(error).toBeDefined();
            expect(error.statusCode).toBe(403);
            expect(error.message).toBe('Webhook timestamp expired');
        });
    });

    // ========================================================================
    // Test Case 3: Missing Signature Rejected
    // ========================================================================
    describe('Missing signature fields', () => {
        it('should reject request with missing timestamp', () => {
            const { req, res, next } = createMocks();
            
            const token = 'random-token-abc123';
            const signature = 'some-signature';

            req.body = {
                signature: {
                    // timestamp missing!
                    token,
                    signature
                }
            };

            validateMailgunSignature(req, res, next);

            expect(next).toHaveBeenCalledOnce();
            const error = next.mock.calls[0][0];
            expect(error).toBeDefined();
            expect(error.statusCode).toBe(403);
            expect(error.message).toBe('Invalid webhook signature format');
        });

        it('should reject request with missing token', () => {
            const { req, res, next } = createMocks();
            
            const timestamp = Math.floor(Date.now() / 1000).toString();
            const signature = 'some-signature';

            req.body = {
                signature: {
                    timestamp,
                    // token missing!
                    signature
                }
            };

            validateMailgunSignature(req, res, next);

            expect(next).toHaveBeenCalledOnce();
            const error = next.mock.calls[0][0];
            expect(error).toBeDefined();
            expect(error.statusCode).toBe(403);
            expect(error.message).toBe('Invalid webhook signature format');
        });

        it('should reject request with missing signature', () => {
            const { req, res, next } = createMocks();
            
            const timestamp = Math.floor(Date.now() / 1000).toString();
            const token = 'random-token-abc123';

            req.body = {
                signature: {
                    timestamp,
                    token
                    // signature missing!
                }
            };

            validateMailgunSignature(req, res, next);

            expect(next).toHaveBeenCalledOnce();
            const error = next.mock.calls[0][0];
            expect(error).toBeDefined();
            expect(error.statusCode).toBe(403);
            expect(error.message).toBe('Invalid webhook signature format');
        });

        it('should reject request with no signature object at all', () => {
            const { req, res, next } = createMocks();
            
            req.body = {
                sender: 'user@example.com',
                subject: 'Test email'
                // No signature data at all
            };

            validateMailgunSignature(req, res, next);

            expect(next).toHaveBeenCalledOnce();
            const error = next.mock.calls[0][0];
            expect(error).toBeDefined();
            expect(error.statusCode).toBe(403);
            expect(error.message).toBe('Invalid webhook signature format');
        });

        it('should reject empty request body', () => {
            const { req, res, next } = createMocks();
            
            req.body = {};

            validateMailgunSignature(req, res, next);

            expect(next).toHaveBeenCalledOnce();
            const error = next.mock.calls[0][0];
            expect(error).toBeDefined();
            expect(error.statusCode).toBe(403);
        });
    });

    // ========================================================================
    // Test Case 4: Environment Configuration
    // ========================================================================
    describe('Environment configuration', () => {
        it('should return 500 error if MAILGUN_WEBHOOK_SIGNING_KEY is not configured', () => {
            const { req, res, next } = createMocks();
            
            // Remove signing key from environment
            delete process.env.MAILGUN_WEBHOOK_SIGNING_KEY;

            const timestamp = Math.floor(Date.now() / 1000).toString();
            const token = 'random-token-abc123';
            const signature = 'some-signature';

            req.body = {
                signature: { timestamp, token, signature }
            };

            validateMailgunSignature(req, res, next);

            expect(next).toHaveBeenCalledOnce();
            const error = next.mock.calls[0][0];
            expect(error).toBeDefined();
            expect(error.statusCode).toBe(500);
            expect(error.message).toBe('Webhook signing key not configured');
        });

        it('should return 500 error if MAILGUN_WEBHOOK_SIGNING_KEY is empty string', () => {
            const { req, res, next } = createMocks();
            
            process.env.MAILGUN_WEBHOOK_SIGNING_KEY = '';

            const timestamp = Math.floor(Date.now() / 1000).toString();
            const token = 'random-token-abc123';
            const signature = 'some-signature';

            req.body = {
                signature: { timestamp, token, signature }
            };

            validateMailgunSignature(req, res, next);

            expect(next).toHaveBeenCalledOnce();
            const error = next.mock.calls[0][0];
            expect(error).toBeDefined();
            expect(error.statusCode).toBe(500);
        });
    });

    // ========================================================================
    // Test Case 5: Edge Cases
    // ========================================================================
    describe('Edge cases', () => {
        it('should handle malformed timestamp (non-numeric)', () => {
            const { req, res, next } = createMocks();
            
            const timestamp = 'not-a-number';
            const token = 'random-token-abc123';
            const signature = generateValidSignature(timestamp, token, VALID_SIGNING_KEY);

            req.body = {
                signature: { timestamp, token, signature }
            };

            validateMailgunSignature(req, res, next);

            // Should call next with error (either signature invalid or timestamp invalid)
            expect(next).toHaveBeenCalledOnce();
            const error = next.mock.calls[0][0];
            expect(error).toBeDefined();
            expect(error.statusCode).toBe(403);
        });

        it('should handle Unicode characters in token', () => {
            const { req, res, next } = createMocks();
            
            const timestamp = Math.floor(Date.now() / 1000).toString();
            const token = 'token-with-unicode-🔐-chars';
            const signature = generateValidSignature(timestamp, token, VALID_SIGNING_KEY);

            req.body = {
                signature: { timestamp, token, signature }
            };

            validateMailgunSignature(req, res, next);

            expect(next).toHaveBeenCalledOnce();
            expect(next).toHaveBeenCalledWith(); // Should pass with valid signature
        });
    });
});
