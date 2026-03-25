# Email Queue System

## Overview

The email queue system provides reliable, async email delivery with automatic retry logic and exponential backoff. This decouples email sending from API response time and prevents email delivery failures from impacting user experience.

## Features

✅ **Async Processing**: Emails are queued and processed by a background job  
✅ **Automatic Retry**: Failed sends retry up to 3 times with exponential backoff (1s → 3s → 9s)  
✅ **Idempotency**: Prevents duplicate sends using idempotency keys  
✅ **Dead Letter Queue**: Permanently failed emails logged for manual investigation  
✅ **Monitoring**: Queue statistics and dead letter alerts  
✅ **Zero Downtime**: Graceful fallback to direct send if queue unavailable  

## Architecture

```
┌─────────────┐       ┌──────────────┐       ┌─────────────┐
│  API Call   │──────>│ EmailService │──────>│ email_queue │
│ (sendEmail) │       │  (enqueue)   │       │   table     │
└─────────────┘       └──────────────┘       └─────────────┘
                                                     │
                                                     ▼
                                              ┌──────────────┐
                                              │  CRON Job    │
                                              │ (every min)  │
                                              └──────────────┘
                                                     │
                                                     ▼
                                              ┌──────────────┐
                                              │ Send Email   │
                                              │ via SMTP     │
                                              └──────────────┘
                                                     │
                                    ┌────────────────┴────────────────┐
                                    ▼                                 ▼
                            ┌──────────────┐                  ┌─────────────┐
                            │  Completed   │                  │   Failed    │
                            │  (success)   │                  │  (retry)    │
                            └──────────────┘                  └─────────────┘
                                                                     │
                                                                     ▼
                                                              ┌──────────────┐
                                                              │ Exponential  │
                                                              │  Backoff     │
                                                              │ 1s→3s→9s    │
                                                              └──────────────┘
                                                                     │
                                                       ┌─────────────┴─────────────┐
                                                       ▼                           ▼
                                                 ┌──────────┐             ┌──────────────┐
                                                 │  Retry   │             │ Dead Letter  │
                                                 │ (< 3x)   │             │  (3+ fails)  │
                                                 └──────────┘             └──────────────┘
```

## Database Schema

### email_queue Table

```sql
CREATE TABLE email_queue (
    id                  SERIAL PRIMARY KEY,
    recipient_email     VARCHAR(255) NOT NULL,
    recipient_user_id   INTEGER REFERENCES users(id),
    subject             TEXT NOT NULL,
    body_html           TEXT NOT NULL,
    body_text           TEXT,
    template_name       VARCHAR(100),
    email_type          VARCHAR(50) NOT NULL,
    metadata            JSONB DEFAULT '{}',
    
    -- Status tracking
    status              VARCHAR(20) DEFAULT 'pending',
    attempts            INTEGER DEFAULT 0,
    last_attempted_at   TIMESTAMP WITH TIME ZONE,
    
    -- Retry tracking
    next_retry_at       TIMESTAMP WITH TIME ZONE,
    backoff_delay       INTEGER DEFAULT 1000,
    
    -- Result tracking
    message_id          VARCHAR(255),
    error_message       TEXT,
    error_stack         TEXT,
    completed_at        TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Idempotency
    idempotency_key     VARCHAR(255),
    
    CONSTRAINT check_status CHECK (status IN ('pending', 'processing', 'completed', 'dead_letter'))
);
```

### Statuses

- **pending**: Email queued, ready to send
- **processing**: Currently being sent
- **completed**: Successfully delivered
- **dead_letter**: Failed after 3 attempts, requires manual investigation

## Configuration

### Environment Variables

```bash
# Enable queue mode (automatically enabled in production)
USE_EMAIL_QUEUE=true

# Batch size for processing (default: 50)
EMAIL_QUEUE_BATCH_SIZE=50

# Retention period for completed emails in days (default: 30)
EMAIL_QUEUE_RETENTION_DAYS=30
```

### CRON Schedule

- **Email Processing**: Every 1 minute (production) / 30 seconds (development)
- **Cleanup Job**: Daily at 3:00 AM

## Usage

### Sending Emails

All existing email functions automatically use the queue in production:

```javascript
import { sendEmail, sendTicketConfirmation, sendWelcomeEmail } from './services/emailService.js';

// Basic send (automatically queued in production)
await sendEmail(
    'user@example.com',
    'Welcome!',
    '<p>Welcome to BlueClue</p>',
    'Welcome to BlueClue',
    'welcome',
    userId,
    { source: 'registration' }
);

// Specialized functions also use queue
await sendTicketConfirmation('customer@example.com', ticket, userId);
await sendWelcomeEmail('newuser@example.com', 'John', verificationToken, userId);
```

### Direct Send (Bypass Queue)

For critical, time-sensitive emails:

```javascript
import { sendEmailDirect } from './services/emailService.js';

await sendEmailDirect(
    'admin@example.com',
    'Critical Alert',
    '<p>System alert</p>',
    'System alert',
    'alert'
);
```

## Retry Logic

### Exponential Backoff

| Attempt | Delay | Total Time |
|---------|-------|------------|
| 1       | 1s    | 1s         |
| 2       | 3s    | 4s         |
| 3       | 9s    | 13s        |
| 4+      | Dead Letter | - |

After 3 failed attempts, the email is moved to the dead letter queue for manual investigation.

### Error Handling

```javascript
try {
    await processQueuedEmail(queueEntry);
} catch (error) {
    // Automatically logs error, schedules retry, or marks dead letter
    // Errors: SMTP failures, connection timeouts, authentication issues
}
```

## Monitoring

### Queue Statistics

```javascript
import EmailQueue from './models/EmailQueue.js';

const stats = await EmailQueue.getStats();
/*
{
    pending: 12,
    processing: 2,
    completed: 1543,
    dead_letter: 3,
    total: 1560
}
*/
```

### Dead Letter Investigation

```javascript
// Get dead letter emails
const deadLetters = await EmailQueue.getDeadLetters(50);

deadLetters.forEach(email => {
    console.log(`Failed: ${email.recipient_email}`);
    console.log(`Error: ${email.error_message}`);
    console.log(`Stack: ${email.error_stack}`);
});
```

### Manual Retry

```javascript
// Retry a dead letter email after fixing the issue
await EmailQueue.retryDeadLetter(emailId);
```

## Testing

### Run Tests

```bash
# Run all email queue tests
npm test emailQueue

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Test Coverage

- ✅ Email queuing with idempotency
- ✅ Exponential backoff (1s, 3s, 9s)
- ✅ Dead letter after max retries
- ✅ Batch processing
- ✅ Cleanup of old emails
- ✅ Manual retry of dead letters
- ✅ Fallback to direct send

## Migration

### Apply Database Migration

```bash
# Local
psql -U postgres -d blueclue -f blueclue/database/migrations/044_add_email_queue.sql

# Railway
railway run psql -f blueclue/database/migrations/044_add_email_queue.sql
```

### Backward Compatibility

The email queue system is designed for zero-downtime deployment:

1. Migration adds `email_queue` table
2. EmailService detects `USE_EMAIL_QUEUE` environment variable
3. Falls back to direct send if queue unavailable
4. Existing code requires no changes

### Rollback

To disable queue mode:

```bash
# .env
USE_EMAIL_QUEUE=false
```

All emails will send directly without queuing.

## Performance Impact

### Before (Inline Sending)

- API response time: **~500-2000ms** (blocked by SMTP)
- No retry on failure
- Hard failures on SMTP issues

### After (Queue Mode)

- API response time: **~10-50ms** (just database insert)
- Automatic retry with backoff
- Graceful handling of SMTP downtime
- No user-facing errors

### Resource Usage

- **Database**: ~500 bytes per queued email
- **Processing**: ~50-100 emails/minute (configurable)
- **Memory**: Minimal (< 50 MB for 10,000 queued emails)

## Troubleshooting

### Emails Not Sending

```bash
# Check queue status
SELECT status, COUNT(*) FROM email_queue GROUP BY status;

# Check recent failures
SELECT * FROM email_queue 
WHERE status = 'dead_letter' 
ORDER BY created_at DESC 
LIMIT 10;
```

### High Dead Letter Count

Common causes:
- SMTP credentials invalid
- Email server down
- Recipient email bounced
- Content triggering spam filters

Solution:
1. Check `error_message` and `error_stack` columns
2. Fix underlying issue (credentials, server, content)
3. Retry dead letters: `await EmailQueue.retryDeadLetter(id)`

### Queue Backup

If queue grows large:

```sql
-- Check oldest pending
SELECT MIN(created_at) FROM email_queue WHERE status = 'pending';

-- Increase batch size
EMAIL_QUEUE_BATCH_SIZE=100

-- Or run manual processing
node -e "import('./src/services/emailService.js').then(s => s.processEmailQueue(200))"
```

## API Reference

### EmailQueue Model

#### `enqueue(emailData)`
Add email to queue
```javascript
await EmailQueue.enqueue({
    recipientEmail: 'user@example.com',
    recipientUserId: 123,
    subject: 'Test',
    bodyHtml: '<p>Test</p>',
    bodyText: 'Test',
    emailType: 'test',
    metadata: { ticket_id: 456 },
    idempotencyKey: 'unique-key'
});
```

#### `getReadyForProcessing(limit)`
Get emails ready to send
```javascript
const emails = await EmailQueue.getReadyForProcessing(10);
```

#### `markAsCompleted(id, messageId)`
Mark email as successfully sent
```javascript
await EmailQueue.markAsCompleted(queueId, 'smtp-message-id');
```

#### `markAsFailed(id, error, attempts)`
Mark email as failed, schedule retry or dead letter
```javascript
await EmailQueue.markAsFailed(queueId, new Error('SMTP error'), 2);
```

#### `getStats()`
Get queue statistics
```javascript
const stats = await EmailQueue.getStats();
```

#### `retryDeadLetter(id)`
Manually retry a dead letter email
```javascript
await EmailQueue.retryDeadLetter(deadLetterId);
```

#### `cleanupCompleted(daysOld)`
Delete old completed emails
```javascript
await EmailQueue.cleanupCompleted(30); // Delete emails > 30 days old
```

### Email Service

#### `sendEmail(to, subject, html, text, type, userId, metadata)`
Send email (queued in production)

#### `sendEmailDirect(to, subject, html, text, type, userId, metadata)`
Send email immediately, bypass queue

#### `processQueuedEmail(queueEntry)`
Process single queued email

#### `processEmailQueue(batchSize)`
Process batch of queued emails

## Related Issues

- #XXX - Email queue with retry logic
- #XXX - Webhook processing retry

## Support

For issues or questions:
- Check logs: `blueclue/backend/logs/`
- Run diagnostics: `npm run test:email-queue`
- Review dead letters: `SELECT * FROM email_queue WHERE status = 'dead_letter'`
