// ============================================================================
// Email Queue Unit Tests
// ============================================================================
// Tests for email queue functionality including retry logic, exponential backoff,
// and idempotency

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import EmailQueue, { EMAIL_STATUS } from '../src/models/EmailQueue.js';
import pool from '../src/config/database.js';

describe('EmailQueue Model', () => {
    // Clean up test data before each test
    beforeEach(async () => {
        await pool.query('DELETE FROM email_queue WHERE recipient_email LIKE \'%test@example.com%\'');
    });

    afterEach(async () => {
        await pool.query('DELETE FROM email_queue WHERE recipient_email LIKE \'%test@example.com%\'');
    });

    describe('enqueue', () => {
        it('should queue a new email', async () => {
            const emailData = {
                recipientEmail: 'test@example.com',
                recipientUserId: 1,
                subject: 'Test Email',
                bodyHtml: '<p>Test content</p>',
                bodyText: 'Test content',
                emailType: 'test',
                metadata: { test: true }
            };

            const result = await EmailQueue.enqueue(emailData);

            expect(result).toBeDefined();
            expect(result.recipient_email).toBe('test@example.com');
            expect(result.status).toBe(EMAIL_STATUS.PENDING);
            expect(result.attempts).toBe(0);
            expect(result.backoff_delay).toBe(1000); // Initial delay
        });

        it('should enforce idempotency with idempotency key', async () => {
            const emailData = {
                recipientEmail: 'test-idem@example.com',
                subject: 'Test Email',
                bodyHtml: '<p>Test</p>',
                emailType: 'test',
                idempotencyKey: 'unique-test-key-123'
            };

            // Queue first time
            const result1 = await EmailQueue.enqueue(emailData);
            expect(result1.id).toBeDefined();

            // Try to queue again with same key
            const result2 = await EmailQueue.enqueue(emailData);
            
            // Should return same entry
            expect(result2.id).toBe(result1.id);

            // Verify only one entry exists
            const count = await pool.query(
                'SELECT COUNT(*) FROM email_queue WHERE idempotency_key = $1',
                ['unique-test-key-123']
            );
            expect(parseInt(count.rows[0].count)).toBe(1);
        });

        it('should reject email without required fields', async () => {
            const incompleteData = {
                recipientEmail: 'test@example.com',
                subject: 'Test'
                // Missing bodyHtml and emailType
            };

            await expect(EmailQueue.enqueue(incompleteData)).rejects.toThrow();
        });
    });

    describe('getReadyForProcessing', () => {
        it('should return emails ready for processing', async () => {
            // Queue multiple emails
            await EmailQueue.enqueue({
                recipientEmail: 'ready1@example.com',
                subject: 'Test 1',
                bodyHtml: '<p>Test 1</p>',
                emailType: 'test'
            });

            await EmailQueue.enqueue({
                recipientEmail: 'ready2@example.com',
                subject: 'Test 2',
                bodyHtml: '<p>Test 2</p>',
                emailType: 'test'
            });

            const ready = await EmailQueue.getReadyForProcessing(10);
            
            expect(ready.length).toBeGreaterThanOrEqual(2);
            ready.forEach(email => {
                expect(email.status).toMatch(/pending|processing/);
                expect(email.attempts).toBeLessThan(3);
            });
        });

        it('should not return emails with future retry time', async () => {
            // Queue email with future retry time
            const result = await pool.query(
                `INSERT INTO email_queue (
                    recipient_email, subject, body_html, email_type, 
                    status, attempts, next_retry_at, backoff_delay
                ) VALUES ($1, $2, $3, $4, $5, 1, NOW() + INTERVAL '1 hour', 3000)
                RETURNING *`,
                ['future@example.com', 'Test', '<p>Test</p>', 'test', EMAIL_STATUS.PENDING]
            );

            const ready = await EmailQueue.getReadyForProcessing(10);
            
            const futureEmail = ready.find(e => e.recipient_email === 'future@example.com');
            expect(futureEmail).toBeUndefined();
        });

        it('should not return emails with 3+ attempts', async () => {
            // Create email with max attempts
            await pool.query(
                `INSERT INTO email_queue (
                    recipient_email, subject, body_html, email_type, 
                    status, attempts
                ) VALUES ($1, $2, $3, $4, $5, 3)`,
                ['maxed@example.com', 'Test', '<p>Test</p>', 'test', EMAIL_STATUS.PENDING]
            );

            const ready = await EmailQueue.getReadyForProcessing(10);
            
            const maxedEmail = ready.find(e => e.recipient_email === 'maxed@example.com');
            expect(maxedEmail).toBeUndefined();
        });
    });

    describe('markAsCompleted', () => {
        it('should mark email as completed with message ID', async () => {
            const queued = await EmailQueue.enqueue({
                recipientEmail: 'complete@example.com',
                subject: 'Test',
                bodyHtml: '<p>Test</p>',
                emailType: 'test'
            });

            const completed = await EmailQueue.markAsCompleted(queued.id, 'test-message-id-123');

            expect(completed.status).toBe(EMAIL_STATUS.COMPLETED);
            expect(completed.message_id).toBe('test-message-id-123');
            expect(completed.completed_at).toBeDefined();
            expect(completed.error_message).toBeNull();
        });
    });

    describe('markAsFailed with exponential backoff', () => {
        it('should schedule retry on first failure (1s delay)', async () => {
            const queued = await EmailQueue.enqueue({
                recipientEmail: 'fail1@example.com',
                subject: 'Test',
                bodyHtml: '<p>Test</p>',
                emailType: 'test'
            });

            const error = new Error('SMTP connection failed');
            const failed = await EmailQueue.markAsFailed(queued.id, error, 0);

            expect(failed.status).toBe(EMAIL_STATUS.PENDING); // Back to pending for retry
            expect(failed.attempts).toBe(1);
            expect(failed.backoff_delay).toBe(1000); // 1 second
            expect(failed.error_message).toBe('SMTP connection failed');
            
            // Verify next_retry_at is in the future
            const nextRetry = new Date(failed.next_retry_at);
            const now = new Date();
            expect(nextRetry.getTime()).toBeGreaterThan(now.getTime());
            expect(nextRetry.getTime()).toBeLessThanOrEqual(now.getTime() + 2000); // Within 2 seconds
        });

        it('should schedule second retry with 3s delay', async () => {
            const queued = await EmailQueue.enqueue({
                recipientEmail: 'fail2@example.com',
                subject: 'Test',
                bodyHtml: '<p>Test</p>',
                emailType: 'test'
            });

            // First failure
            await EmailQueue.markAsFailed(queued.id, new Error('First fail'), 0);

            // Second failure
            const error = new Error('Second fail');
            const failed = await EmailQueue.markAsFailed(queued.id, error, 1);

            expect(failed.attempts).toBe(2);
            expect(failed.backoff_delay).toBe(3000); // 3 seconds
        });

        it('should schedule third retry with 9s delay', async () => {
            const queued = await EmailQueue.enqueue({
                recipientEmail: 'fail3@example.com',
                subject: 'Test',
                bodyHtml: '<p>Test</p>',
                emailType: 'test'
            });

            // First two failures
            await EmailQueue.markAsFailed(queued.id, new Error('First'), 0);
            await EmailQueue.markAsFailed(queued.id, new Error('Second'), 1);

            // Third failure (should still schedule retry before max attempts)
            const failed = await EmailQueue.markAsFailed(queued.id, new Error('Third'), 2);

            expect(failed.attempts).toBe(3);
            expect(failed.status).toBe(EMAIL_STATUS.DEAD_LETTER); // Max retries exceeded
            expect(failed.error_stack).toBeDefined();
        });

        it('should mark as dead_letter after 3 failures', async () => {
            const queued = await EmailQueue.enqueue({
                recipientEmail: 'deadletter@example.com',
                subject: 'Test',
                bodyHtml: '<p>Test</p>',
                emailType: 'test'
            });

            // Simulate3 failures
            await EmailQueue.markAsFailed(queued.id, new Error('Fail 1'), 0);
            await EmailQueue.markAsFailed(queued.id, new Error('Fail 2'), 1);
            const dead = await EmailQueue.markAsFailed(queued.id, new Error('Fail 3'), 2);

            expect(dead.status).toBe(EMAIL_STATUS.DEAD_LETTER);
            expect(dead.attempts).toBe(3);
            expect(dead.error_message).toBe('Fail 3');
        });
    });

    describe('getStats', () => {
        it('should return accurate queue statistics', async () => {
            // Clear existing test emails
            await pool.query('DELETE FROM email_queue WHERE recipient_email LIKE \'%stats-test%\'');

            // Create emails in different statuses
            await EmailQueue.enqueue({
                recipientEmail: 'stats-test-1@example.com',
                subject: 'Test',
                bodyHtml: '<p>Test</p>',
                emailType: 'test'
            });

            const completed = await EmailQueue.enqueue({
                recipientEmail: 'stats-test-2@example.com',
                subject: 'Test',
                bodyHtml: '<p>Test</p>',
                emailType: 'test'
            });
            await EmailQueue.markAsCompleted(completed.id, 'test-id');

            const stats = await EmailQueue.getStats();

            expect(stats.pending).toBeGreaterThanOrEqual(1);
            expect(stats.completed).toBeGreaterThanOrEqual(1);
            expect(stats.total).toBeGreaterThanOrEqual(2);
        });
    });

    describe('retryDeadLetter', () => {
        it('should reset dead letter email for retry', async () => {
            const queued = await EmailQueue.enqueue({
                recipientEmail: 'retry-dead@example.com',
                subject: 'Test',
                bodyHtml: '<p>Test</p>',
                emailType: 'test'
            });

            // Simulate max failures
            await EmailQueue.markAsFailed(queued.id, new Error('Fail 1'), 0);
            await EmailQueue.markAsFailed(queued.id, new Error('Fail 2'), 1);
            await EmailQueue.markAsFailed(queued.id, new Error('Fail 3'), 2);

            // Verify it's dead letter
            let email = await EmailQueue.getById(queued.id);
            expect(email.status).toBe(EMAIL_STATUS.DEAD_LETTER);

            // Retry it
            const retried = await EmailQueue.retryDeadLetter(queued.id);

            expect(retried.status).toBe(EMAIL_STATUS.PENDING);
            expect(retried.attempts).toBe(0);
            expect(retried.error_message).toBeNull();
            expect(retried.backoff_delay).toBe(1000); // Reset to initial delay
        });

        it('should reject retry on non-dead-letter emails', async () => {
            const queued = await EmailQueue.enqueue({
                recipientEmail: 'not-dead@example.com',
                subject: 'Test',
                bodyHtml: '<p>Test</p>',
                emailType: 'test'
            });

            await expect(EmailQueue.retryDeadLetter(queued.id)).rejects.toThrow();
        });
    });

    describe('cleanupCompleted', () => {
        it('should delete old completed emails', async () => {
            // Create old completed email (modify created_at)
            const result = await pool.query(
                `INSERT INTO email_queue (
                    recipient_email, subject, body_html, email_type, 
                    status, completed_at, created_at
                ) VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '35 days', NOW() - INTERVAL '35 days')
                RETURNING id`,
                ['old-completed@example.com', 'Old', '<p>Old</p>', 'test', EMAIL_STATUS.COMPLETED]
            );

            const oldId = result.rows[0].id;

            // Run cleanup (30 days retention)
            const deleted = await EmailQueue.cleanupCompleted(30);

            expect(deleted).toBeGreaterThanOrEqual(1);

            // Verify old email deleted
            const check = await EmailQueue.getById(oldId);
            expect(check).toBeNull();
        });

        it('should not delete recent completed emails', async () => {
            const queued = await EmailQueue.enqueue({
                recipientEmail: 'recent@example.com',
                subject: 'Recent',
                bodyHtml: '<p>Recent</p>',
                emailType: 'test'
            });

            await EmailQueue.markAsCompleted(queued.id, 'recent-id');

            // Run cleanup
            await EmailQueue.cleanupCompleted(30);

            // Recent email should still exist
            const check = await EmailQueue.getById(queued.id);
            expect(check).toBeDefined();
            expect(check.status).toBe(EMAIL_STATUS.COMPLETED);
        });
    });
});
