# Audit Logging & Security Alerts System - Setup & Testing Guide

## Overview
Comprehensive audit logging and security alert system that tracks login attempts, monitors for suspicious activity, and provides operational visibility to admins.

---

## Database Migration

### Run Migration 038
```bash
cd backend
npm run migrate
```

Or manually execute:
```sql
psql -U your_user -d blueclue_db -f database/migrations/038_add_login_audit_and_alerts.sql
```

### What Gets Created:
1. **login_attempts** table - Tracks all authentication attempts
2. **alert_rules** table - Configurable detection rules (6 default rules seeded)
3. **audit_log_health** table - Monitors audit system health
4. **security_alerts** enhancements - Added `rule_id` and `affected_user_id` columns
5. **Triggers** - Auto-detect new IPs and maintain timestamps
6. **Functions** - `update_audit_log_health()` for health monitoring

---

## Features Implemented

### ✅ Login Attempt Tracking
- **All** authentication attempts logged (success & failure)
- Captures: user_id, username, email, IP address, user agent, session_id
- Categorized failure reasons:
  - `account_not_found` - Username/email doesn't exist
  - `account_disabled` - Account exists but is disabled
  - `invalid_credentials` - Wrong password
  - `email_not_verified` - Email login attempted before verification
- Automatic new IP detection per user

### ✅ Configurable Alert Rules
Six default rules seeded (can be modified via API):

1. **repeated_failed_logins** (HIGH)
   - Threshold: ≥5 failed logins in 10 minutes
   - Per user tracking

2. **admin_new_ip** (HIGH)
   - Triggers when admin/management user logs in from new IP
   - Checks within 5-minute window

3. **bulk_ticket_deletion** (CRITICAL)
   - Threshold: ≥10 tickets deleted in 5 minutes
   - Monitors ticket_history table

4. **bulk_user_deletion** (CRITICAL)
   - Threshold: ≥5 users deleted in 5 minutes
   - Monitors privilege_audit_log

5. **excessive_failed_logins_single_ip** (MEDIUM)
   - Threshold: ≥10 failed attempts from single IP
   - Detects brute force attacks across accounts

6. **account_lockout_pattern** (HIGH)
   - Threshold: ≥3 failed logins in 5 minutes
   - Per account tracking for lockout pattern detection

### ✅ Background Jobs
- **Alert Detection**: Runs every 2 minutes
- **Audit Health Update**: Runs every 5 minutes
- Automatically started with server

### ✅ Admin API Endpoints

#### Audit Health
```
GET /api/admin/audit-health
```
Returns:
```json
{
  "success": true,
  "health": [
    {
      "log_type": "login_attempts",
      "last_entry_at": "2025-06-15T14:30:00Z",
      "entry_count_24h": 847,
      "is_healthy": true,
      "time_since_last_entry": "2m ago"
    },
    ...
  ],
  "overall_healthy": true
}
```

#### Alert Rules Management

**Get All Rules**
```
GET /api/admin/alert-rules
```

**Get Specific Rule**
```
GET /api/admin/alert-rules/:id
```

**Create Rule**
```
POST /api/admin/alert-rules
Body: {
  "rule_name": "custom_rule",
  "rule_type": "failed_login",
  "is_enabled": true,
  "severity": "high",
  "parameters": {
    "threshold": 3,
    "window_minutes": 5
  },
  "description": "Custom detection rule"
}
```

**Update Rule** (Change thresholds without code deploy)
```
PATCH /api/admin/alert-rules/:id
Body: {
  "parameters": {
    "threshold": 10,
    "window_minutes": 15
  }
}
```

**Toggle Rule On/Off**
```
PATCH /api/admin/alert-rules/:id/toggle
```

**Delete Rule**
```
DELETE /api/admin/alert-rules/:id
```

#### Security Alerts (Existing endpoints enhanced)
```
GET /api/admin/security-alerts?unresolvedOnly=true
POST /api/admin/security-alerts/:id/resolve
```

---

## Testing Instructions

### 1. Verify Migration Success
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('login_attempts', 'alert_rules', 'audit_log_health');

-- Verify default rules seeded
SELECT rule_name, is_enabled, severity FROM alert_rules;

-- Should see 6 rules
```

### 2. Test Login Attempt Logging

#### Test Failed Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "nonexistent", "password": "wrong"}'
```

#### Verify Logged
```sql
SELECT * FROM login_attempts 
ORDER BY created_at DESC 
LIMIT 5;
```

**Expected**: Entry with `success = false`, `failure_reason = 'account_not_found'`

#### Test Successful Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "actual_user", "password": "correct_password"}'
```

#### Verify Logged
```sql
SELECT * FROM login_attempts 
WHERE success = true 
ORDER BY created_at DESC 
LIMIT 1;
```

**Expected**: Entry with `success = true`, `session_id` populated

### 3. Test New IP Detection

#### First Login from New Device
Login as normal user → Check is_new_ip column:
```sql
SELECT username, ip_address, is_new_ip, created_at 
FROM login_attempts 
WHERE user_id = <your_user_id>
ORDER BY created_at DESC;
```

**Expected**: First login from each IP shows `is_new_ip = true`

#### Admin Login from New IP
Login as admin from new device/IP → Should trigger alert:
```sql
SELECT * FROM security_alerts 
WHERE alert_type = 'admin_new_ip' 
ORDER BY created_at DESC 
LIMIT 1;
```

### 4. Test Failed Login Alert

#### Simulate Repeated Failures
Run 5+ failed logins within 10 minutes:
```bash
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username": "testuser", "password": "wrong123"}';
  sleep 2;
done
```

#### Wait for Detection Job (runs every 2 minutes)
Or manually trigger detection:
```bash
# In backend directory
node -e "import('./src/jobs/alertDetectionJob.js').then(m => m.runManualDetection())"
```

#### Verify Alert Created
```sql
SELECT * FROM security_alerts 
WHERE alert_type = 'repeated_failed_logins' 
ORDER BY created_at DESC 
LIMIT 1;
```

**Expected**: Alert with severity='high', metadata showing failed_count >= 5

### 5. Test Alert Rules API

#### Get All Rules
```bash
curl -X GET http://localhost:3000/api/admin/alert-rules \
  -H "Authorization: Bearer <admin_token>"
```

**Expected**: JSON array of 6 default rules

#### Update Rule Threshold
```bash
curl -X PATCH http://localhost:3000/api/admin/alert-rules/1 \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "parameters": {
      "threshold": 3,
      "window_minutes": 5
    }
  }'
```

**Expected**: Rule updated, future detections use new threshold

#### Disable Rule
```bash
curl -X PATCH http://localhost:3000/api/admin/alert-rules/1/toggle \
  -H "Authorization: Bearer <admin_token>"
```

**Expected**: Rule disabled, detection job skips it

### 6. Test Audit Health Monitoring

#### Get Health Status
```bash
curl -X GET http://localhost:3000/api/admin/audit-health \
  -H "Authorization: Bearer <admin_token>"
```

**Expected Response**:
```json
{
  "success": true,
  "health": [
    {
      "log_type": "login_attempts",
      "last_entry_at": "...",
      "entry_count_24h": 123,
      "is_healthy": true,
      "time_since_last_entry": "2m ago"
    }
  ],
  "overall_healthy": true
}
```

#### Verify Background Job
Check server logs:
```
✅ Alert detection background job started
🔍 Running alert detection checks...
✅ Alert detection checks completed
✅ Audit log health status updated
```

### 7. Test Bulk Deletion Alerts

#### Simulate Bulk Ticket Deletion
Delete 10+ tickets within 5 minutes (as admin):
```sql
-- Mark tickets as deleted in ticket_history
-- (or use actual delete operations via API)
```

#### Wait for Detection Job
Alert should be created in security_alerts table

---

## Frontend Integration (Future Work)

### Admin Dashboard Widgets Needed:

1. **Audit Health Widget**
   - Shows "Last login audit: 2m ago ✅"
   - Green checkmark if healthy, red X if stale
   - Links to detailed health page

2. **Recent Alerts Widget**
   - Shows last 5 unresolved security alerts
   - Click to view details and resolve
   - Badge count of unresolved alerts

3. **Alert Rules Management Page**
   - Table of all alert rules
   - Toggle switches to enable/disable
   - Edit button to modify thresholds
   - Add new custom rule button

### Example API Calls for Frontend:
```javascript
// Get audit health
const response = await fetch('/api/admin/audit-health', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { health, overall_healthy } = await response.json();

// Get alert rules
const rulesResponse = await fetch('/api/admin/alert-rules', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { rules } = await rulesResponse.json();

// Toggle rule
await fetch(`/api/admin/alert-rules/${ruleId}/toggle`, {
  method: 'PATCH',
  headers: { 'Authorization': `Bearer ${token}` }
});
```

---

## Troubleshooting

### Migration Fails
- **Error: relation already exists** → Migration already run, check with `\dt` in psql
- **Error: function does not exist** → Check PostgreSQL version (needs 12+)

### Background Jobs Not Running
- Check server startup logs for "✅ Alert detection background job started"
- Verify node-cron is installed: `npm list node-cron`
- Check for errors in app.js imports

### Alerts Not Being Created
- Verify alert rules are enabled: `SELECT * FROM alert_rules WHERE is_enabled = true;`
- Check login_attempts table has data: `SELECT COUNT(*) FROM login_attempts;`
- Manually run detection: `node -e "import('./src/jobs/alertDetectionJob.js').then(m => m.runManualDetection())"`
- Check for duplicate alert suppression (alerts deduplicated within 1 hour)

### Health Status Shows Unhealthy
- Check when last entry was created: `SELECT MAX(created_at) FROM login_attempts;`
- Update health manually: `SELECT update_audit_log_health();`
- Verify entries exist in monitored tables

---

## Configuration

### Adjust Detection Frequency
Edit [alertDetectionJob.js](../backend/src/jobs/alertDetectionJob.js):
```javascript
// Change from every 2 minutes to every 1 minute
cron.schedule('*/1 * * * *', async () => {
    await runAlertDetection();
});
```

### Adjust Alert Thresholds
Use API or directly in database:
```sql
UPDATE alert_rules 
SET parameters = '{"threshold": 10, "window_minutes": 15}'::jsonb 
WHERE rule_name = 'repeated_failed_logins';
```

### Add Custom Rule Type
1. Add entry to alert_rules table
2. Implement detection logic in alertDetectionService.js
3. Add case in runAlertDetection() to call new function

---

## Acceptance Criteria Met ✅

- ✅ **Admin dashboard shows live confirmation audit logs are being written**
  - GET /api/admin/audit-health returns "last_entry: 2m ago"
  
- ✅ **Alerts triggered for repeated failed logins (≥5 in 10 min)**
  - Default rule #1, runs every 2 minutes
  
- ✅ **Alerts triggered for login from new IP for admin account**
  - Default rule #2, checks all admin/management logins
  
- ✅ **Alerts triggered for bulk record deletions**
  - Default rules #3 and #4 for tickets and users
  
- ✅ **Alerts visible in admin panel**
  - GET /api/admin/security-alerts (existing endpoint)
  
- ✅ **Alert rules configurable without code change**
  - PATCH /api/admin/alert-rules/:id with new parameters JSON
  
- 🎯 **Email notification (stretch goal)**
  - Not implemented yet, can be added by integrating with emailService.js

---

## Database Schema Reference

### login_attempts
```sql
- id (SERIAL PRIMARY KEY)
- user_id (INT, nullable for failed lookups)
- username (VARCHAR 100)
- email (VARCHAR 255)
- attempt_type (VARCHAR 50) - 'username', 'email', 'password_reset', 'token_refresh'
- success (BOOLEAN)
- failure_reason (VARCHAR 100) - 'invalid_credentials', 'account_disabled', etc.
- ip_address (INET)
- user_agent (TEXT)
- country (VARCHAR 100, nullable)
- city (VARCHAR 100, nullable)
- is_new_ip (BOOLEAN DEFAULT FALSE)
- session_id (VARCHAR 255, for successful logins)
- created_at (TIMESTAMPTZ DEFAULT NOW())
```

### alert_rules
```sql
- id (SERIAL PRIMARY KEY)
- rule_name (VARCHAR 100 UNIQUE) - 'repeated_failed_logins', etc.
- rule_type (VARCHAR 50) - 'failed_login', 'new_ip_admin', 'bulk_delete'
- is_enabled (BOOLEAN DEFAULT TRUE)
- severity (VARCHAR 20) - 'low', 'medium', 'high', 'critical'
- parameters (JSONB) - {"threshold": 5, "window_minutes": 10}
- description (TEXT)
- created_by (INT, FK to users)
- updated_by (INT, FK to users)
- created_at, updated_at (TIMESTAMPTZ)
```

### audit_log_health
```sql
- id (SERIAL PRIMARY KEY)
- log_type (VARCHAR 50 UNIQUE) - 'login_attempts', 'privilege_audit', 'ticket_history'
- last_entry_at (TIMESTAMPTZ)
- entry_count_24h (INT)
- is_healthy (BOOLEAN)
- last_check_at (TIMESTAMPTZ)
- notes (TEXT)
```

---

## Performance Considerations

- **Indexes**: Created on login_attempts (user_id, username, email, ip_address, created_at)
- **Detection Queries**: Use time-window filters and HAVING clauses to minimize full table scans
- **Alert Deduplication**: Prevents spam by checking for existing unresolved alerts in past hour
- **Archival**: Consider partitioning login_attempts by date or archiving old entries after 90 days

---

## Security Notes

- All admin endpoints require authentication + admin role
- Login attempt logging is non-blocking (won't fail authentication if logging errors)
- IP addresses stored as INET type for efficient queries
- Alert parameters stored as JSONB for flexibility and indexing
- New IP detection uses trigger for real-time flagging

---

## Next Steps (Optional Enhancements)

1. **Frontend Dashboard Widgets**
   - Audit health status card
   - Recent alerts list
   - Alert rules configuration page

2. **Email Notifications**
   - Integrate with emailService.js
   - Add email_notification_enabled to alert_rules
   - Send critical alerts to admin email list

3. **GeoIP Integration**
   - Add MaxMind or ip-api.com lookup
   - Populate country/city fields
   - Alert on unusual country logins

4. **Alert Resolution Workflow**
   - Require resolution notes
   - Track resolution time metrics
   - Add alert status (new/investigating/resolved)

5. **Advanced Detection Patterns**
   - Time-of-day anomalies
   - User behavior baseline deviation
   - Concurrent session detection
   - Password spray attacks

6. **Audit Log Archival**
   - Partition login_attempts by month
   - Archive to S3/cold storage after 90 days
   - Maintain hot data for 30 days

---

## Support

For issues or questions:
1. Check server logs for error messages
2. Verify database migration completed successfully
3. Test with manual detection: `runManualDetection()`
4. Review alert_rules table for enabled rules
5. Check login_attempts table has recent entries
