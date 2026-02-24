# Guest User Cleanup Guide

## Overview
This guide explains how guest users are managed and cleaned up in the BlueClue system.

## Guest User Lifecycle

### 1. Guest Login
- User enters email and name (no password)
- System creates temporary session (24-hour expiration)
- Session stored in `guest_sessions` table

### 2. Guest Ticket Submission
- If guest doesn't exist: Create user record with `is_guest = true`
- If guest exists: Reuse existing user record
- Ticket linked to guest user's `customer_id`

### 3. Session Expiry
- After 24 hours, session token expires
- User can login again with same email
- Previous tickets remain visible

### 4. Periodic Cleanup (Automated)
- Runs daily/weekly via scheduled task
- Deletes guest users meeting ALL criteria:
  - `is_guest = true`
  - Created more than 30 days ago
  - Has ZERO tickets
- Guest users WITH tickets are NEVER deleted

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    is_guest BOOLEAN DEFAULT false,  -- Marks guest users
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- ... other fields
);
```

### Guest Sessions Table
```sql
CREATE TABLE guest_sessions (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    session_token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Running Cleanup Manually

### Step 1: Apply Database Migration
```bash
# Navigate to database directory
cd blueclue/database

# Apply migration to add is_guest column
psql -U postgres -d blueclue < add_is_guest_column.sql
```

### Step 2: Test Cleanup (Dry Run)
```bash
# Navigate to backend directory
cd blueclue/backend

# Preview what would be deleted (no actual changes)
node scripts/cleanup-guest-users.js --dry-run
```

### Step 3: Run Cleanup
```bash
# Delete inactive guest users (default: 30 days)
node scripts/cleanup-guest-users.js

# Delete guest users older than 60 days
node scripts/cleanup-guest-users.js --days=60
```

## Scheduling Automated Cleanup

### Windows (Task Scheduler)

1. Open Task Scheduler
2. Create Basic Task:
   - Name: "BlueClue Guest Cleanup"
   - Trigger: Daily at 2:00 AM
   - Action: Start a program
   - Program: `node`
   - Arguments: `C:\path\to\blueclue\backend\scripts\cleanup-guest-users.js`
   - Start in: `C:\path\to\blueclue\backend`

### Linux/Mac (Cron)

```bash
# Edit crontab
crontab -e

# Add line to run daily at 2 AM
0 2 * * * cd /path/to/blueclue/backend && node scripts/cleanup-guest-users.js >> /var/log/blueclue-cleanup.log 2>&1
```

### Using npm script

Add to `package.json`:
```json
{
  "scripts": {
    "cleanup:guests": "node scripts/cleanup-guest-users.js",
    "cleanup:guests:dry-run": "node scripts/cleanup-guest-users.js --dry-run"
  }
}
```

Then run:
```bash
npm run cleanup:guests:dry-run  # Preview
npm run cleanup:guests           # Execute
```

## Cleanup Logic

### What Gets Deleted:
✅ Guest users with `is_guest = true`  
✅ Created > 30 days ago  
✅ Have ZERO tickets  
✅ Associated guest sessions  

### What's Protected:
❌ Guest users WITH tickets (preserved indefinitely)  
❌ Regular authenticated users  
❌ Guest users created within 30 days  

## Monitoring

### View Guest User Statistics
```sql
-- Total guest users
SELECT COUNT(*) FROM users WHERE is_guest = true;

-- Guest users with tickets
SELECT COUNT(DISTINCT u.id) 
FROM users u
INNER JOIN tickets t ON t.customer_id = u.id
WHERE u.is_guest = true;

-- Guest users eligible for cleanup
SELECT COUNT(*) 
FROM users u
LEFT JOIN tickets t ON t.customer_id = u.id
WHERE u.is_guest = true
  AND u.created_at < NOW() - INTERVAL '30 days'
GROUP BY u.id
HAVING COUNT(t.id) = 0;
```

### View Cleanup Candidates
```sql
SELECT 
    u.id,
    u.email,
    u.created_at,
    COUNT(t.id) as ticket_count,
    EXTRACT(DAY FROM NOW() - u.created_at) as days_old
FROM users u
LEFT JOIN tickets t ON t.customer_id = u.id
WHERE u.is_guest = true
  AND u.created_at < NOW() - INTERVAL '30 days'
GROUP BY u.id, u.email, u.created_at
HAVING COUNT(t.id) = 0
ORDER BY u.created_at DESC;
```

## Best Practices

1. **Always test with --dry-run first**
   ```bash
   node scripts/cleanup-guest-users.js --dry-run
   ```

2. **Monitor cleanup logs**
   - Review what's being deleted
   - Check for unexpected patterns

3. **Adjust retention period as needed**
   ```bash
   # More aggressive (14 days)
   node scripts/cleanup-guest-users.js --days=14
   
   # More conservative (90 days)
   node scripts/cleanup-guest-users.js --days=90
   ```

4. **Keep tickets forever**
   - Guest users WITH tickets are never deleted
   - Support team always has access to ticket history

5. **Database backups**
   - Regular backups before cleanup
   - Ability to restore if needed

## Troubleshooting

### Cleanup Not Running
- Check database connection in `.env`
- Verify `is_guest` column exists
- Check user has delete permissions

### Too Many Guest Users
- Reduce retention period: `--days=14`
- Run cleanup more frequently
- Review guest login patterns

### Guest Can't See Old Tickets
- Check if user was accidentally deleted
- Verify email matches exactly
- Check guest_sessions expiration

## Security Considerations

- ✅ Guest sessions expire after 24 hours
- ✅ No password required (can't login as regular user)
- ✅ Inactive guests cleaned up automatically
- ✅ Tickets preserved for support purposes
- ✅ Guest users clearly marked in database
