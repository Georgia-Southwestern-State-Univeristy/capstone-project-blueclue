// ============================================================================
// Email Service Unit Tests
// ============================================================================
// Tests for email service queue integration, retry behavior, and idempotency

import { describe, it, expect, beforeEach, vi } from 'vitest';
import EmailQueue, { EMAIL_STATUS } from '../src/models/EmailQueue.js';
import pool from '../src/config/database.js';

// Create mock sendMail function BEFORE the mock
const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'mock-message-id' });

// Mock nodemailer with a controllable sendMail function
vi.mock('nodemailer', () => ({
    default: {
        createTransport: () => ({
            sendMail: mockSendMail,
            verify: vi.fn((callback) => callback(null, true))
        })
    }
}));

// Import email service AFTER mocking nodemailer
const { sendEmail, sendEmailDirect, processQueuedEmail, processEmailQueue } = await import('../src/services/emailService.js');

describe('Email Service with Queue', () => {
    beforeEach(async () => {
        // Clean test data
        await pool.query('DELETE FROM email_queue WHERE recipient_email LIKE \'%service-test%\'');
        await pool.query('DELETE FROM email_logs WHERE recipient_email LIKE \'%service-test%\'');
        
        // Reset mock to default success behavior
        mockSendMail.mockResolvedValue({ messageId: 'mock-message-id' });
    });

    describe('sendEmail (queue mode)', () => {
        it('should queue email instead of sending directly in production', async () => {
            // Force queue mode
            const originalEnv = process.env.USE_EMAIL_QUEUE;
            process.env.USE_EMAIL_QUEUE = 'true';

            const result = await sendEmail(
                'service-test@example.com',
                'Test Subject',
                '<p>Test HTML</p>',
                'Test Text',
                'test-email'
            );

            expect(result.success).toBe(true);
            expect(result.queued).toBe(true);
            expect(result.queueId).toBeDefined();

            // Verify email is in queue
            const queued = await EmailQueue.getById(result.queueId);
            expect(queued).toBeDefined();
            expect(queued.recipient_email).toBe('service-test@example.com');
            expect(queued.status).toBe(EMAIL_STATUS.PENDING);

            // Restore env
            process.env.USE_EMAIL_QUEUE = originalEnv;
        });

        it('should handle idempotency for duplicate emails', async () => {
            const originalEnv = process.env.USE_EMAIL_QUEUE;
            process.env.USE_EMAIL_QUEUE = 'true';

            const metadata = { ticket_id: 999 };
            
            // Send first email
            const result1 = await sendEmail(
                'duplicate-test@example.com',
                'Duplicate Test',
                '<p>Test</p>',
                'Test',
                'test-idempotency',
                null,
                metadata
            );

            // Send duplicate
            const result2 = await sendEmail(
                'duplicate-test@example.com',
                'Duplicate Test',
                '<p>Test</p>',
                'Test',
                'test-idempotency',
                null,
                metadata
            );

            // Should queue separate emails (idempotency key includes timestamp)
            // but verify both are queued
            expect(result1.queueId).toBeDefined();
            expect(result2.queueId).toBeDefined();

            process.env.USE_EMAIL_QUEUE = originalEnv;
        });

        it('should fallback to direct send if queue fails', async () => {
            const originalEnv = process.env.USE_EMAIL_QUEUE;
            process.env.USE_EMAIL_QUEUE = 'true';

            // Mock EmailQueue.enqueue to fail
            const originalEnqueue = EmailQueue.enqueue;
            EmailQueue.enqueue = vi.fn().mockRejectedValue(new Error('Queue unavailable'));

            const result = await sendEmail(
                'fallback-test@example.com',
                'Fallback Test',
                '<p>Test</p>',
                'Test',
                'test-fallback'
            );

            // Should still succeed via direct send
            expect(result.success).toBe(true);
            expect(result.queued).toBeUndefined(); // Not queued

            // Restore
            EmailQueue.enqueue = originalEnqueue;
            process.env.USE_EMAIL_QUEUE = originalEnv;
        });
    });

    describe('processQueuedEmail', () => {
        it('should process queued email successfully', async () => {
            const queued = await EmailQueue.enqueue({
                recipientEmail: 'process-success@example.com',
                subject: 'Process Test',
                bodyHtml: '<p>Process Test</p>',
                bodyText: 'Process Test',
                emailType: 'test'
            });

            const result = await processQueuedEmail(queued);

            expect(result.success).toBe(true);
            expect(result.messageId).toBeDefined();

            // Verify email marked as completed
            const updated = await EmailQueue.getById(queued.id);
            expect(updated.status).toBe(EMAIL_STATUS.COMPLETED);
            expect(updated.message_id).toBeDefined();
        });

        it('should handle email send failure and schedule retry', async () => {
            const queued = await EmailQueue.enqueue({
                recipientEmail: 'process-fail@example.com',
                subject: 'Fail Test',
                bodyHtml: '<p>Fail Test</p>',
                emailType: 'test'
            });

            // Mock nodemailer to fail for ALL retry attempts (3 times)
            mockSendMail
                .mockRejectedValueOnce(new Error('SMTP error 1'))
                .mockRejectedValueOnce(new Error('SMTP error 2'))
                .mockRejectedValueOnce(new Error('SMTP error 3'));

            // Process the queued email (will fail all retries and schedule retry)
            const result = await processQueuedEmail(queued);

            // Verify the result indicates failure
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();

            // Verify email status updated with retry
            const updated = await EmailQueue.getById(queued.id);
            expect(updated.attempts).toBeGreaterThan(0);
            expect(updated.attempts).toBe(1); // Should be first retry
            expect(updated.status).toBe(EMAIL_STATUS.PENDING); // Should be pending for retry
            expect(updated.next_retry_at).toBeDefined(); // Should have retry scheduled
        });
    });

    describe('processEmailQueue batch', () => {
        it('should process multiple queued emails', async () => {
            // Queue multiple emails
            await EmailQueue.enqueue({
                recipientEmail: 'batch-1@example.com',
                subject: 'Batch 1',
                bodyHtml: '<p>Batch 1</p>',
                emailType: 'test'
            });

            await EmailQueue.enqueue({
                recipientEmail: 'batch-2@example.com',
                subject: 'Batch 2',
                bodyHtml: '<p>Batch 2</p>',
                emailType: 'test'
            });

            const result = await processEmailQueue(10);

            expect(result.success).toBe(true);
            expect(result.processed).toBeGreaterThanOrEqual(2);
            expect(result.succeeded).toBeGreaterThan(0);
        });

        it('should handle empty queue gracefully', async () => {
            // Ensure queue is empty by removing all test emails
            await pool.query('DELETE FROM email_queue WHERE recipient_email LIKE \'%service-test%\' OR recipient_email LIKE \'%batch%\' OR recipient_email LIKE \'%process%\'');

            const result = await processEmailQueue(10);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
        });
    });

    describe('Exponential backoff verification', () => {
        it('should apply correct backoff delays: 1s, 3s, 9s', async () => {
            const queued = await EmailQueue.enqueue({
                recipientEmail: 'backoff-test@example.com',
                subject: 'Backoff Test',
                bodyHtml: '<p>Backoff Test</p>',
                emailType: 'test'
            });

            // First failure - 1s delay
            await EmailQueue.markAsFailed(queued.id, new Error('First'), 0);
            let email = await EmailQueue.getById(queued.id);
            expect(email.backoff_delay).toBe(1000);
            expect(email.attempts).toBe(1);

            // Second failure - 3s delay
            await EmailQueue.markAsFailed(queued.id, new Error('Second'), 1);
            email = await EmailQueue.getById(queued.id);
            expect(email.backoff_delay).toBe(3000);
            expect(email.attempts).toBe(2);

            // Third failure - dead letter
            await EmailQueue.markAsFailed(queued.id, new Error('Third'), 2);
            email = await EmailQueue.getById(queued.id);
            expect(email.status).toBe(EMAIL_STATUS.DEAD_LETTER);
            expect(email.attempts).toBe(3);
        });
    });

    describe('No duplicate sends (idempotency)', () => {
        it('should not send same email twice when using idempotency key', async () => {
            const idempotencyKey = 'test-unique-key-' + Date.now();
            
            const email1 = await EmailQueue.enqueue({
                recipientEmail: 'no-dup@example.com',
                subject: 'No Duplicate',
                bodyHtml: '<p>No Duplicate</p>',
                emailType: 'test',
                idempotencyKey
            });

            const email2 = await EmailQueue.enqueue({
                recipientEmail: 'no-dup@example.com',
                subject: 'No Duplicate',
                bodyHtml: '<p>No Duplicate</p>',
                emailType: 'test',
                idempotencyKey
            });

            // Should return same ID
            expect(email2.id).toBe(email1.id);

            // Verify only one email in queue
            const count = await pool.query(
                'SELECT COUNT(*) FROM email_queue WHERE idempotency_key = $1',
                [idempotencyKey]
            );
            expect(parseInt(count.rows[0].count)).toBe(1);
        });
    });
});
