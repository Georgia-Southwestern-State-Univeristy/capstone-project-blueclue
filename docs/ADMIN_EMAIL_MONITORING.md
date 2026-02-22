# Email Monitoring & Administration Guide

## Table of Contents
1. [Overview](#overview)
2. [Email Logs Database](#email-logs-database)
3. [Admin API Endpoints](#admin-api-endpoints)
4. [Monitoring & Alerts](#monitoring--alerts)
5. [Common Tasks](#common-tasks)
6. [Troubleshooting](#troubleshooting)

---

## Overview

The BlueClue email monitoring system tracks all email send attempts, providing comprehensive logging, statistics, and alerting capabilities for administrators.

### Key Features
- **Comprehensive Logging**: All email attempts logged to database
- **Statistics Dashboard**: Delivery rates, failure tracking, volume metrics
- **Alert System**: Automated alerts for high failure rates and stuck emails
- **Retention Policy**: Automatic cleanup of old successful email logs (90+ days)
- **Detailed Error Tracking**: Full error messages and retry counts

### Email Types Tracked
- `verification` - Email address verification
- `welcome` - New user welcome message
- `ticket-created` - Ticket submission confirmation
- `ticket-status-changed` - Ticket status update
- `ticket-assigned` - Technician assignment notification
- `password-reset` - Password reset (if implemented)

---

## Email Logs Database

### Table Schema

```sql
CREATE TABLE email_logs (
    id SERIAL PRIMARY KEY,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    email_type VARCHAR(50) NOT NULL,
    subject TEXT NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
    message_id TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `id` | INTEGER | Unique log entry ID |
| `recipient_email` | VARCHAR(255) | Email address of recipient |
| `recipient_user_id` | INTEGER | User ID (if registered user) |
| `email_type` | VARCHAR(50) | Type of email (verification, ticket-created, etc.) |
| `subject` | TEXT | Email subject line |
| `status` | VARCHAR(20) | success, failed, or pending |
| `message_id` | TEXT | SMTP message ID (if successful) |
| `error_message` | TEXT | Error details (if failed) |
| `retry_count` | INTEGER | Number of retry attempts |
| `sent_at` | TIMESTAMP | Timestamp when email was successfully sent |
| `created_at` | TIMESTAMP | Timestamp when log entry was created |
| `metadata` | JSONB | Additional data (ticket_id, token, etc.) |

### Indexes

Six indexes for efficient querying:
- `idx_email_logs_recipient` - Search by recipient email
- `idx_email_logs_user_id` - Search by user ID
- `idx_email_logs_type` - Filter by email type
- `idx_email_logs_status` - Filter by status
- `idx_email_logs_sent_at` - Sort by send time
- `idx_email_logs_created_at` - Sort by creation time

### Status Values

- **`pending`** - Email send attempt initiated but not yet completed
- **`success`** - Email successfully sent via SMTP
- **`failed`** - Email send failed after all retries

### Metadata Examples

```json
// Verification email
{
  "verificationToken": "abc123..."
}

// Ticket created
{
  "ticket_id": 42,
  "priority": "high",
  "category": "Hardware"
}

// Status update
{
  "ticket_id": 42,
  "old_status": "Open",
  "new_status": "In Progress"
}

// Assignment
{
  "ticket_id": 42,
  "assigned_to_name": "John Technician",
  "priority": "high"
}
```

---

## Admin API Endpoints

All endpoints require **authentication** and **admin role**.

### Authentication

Include JWT token in Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

### 1. Get Email Logs

**Endpoint:** `GET /api/admin/email-logs`

**Description:** Retrieve paginated email logs with optional filtering.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number |
| `limit` | integer | No | 50 | Items per page (max 100) |
| `status` | string | No | - | Filter by status (success/failed/pending) |
| `emailType` | string | No | - | Filter by email type |
| `startDate` | string | No | - | Filter by start date (ISO 8601) |
| `endDate` | string | No | - | Filter by end date (ISO 8601) |
| `recipientEmail` | string | No | - | Filter by recipient (partial match) |

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/admin/email-logs?page=1&limit=25&status=failed" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response:**
```json
{
  "status": "success",
  "data": {
    "logs": [
      {
        "id": 123,
        "recipient_email": "user@example.com",
        "recipient_user_id": 5,
        "email_type": "ticket-created",
        "subject": "Ticket #42 Submitted - BlueClue Support",
        "status": "success",
        "message_id": "<abc123@mail.gmail.com>",
        "error_message": null,
        "retry_count": 0,
        "sent_at": "2026-02-22T10:15:30.000Z",
        "created_at": "2026-02-22T10:15:28.000Z",
        "metadata": {
          "ticket_id": 42,
          "priority": "high"
        }
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "pageSize": 25,
      "totalItems": 123
    }
  }
}
```

---

### 2. Get Email Statistics

**Endpoint:** `GET /api/admin/email-stats`

**Description:** Get email delivery statistics and metrics.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `timeRange` | string | No | 24h | Time range (1h, 24h, 7d, 30d, 90d) |

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/admin/email-stats?timeRange=7d" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response:**
```json
{
  "status": "success",
  "data": {
    "timeRange": "7d",
    "summary": {
      "total_emails": 1547,
      "successful": 1512,
      "failed": 35,
      "pending": 0,
      "success_rate": "97.74",
      "types_count": 5
    },
    "byType": [
      {
        "email_type": "ticket-created",
        "total": 823,
        "successful": 820,
        "failed": 3,
        "pending": 0,
        "success_rate": "99.64"
      },
      {
        "email_type": "ticket-status-changed",
        "total": 412,
        "successful": 402,
        "failed": 10,
        "pending": 0,
        "success_rate": "97.57"
      },
      {
        "email_type": "verification",
        "total": 145,
        "successful": 140,
        "failed": 5,
        "pending": 0,
        "success_rate": "96.55"
      }
    ],
    "recentFailures": [
      {
        "id": 5432,
        "recipient_email": "invalid@domain.com",
        "email_type": "verification",
        "subject": "Verify Your Email Address - BlueClue",
        "error_message": "550 5.1.1 User unknown",
        "retry_count": 3,
        "created_at": "2026-02-21T14:32:10.000Z"
      }
    ],
    "hourlyVolume": [
      {
        "hour": "2026-02-22T18:00:00.000Z",
        "count": 45,
        "successful": 44,
        "failed": 1
      },
      {
        "hour": "2026-02-22T17:00:00.000Z",
        "count": 52,
        "successful": 51,
        "failed": 1
      }
    ]
  }
}
```

---

### 3. Get Email Log by ID

**Endpoint:** `GET /api/admin/email-logs/:id`

**Description:** Get detailed information about a specific email log.

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/admin/email-logs/123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response:**
```json
{
  "status": "success",
  "data": {
    "id": 123,
    "recipient_email": "user@example.com",
    "recipient_user_id": 5,
    "email_type": "ticket-assigned",
    "subject": "Ticket #42 Assigned to You - BlueClue Support",
    "status": "success",
    "message_id": "<xyz789@mail.gmail.com>",
    "error_message": null,
    "retry_count": 1,
    "sent_at": "2026-02-22T10:15:32.000Z",
    "created_at": "2026-02-22T10:15:28.000Z",
    "metadata": {
      "ticket_id": 42,
      "assigned_to_name": "Mary Technician",
      "priority": "high"
    }
  }
}
```

---

### 4. Cleanup Old Email Logs

**Endpoint:** `POST /api/admin/email-logs/cleanup`

**Description:** Manually trigger cleanup of old successful email logs (>90 days).

**Example Request:**
```bash
curl -X POST "http://localhost:3000/api/admin/email-logs/cleanup" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response:**
```json
{
  "status": "success",
  "message": "Successfully cleaned up 3,452 old email logs",
  "data": {
    "deletedCount": 3452
  }
}
```

**Note:** This cleanup runs automatically via the `cleanup_old_email_logs()` database function. Manual cleanup is optional.

---

### 5. Get Email Alerts

**Endpoint:** `GET /api/admin/email-alerts`

**Description:** Check for email system alerts (high failure rates, stuck emails).

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/admin/email-alerts" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response - No Alerts:**
```json
{
  "status": "success",
  "data": {
    "hasAlerts": false,
    "alerts": [],
    "lastChecked": "2026-02-22T18:05:30.123Z"
  }
}
```

**Example Response - With Alerts:**
```json
{
  "status": "success",
  "data": {
    "hasAlerts": true,
    "alerts": [
      {
        "severity": "high",
        "type": "high_failure_rate",
        "message": "Email failure rate is 35.71% in the last hour",
        "details": {
          "total": 28,
          "failed": 10,
          "failureRate": 35.71
        }
      },
      {
        "severity": "medium",
        "type": "stuck_pending_emails",
        "message": "3 emails stuck in pending status",
        "details": {
          "count": 3
        }
      }
    ],
    "lastChecked": "2026-02-22T18:05:30.123Z"
  }
}
```

**Alert Types:**

| Type | Severity | Trigger Condition | Action Required |
|------|----------|-------------------|-----------------|
| `high_failure_rate` | high | >20% failure rate in last hour | Check email service configuration |
| `no_emails_sent` | medium | 0 emails in last hour | Verify system is active |
| `stuck_pending_emails` | medium | Pending emails >5 minutes old | Check email service status |

---

### 6. Resend Failed Email

**Endpoint:** `POST /api/admin/email-resend/:id`

**Description:** Resend a specific failed or pending email. The system will reconstruct the email from the stored metadata and attempt to send it again.

**URL Parameters:**
- `id` (required) - Email log ID to resend

**Example Request:**
```bash
curl -X POST "http://localhost:3000/api/admin/email-resend/123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Success Response:**
```json
{
  "status": "success",
  "message": "Email resent successfully",
  "data": {
    "originalLogId": 123,
    "emailType": "ticket-created",
    "recipient": "customer@example.com",
    "resentAt": "2026-02-22T18:30:45.678Z"
  }
}
```

**Example Error Response:**
```json
{
  "status": "error",
  "message": "Cannot resend successful emails"
}
```

**Notes:**
- Only failed or pending emails can be resent
- Successful emails will return a 400 error
- The system reconstructs email content from metadata (ticket_id, tokens, etc.)
- A new log entry will be created for the resend attempt
- Requires admin authentication

---

### 7. Resend Multiple Failed Emails (Bulk)

**Endpoint:** `POST /api/admin/email-resend-bulk`

**Description:** Resend multiple failed or pending emails in bulk based on filter criteria.

**Request Body Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `emailType` | string | No | Filter by email type (verification, ticket-created, etc.) |
| `startDate` | string | No | Start date (ISO 8601 format) |
| `endDate` | string | No | End date (ISO 8601 format) |
| `recipientEmail` | string | No | Filter by recipient email (partial match) |
| `maxEmails` | integer | No | Maximum emails to resend (default: 50) |

**Example Request:**
```bash
curl -X POST "http://localhost:3000/api/admin/email-resend-bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "emailType": "ticket-created",
    "startDate": "2026-02-22T00:00:00.000Z",
    "maxEmails": 25
  }'
```

**Example Response:**
```json
{
  "status": "success",
  "message": "Processed 15 emails",
  "data": {
    "processed": 15,
    "successful": 12,
    "failed": 3,
    "results": [
      {
        "id": 123,
        "recipient": "customer1@example.com",
        "emailType": "ticket-created",
        "status": "success",
        "resentAt": "2026-02-22T18:45:10.123Z"
      },
      {
        "id": 124,
        "recipient": "customer2@example.com",
        "emailType": "ticket-created",
        "status": "failed",
        "error": "SMTP connection timeout"
      }
    ]
  }
}
```

**Example - No Emails Found:**
```json
{
  "status": "success",
  "message": "No failed/pending emails found matching criteria",
  "data": {
    "processed": 0,
    "successful": 0,
    "failed": 0,
    "results": []
  }
}
```

**Important Notes:**
- Only failed and pending emails are processed (successful emails are skipped)
- Maximum 50 emails per request (configurable via `maxEmails`)
- Processes emails in chronological order (oldest first)
- Each email generates a new log entry for the resend attempt
- Use filters to target specific types of failures
- Requires admin authentication

**Common Use Cases:**
1. **Resend all failed verification emails today:**
   ```json
   {
     "emailType": "verification",
     "status": "failed",
     "startDate": "2026-02-22T00:00:00.000Z"
   }
   ```

2. **Resend failed ticket notifications for specific customer:**
   ```json
   {
     "emailType": "ticket-created",
     "recipientEmail": "customer@example.com"
   }
   ```

3. **Resend all pending emails stuck for >5 minutes:**
   ```json
   {
     "endDate": "2026-02-22T18:40:00.000Z"
   }
   ```

---

## Monitoring & Alerts

### Recommended Monitoring Setup

1. **Automated Checks**
   - Poll `/api/admin/email-alerts` every 5-10 minutes
   - Set up alerting when `hasAlerts` is `true`
   - Notify ops team immediately for `high` severity alerts

2. **Daily Statistics Review**
   - Check `/api/admin/email-stats?timeRange=24h` daily
   - Monitor success rate (should be >95%)
   - Review `recentFailures` for patterns

3. **Weekly Deep Dive**
   - Generate 7-day statistics report
   - Analyze failure trends by email type
   - Review hourly volume patterns for capacity planning

### Key Metrics to Monitor

#### Success Rate
- **Target:** >95%
- **Warning:** <90%
- **Critical:** <80%

#### Response Time
- Email logs should appear within 1-2 seconds of send attempt

#### Volume Trends
- Compare hourly volume to historical averages
- Identify anomalies (sudden spikes or drops)

#### Common Failure Patterns
- Invalid email addresses
- Domain delivery issues
- SMTP authentication failures

### Alert Response Procedures

#### High Failure Rate (>20%)

**Immediate Actions:**
1. Check email service is running
2. Verify SMTP credentials in `.env`
3. Test Gmail SMTP connection manually
4. Check Gmail account for security blocks

**Investigation:**
1. Query failed emails: `SELECT * FROM email_logs WHERE status = 'failed' ORDER BY created_at DESC LIMIT 20`
2. Look for common error patterns
3. Check if failures are for specific email domains

**Resolution:**
- Update SMTP credentials if expired
- Contact email provider if account is blocked
- Implement domain-specific retry logic if needed

#### Stuck Pending Emails

**Immediate Actions:**
1. Check if backend server is running
2. Review backend logs for errors
3. Restart email service if necessary

**Investigation:**
1. Query stuck emails: `SELECT * FROM email_logs WHERE status = 'pending' AND created_at < NOW() - INTERVAL '5 minutes'`
2. Check if specific to certain email types
3. Review server resource usage (CPU, memory)

**Resolution:**
- Update stuck emails to 'failed' status
- Implement email queue recovery logic
- Scale server resources if overloaded

#### No Emails Sent

**Possible Causes:**
- No tickets or user activity (normal during off-hours)
- Backend server down
- Email service disabled

**Actions:**
- Verify system is operational
- Check for backend errors
- Confirm email service initialization in logs

---

## Common Tasks

### Query Recent Emails

```sql
-- Last 10 emails sent
SELECT 
    id,
    recipient_email,
    email_type,
    status,
    created_at
FROM email_logs
ORDER BY created_at DESC
LIMIT 10;
```

### Find Failed Emails for a User

```sql
SELECT 
    el.*,
    u.first_name,
    u.last_name
FROM email_logs el
JOIN users u ON el.recipient_user_id = u.id
WHERE u.email = 'user@example.com'
    AND el.status = 'failed'
ORDER BY el.created_at DESC;
```

### Get Delivery Rate by Email Type

```sql
SELECT 
    email_type,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'success') as successful,
    ROUND(
        COUNT(*) FILTER (WHERE status = 'success')::numeric / 
        NULLIF(COUNT(*), 0) * 100,
        2
    ) as success_rate
FROM email_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY email_type
ORDER BY total DESC;
```

### Find Emails with Multiple Retries

```sql
SELECT *
FROM email_logs
WHERE retry_count > 0
ORDER BY retry_count DESC, created_at DESC
LIMIT 20;
```

### Get Hourly Email Volume

```sql
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    email_type,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE status = 'success') as successful,
    COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM email_logs
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY hour, email_type
ORDER BY hour DESC;
```

### Clean Up Test/Dev Emails

```sql
-- Delete logs for test emails (be careful!)
DELETE FROM email_logs
WHERE recipient_email LIKE '%@test.com'
   OR recipient_email LIKE '%@example.com';
```

### Manual Cleanup of Old Logs

```sql
-- Run the cleanup function manually
SELECT cleanup_old_email_logs();
```

---

## Troubleshooting

### High Email Failure Rate

**Symptoms:**
- Many emails with status = 'failed'
- Error messages in `error_message` field

**Common Causes:**

1. **SMTP Authentication Failure**
   ```
   Error: 535-5.7.8 Username and Password not accepted
   ```
   **Solution:** Update `EMAIL_PASS` in `.env` with new Gmail App Password

2. **Gmail Security Block**
   ```
   Error: 534-5.7.9 Please log in via your web browser
   ```
   **Solution:** 
   - Log in to Gmail account
   - Check for security alerts
   - Enable 2FA and create new app password

3. **Rate Limiting**
   ```
   Error: 454 4.7.0 Too many login attempts
   ```
   **Solution:**
   - Wait 15-30 minutes
   - Reduce email send frequency
   - Consider using dedicated email service (SendGrid, AWS SES)

4. **Invalid Recipient**
   ```
   Error: 550 5.1.1 User unknown
   ```
   **Solution:** No action needed - user entered wrong email

### Emails Stuck in Pending

**Symptoms:**
- Email logs with status = 'pending' for >5 minutes
- No corresponding success or failed logs

**Cause:** Email service crashed before completing send attempt

**Solution:**
```sql
-- Mark stuck emails as failed
UPDATE email_logs
SET status = 'failed',
    error_message = 'Email send timeout - service may have crashed'
WHERE status = 'pending'
    AND created_at < NOW() - INTERVAL '10 minutes';
```

### Duplicate Emails Sent

**Symptoms:**
- Users report receiving multiple copies
- Multiple success logs for same email event

**Possible Causes:**
- Backend restarted during send
- Retry logic issue

**Investigation:**
```sql
-- Find potential duplicates
SELECT 
    recipient_email,
    email_type,
    subject,
    DATE_TRUNC('minute', created_at) as minute,
    COUNT(*) as count
FROM email_logs
WHERE status = 'success'
GROUP BY recipient_email, email_type, subject, minute
HAVING COUNT(*) > 1
ORDER BY count DESC;
```

**Solution:** Review and fix retry logic in emailService.js

### No Emails Being Logged

**Symptoms:**
- Email service appears to work
- No entries in email_logs table

**Cause:** Database connection issue in emailService.js

**Check:**
1. Verify pool import: `import pool from '../config/database.js'`
2. Check for errors in backend logs
3. Test database connection:
   ```sql
   SELECT COUNT(*) FROM email_logs;
   ```

**Solution:** Restart backend server and monitor logs

### Performance Issues

**Symptoms:**
- Slow email log queries
- Database high CPU usage

**Solutions:**

1. **Verify Indexes:**
   ```sql
   SELECT indexname, indexdef
   FROM pg_indexes
   WHERE tablename = 'email_logs';
   ```

2. **Regular Cleanup:**
   ```sql
   -- Cleanup more aggressively if table is large
   DELETE FROM email_logs
   WHERE status = 'success'
       AND created_at < NOW() - INTERVAL '30 days';
   ```

3. **Add Partitioning (Advanced):**
   - Partition email_logs by month
   - Automatically drop old partitions

---

## Best Practices

### Retention Policy

- **Successful emails:** Keep for 90 days
- **Failed emails:** Keep indefinitely for debugging
- **Pending emails:** Investigate if >5 minutes old

### Security

- **Limit API Access:** Only admins should access email logs
- **Sanitize Logs:** Don't log sensitive data in metadata
- **Protect SMTP Credentials:** Never expose email password

### Monitoring

- **Set up automated alerts** for failure rate >20%
- **Review statistics weekly** to identify trends
- **Track retry patterns** to optimize retry logic

### Performance

- **Use pagination** when fetching large log sets
- **Filter by date** to reduce query scope
- **Run cleanup regularly** to maintain performance

---

## Future Enhancements

Planned features for email monitoring system:

1. **Resend Failed Emails**
   - Admin endpoint to retry failed email sends
   - Bulk resend capability

2. **Email Templates Management**
   - UI for editing email templates
   - Version control for templates

3. **Advanced Analytics**
   - Delivery time distribution
   - Recipient engagement metrics
   - A/B testing for email templates

4. **Automated Remediation**
   - Auto-retry with exponential backoff
   - Fallback email providers
   - Circuit breaker pattern

5. **Real-time Dashboard**
   - Live email statistics
   - Failure rate graphs
   - Alert notifications

---

## API Testing

### Using curl

```bash
# Set your auth token
TOKEN="your-jwt-token-here"

# Get email logs
curl -X GET "http://localhost:3000/api/admin/email-logs?limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  | json_pp

# Get statistics
curl -X GET "http://localhost:3000/api/admin/email-stats?timeRange=24h" \
  -H "Authorization: Bearer $TOKEN" \
  | json_pp

# Get alerts
curl -X GET "http://localhost:3000/api/admin/email-alerts" \
  -H "Authorization: Bearer $TOKEN" \
  | json_pp
```

### Using Postman

1. Import the BlueClue API collection
2. Set environment variables:
   - `baseUrl`: `http://localhost:3000`
   - `authToken`: Your JWT token
3. Navigate to Admin > Email Logs folder
4. Test each endpoint

---

## Support

For questions or issues with the email monitoring system:

1. **Check this documentation** first
2. **Review backend logs** for error messages
3. **Query email_logs** table for details
4. **Contact the development team** with:
   - Error messages
   - Email log IDs
   - Steps to reproduce

---

*Last updated: February 2026*  
*BlueClue Support System - Admin Guide*
