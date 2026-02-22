# Privilege Audit Trail System

## Overview

The BlueClue RBAC system includes a comprehensive audit trail that automatically logs all changes to user privileges, category access permissions, and role defaults. This provides complete visibility into who made what changes and when, supporting security, compliance, and troubleshooting.

## Features

✅ **Automatic Logging**: Database triggers capture all changes automatically  
✅ **Complete History**: Stores old and new values for all updates  
✅ **Rich Context**: Includes who made the change, when, and why  
✅ **Query API**: REST endpoints to search and analyze audit logs  
✅ **Admin Only**: Only administrators and management can view audit logs  

## Database Schema

### Table: `privilege_audit_log`

Stores all privilege and access changes across the system.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Unique audit log entry ID |
| table_name | VARCHAR(50) | Which table was modified ('user_privileges', 'category_access', 'role_category_defaults') |
| record_id | INTEGER | ID of the modified record |
| action | VARCHAR(20) | Type of change ('INSERT', 'UPDATE', 'DELETE') |
| user_id | INTEGER | User whose privileges were changed (NULL for role defaults) |
| changed_by | INTEGER | User ID who made the change |
| changed_at | TIMESTAMP | When the change occurred |
| old_values | JSONB | Previous values (for UPDATE/DELETE) |
| new_values | JSONB | New values (for INSERT/UPDATE) |
| notes | TEXT | Optional notes about the change |

### Triggers

Three triggers automatically capture all changes:

1. **audit_user_privileges_trigger** - Logs changes to `user_privileges` table
2. **audit_category_access_trigger** - Logs changes to `category_access` table
3. **audit_role_defaults_trigger** - Logs changes to `role_category_defaults` table

## API Endpoints

All audit endpoints require authentication and admin/management role.

### GET /api/audit/privileges

Get filtered audit log with pagination.

**Query Parameters:**
- `user_id` (optional) - Filter by affected user
- `table_name` (optional) - Filter by table ('user_privileges', 'category_access', 'role_category_defaults')
- `action` (optional) - Filter by action ('INSERT', 'UPDATE', 'DELETE')
- `limit` (optional, default: 100) - Results per page
- `offset` (optional, default: 0) - Pagination offset

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "table_name": "category_access",
      "record_id": 45,
      "action": "INSERT",
      "user_id": 10,
      "changed_by": 1,
      "changed_at": "2026-02-21T10:30:00Z",
      "affected_user": "tnewc",
      "affected_email": "tnewc@blueclue.com",
      "changed_by_username": "admin",
      "changed_by_email": "admin@blueclue.com",
      "old_values": null,
      "new_values": {
        "category_id": 3,
        "access_level": "assign",
        "granted_by": 1
      }
    }
  ],
  "pagination": {
    "total": 250,
    "limit": 100,
    "offset": 0,
    "hasMore": true
  }
}
```

**Example Requests:**
```bash
# Get all privilege changes
GET /api/audit/privileges
Authorization: Bearer <admin-token>

# Get changes for specific user
GET /api/audit/privileges?user_id=10
Authorization: Bearer <admin-token>

# Get only INSERT actions
GET /api/audit/privileges?action=INSERT&limit=50
Authorization: Bearer <admin-token>

# Get category_access changes
GET /api/audit/privileges?table_name=category_access
Authorization: Bearer <admin-token>
```

### GET /api/audit/privileges/user/:userId

Get all audit log entries for a specific user.

**Parameters:**
- `userId` (path) - User ID to get audit history for

**Query Parameters:**
- `limit` (optional, default: 50) - Results per page
- `offset` (optional, default: 0) - Pagination offset

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 125,
      "table_name": "user_privileges",
      "action": "UPDATE",
      "user_id": 10,
      "affected_user": "tnewc",
      "affected_user_fullname": "Thomas Newcomb",
      "changed_by_username": "admin",
      "changed_by_fullname": "System Admin",
      "changed_at": "2026-02-21T14:15:00Z",
      "old_values": {
        "access_level": "edit"
      },
      "new_values": {
        "access_level": "assign"
      }
    }
  ],
  "pagination": {
    "total": 12,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

**Example:**
```bash
# Get audit history for user ID 10
GET /api/audit/privileges/user/10
Authorization: Bearer <admin-token>
```

### GET /api/audit/privileges/recent

Get recent privilege changes (last 24 hours by default).

**Query Parameters:**
- `hours` (optional, default: 24) - How far back to look
- `limit` (optional, default: 100) - Maximum results

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 130,
      "table_name": "category_access",
      "action": "INSERT",
      "affected_user": "mjohnson",
      "changed_by_username": "jdoe",
      "changed_by_fullname": "Jane Doe",
      "changed_at": "2026-02-21T16:00:00Z",
      "new_values": {
        "category_id": 7,
        "access_level": "assign"
      }
    }
  ],
  "timeframe": "Last 24 hours",
  "count": 15
}
```

**Example:**
```bash
# Get changes in last 48 hours
GET /api/audit/privileges/recent?hours=48
Authorization: Bearer <admin-token>

# Get last 50 changes in last 6 hours
GET /api/audit/privileges/recent?hours=6&limit=50
Authorization: Bearer <admin-token>
```

### GET /api/audit/privileges/summary

Get audit statistics and most active administrators.

**Response:**
```json
{
  "success": true,
  "summary": [
    {
      "table_name": "category_access",
      "action": "INSERT",
      "count": "45",
      "last_change": "2026-02-21T16:00:00Z"
    },
    {
      "table_name": "category_access",
      "action": "UPDATE",
      "count": "12",
      "last_change": "2026-02-20T10:30:00Z"
    },
    {
      "table_name": "user_privileges",
      "action": "INSERT",
      "count": "8",
      "last_change": "2026-02-19T14:00:00Z"
    }
  ],
  "mostActiveAdmins": [
    {
      "username": "admin",
      "fullname": "System Admin",
      "change_count": "52"
    },
    {
      "username": "jdoe",
      "fullname": "Jane Doe",
      "change_count": "13"
    }
  ],
  "timeframe": "Last 30 days"
}
```

**Example:**
```bash
# Get audit summary
GET /api/audit/privileges/summary
Authorization: Bearer <admin-token>
```

## Use Cases

### 1. Security Investigation

Track who granted a specific user elevated privileges:

```bash
GET /api/audit/privileges/user/10?limit=100
Authorization: Bearer <admin-token>
```

Look for privilege escalations in the `new_values` field.

### 2. Compliance Reporting

Generate report of all privilege changes in the last quarter:

```bash
# Get all changes with pagination
GET /api/audit/privileges?limit=1000&offset=0
Authorization: Bearer <admin-token>

# Filter to specific time range by checking changed_at in results
```

### 3. Troubleshooting Access Issues

When a user reports they can't access a category, check audit history:

```bash
# Get user's access change history
GET /api/audit/privileges/user/{userId}
Authorization: Bearer <admin-token>

# Look for revoked or downgraded access
```

### 4. Monitor Administrative Activity

See who's making the most privilege changes:

```bash
GET /api/audit/privileges/summary
Authorization: Bearer <admin-token>
```

Review `mostActiveAdmins` to ensure appropriate usage.

### 5. Recent Changes Dashboard

Display recent privilege changes on management dashboard:

```bash
GET /api/audit/privileges/recent?hours=24&limit=20
Authorization: Bearer <admin-token>
```

## Accessing Audit Data

### Via API (Recommended)

Use the REST endpoints above with proper authentication.

### Direct Database Query

For custom reports, query the database directly:

```sql
-- Get all privilege changes for a user
SELECT 
    pal.*,
    u.username,
    cb.username as changed_by_username
FROM privilege_audit_log pal
LEFT JOIN users u ON pal.user_id = u.id
LEFT JOIN users cb ON pal.changed_by = cb.id
WHERE pal.user_id = 10
ORDER BY pal.changed_at DESC;

-- Get changes by a specific admin
SELECT 
    pal.*,
    u.username as affected_user
FROM privilege_audit_log pal
LEFT JOIN users u ON pal.user_id = u.id
WHERE pal.changed_by = 1
ORDER BY pal.changed_at DESC;

-- Summary by table and action
SELECT 
    table_name,
    action,
    COUNT(*) as count,
    MAX(changed_at) as last_change
FROM privilege_audit_log
WHERE changed_at > NOW() - INTERVAL '30 days'
GROUP BY table_name, action
ORDER BY count DESC;
```

## Understanding JSONB Values

The `old_values` and `new_values` columns store complete row data as JSONB.

### Query JSONB Fields

```sql
-- Find all grants of 'assign' access level
SELECT * FROM privilege_audit_log
WHERE new_values->>'access_level' = 'assign'
AND table_name = 'category_access';

-- Find privilege revocations
SELECT * FROM privilege_audit_log
WHERE old_values->>'is_active' = 'true'
AND new_values->>'is_active' = 'false';
```

### Example JSONB Data

**category_access INSERT:**
```json
{
  "id": 45,
  "user_id": 10,
  "category_id": 3,
  "access_level": "assign",
  "granted_by": 1,
  "granted_at": "2026-02-21T10:30:00Z",
  "is_active": true
}
```

**user_privileges UPDATE:**
```json
{
  "old_values": {
    "privilege_type": "category_manage",
    "value": "general,technical",
    "is_active": true
  },
  "new_values": {
    "privilege_type": "category_manage",
    "value": "general,technical,network",
    "is_active": true
  }
}
```

## Access Control

### Who Can View Audit Logs?

Only users with these roles can access audit endpoints:
- **admin** - Full access to all audit data
- **management** - Full access to all audit data

### Authentication Required

All audit endpoints require:
1. Valid JWT token in Authorization header
2. User role of 'admin' or 'management'

### Error Responses

```json
// No token provided
{
  "success": false,
  "message": "No token provided"
}

// Invalid token
{
  "success": false,
  "message": "Invalid or expired token"
}

// Insufficient permissions
{
  "success": false,
  "message": "Access denied. Only administrators and management can view audit logs."
}
```

## Performance Considerations

### Indexing

The audit log table has indexes on:
- `table_name` - Fast filtering by table
- `record_id` - Lookup specific record history
- `user_id` - User-specific queries
- `changed_by` - Admin activity tracking
- `changed_at` - Time-based queries
- `(table_name, record_id)` - Combined lookups

### Retention

Consider implementing a retention policy for old audit data:

```sql
-- Archive audit logs older than 1 year
DELETE FROM privilege_audit_log
WHERE changed_at < NOW() - INTERVAL '1 year';
```

Or create an archive table:

```sql
-- Archive old data
INSERT INTO privilege_audit_log_archive
SELECT * FROM privilege_audit_log
WHERE changed_at < NOW() - INTERVAL '1 year';

DELETE FROM privilege_audit_log
WHERE changed_at < NOW() - INTERVAL '1 year';
```

## Testing the Audit Trail

### 1. Grant Category Access

```bash
# Grant access
POST /api/privileges/category-access
Authorization: Bearer <admin-token>
{
  "user_id": 10,
  "category_id": 3,
  "access_level": "assign"
}

# Check audit log
GET /api/audit/privileges/user/10
Authorization: Bearer <admin-token>

# Should see INSERT action with new_values
```

### 2. Update Role Defaults

```bash
# Modify role default (if endpoint exists)
PUT /api/roles/defaults/:id
Authorization: Bearer <admin-token>

# Check audit log
GET /api/audit/privileges?table_name=role_category_defaults
Authorization: Bearer <admin-token>

# Should see UPDATE action with old and new values
```

### 3. View Recent Changes

```bash
# Make several privilege changes
# Then check recent activity
GET /api/audit/privileges/recent?hours=1
Authorization: Bearer <admin-token>

# Should see all recent changes
```

## Troubleshooting

### Audit Log Not Recording Changes

**Check triggers are enabled:**
```sql
SELECT * FROM pg_trigger
WHERE tgname LIKE 'audit%';
```

**Manually test trigger:**
```sql
-- Insert test record
INSERT INTO category_access (user_id, category_id, access_level, granted_by)
VALUES (10, 1, 'view', 1);

-- Check audit log
SELECT * FROM privilege_audit_log
ORDER BY id DESC LIMIT 1;
```

### JSONB Queries Not Working

Ensure PostgreSQL JSONB support is working:
```sql
SELECT new_values->>'access_level' as access_level
FROM privilege_audit_log
WHERE table_name = 'category_access'
LIMIT 1;
```

### Performance Issues

If audit queries are slow:
1. Check index usage: `EXPLAIN ANALYZE SELECT ...`
2. Consider query optimization
3. Implement data retention/archiving
4. Add more specific indexes if needed

## Best Practices

1. **Regular Review**: Check audit logs weekly for unusual activity
2. **Retention Policy**: Archive logs older than retention requirement
3. **Export for Compliance**: Regularly export audit data for compliance reporting
4. **Monitor Failed Attempts**: Track 403 responses to audit endpoints (potential unauthorized access attempts)
5. **Backup Audit Data**: Include audit logs in database backup strategy
6. **Document Changes**: Encourage admins to add notes when making privilege changes

## Integration with Management Dashboard

The audit endpoints are designed to integrate with a management dashboard:

### Recent Activity Widget
```javascript
// Fetch last 10 changes
const response = await fetch('/api/audit/privileges/recent?limit=10', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { data } = await response.json();
// Display in UI
```

### User Privilege History
```javascript
// Show audit history when viewing user
const response = await fetch(`/api/audit/privileges/user/${userId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { data } = await response.json();
// Display timeline of changes
```

### Audit Statistics
```javascript
// Display summary stats
const response = await fetch('/api/audit/privileges/summary', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { summary, mostActiveAdmins } = await response.json();
// Render charts/graphs
```

## Related Documentation

- [RBAC Default Access Implementation](./rbac-default-access-implementation.md)
- [Technician Hierarchy Implementation](./technician-hierarchy-implementation.md)
- [RBAC Default Access Guide](./rbac-default-access.md)
