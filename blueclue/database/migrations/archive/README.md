# Archived Migration Files

## Purpose

This directory contains **archived migration files** that were used during development but are now **consolidated into the main schema.sql** file for easier deployment.

## Why These Were Archived

During development, email system features were added incrementally through separate migration files:
- `001_add_email_verification.sql` - Added email verification columns to users
- `002_add_email_notifications.sql` - Added email notification preferences
- `003_add_email_logs.sql` - Created email_logs table with monitoring

**These features are now included in schema.sql v2.1.0**, so separate migrations are no longer needed for fresh installations.

## When to Use These Files

### ✅ DO USE if:
- You have an existing database that was set up with an earlier schema version
- You need to understand the incremental development history
- You want to upgrade a production database that doesn't have email features yet

### ❌ DON'T USE if:
- Setting up a fresh database (use schema.sql instead)
- schema.sql v2.1.0+ is already applied

## Applying Archived Migrations

If you need to apply these to an existing database:

```bash
# Check your current schema version
psql -U postgres -d blueclue -c "SELECT * FROM schema_version ORDER BY applied_at DESC LIMIT 1;"

# If you're on v2.0.0 or earlier, apply in order:
psql -U postgres -d blueclue -f archive/001_add_email_verification.sql
psql -U postgres -d blueclue -f archive/002_add_email_notifications.sql
psql -U postgres -d blueclue -f archive/003_add_email_logs.sql

# Then update schema version
psql -U postgres -d blueclue -c "INSERT INTO schema_version (version, description) VALUES ('2.1.0', 'Applied archived email migrations');"
```

## File Contents Summary

### 001_add_email_verification.sql (33 lines)
- Adds `email_verified` BOOLEAN column (default: false)
- Adds `email_verification_token` TEXT column
- Adds `email_verification_expires` TIMESTAMP column
- Sets existing users as verified for backward compatibility

### 002_add_email_notifications.sql (19 lines)
- Adds `email_notifications` BOOLEAN column (default: true)
- Enables notifications for existing users

### 003_add_email_logs.sql (68 lines)
- Creates `email_logs` table with 12 columns
- Adds 6 indexes for performance
- Creates `cleanup_old_email_logs()` function
- Includes comprehensive column comments

## Consolidated Location

All features from these files are now in:
**`../schema.sql`** (starting at v2.1.0)

---

*Archived: February 22, 2026*
*Reason: Consolidated into main schema for simplified deployment*
