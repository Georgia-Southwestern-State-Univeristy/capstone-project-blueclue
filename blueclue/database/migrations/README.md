# Database Migrations

This directory contains database migration scripts for the BlueClue ticket system.

## 🎯 Quick Start Guide

### For Fresh Database Setup
**✅ Use `schema.sql` instead** - It includes everything (v2.3.0)

```bash
# From database directory
psql -U postgres -d blueclue -f schema.sql
```

The main `schema.sql` (v2.3.0) includes all features:
- ✅ Core tables (users, tickets, categories, etc.)
- ✅ Ticket comments and templates
- ✅ AI priority influence and configuration
- ✅ Email tracking and thread support
- ✅ Comprehensive spam protection (6 tables)
- ✅ Admin management (allowlist, settings)
- ✅ Notifications and assignment requests
- ✅ Email verification and logging
- ✅ All analytics views and functions

### For Existing Database Upgrades
**Use migration files** if you already have a database from an earlier version:

```bash
# Check your current version
psql -U postgres -d blueclue -c "SELECT * FROM schema_version ORDER BY applied_at DESC LIMIT 1;"

# If you're on version 2.2.0 or earlier, you can rebuild with schema.sql
# Or apply remaining migrations (see below)
```

---

## 📂 Migration Files

**Current Active Migrations:**
- `010_consolidate_missing_tables.sql` - Consolidation migration for upgrading v2.1.0 → v2.2.0

**Note:** Most migrations have been consolidated into `schema.sql` v2.3.0 and moved to the `archive/` folder.

### Archived Migrations (Consolidated into schema.sql v2.3.0)

The following migrations are **now part of the main schema.sql**:

- ✅ `001_add_comments_templates_reopen_tracking*.sql` → Consolidated in v2.2.0
- ✅ `002_add_ai_priority_influence.sql` → Consolidated in v2.3.0
- ✅ `004_add_email_created_flag.sql` → Consolidated in v2.3.0
- ✅ `005_add_email_thread_tracking.sql` → Consolidated in v2.3.0
- ✅ `006_add_spam_protection.sql` → Consolidated in v2.3.0
- ✅ `007_add_admin_management.sql` → Consolidated in v2.3.0
- ✅ `008_add_ticket_assignment_requests.sql` → Consolidated in v2.2.0
- ✅ `009_add_notifications_table.sql` → Consolidated in v2.2.0

**Early Migrations (archived):**
- `archive/001_add_email_verification.sql` → Consolidated in v2.1.0
- `archive/002_add_email_notifications.sql` → Consolidated in v2.1.0
- `archive/003_add_email_logs.sql` → Consolidated in v2.1.0

**Why archived?** For fresh installations, it's simpler to have everything in the main schema. The archived files are kept for:
- Development history and reference
- Understanding incremental feature additions
- Debugging legacy installations

See `archive/README.md` for details on individual archived migrations.

---

## How to Apply Migrations

### Applying a Migration

To upgrade your database, run the migration script using psql:

```bash
psql -U blueclue_user -d blueclue_db -f migrations/001_add_comments_templates_reopen_tracking.sql
```

Or from within psql:

```sql
\i migrations/001_add_comments_templates_reopen_tracking.sql
```

### Rolling Back a Migration

To rollback a migration:

```bash
psql -U blueclue_user -d blueclue_db -f migrations/001_rollback.sql
```

**WARNING:** Rollbacks may result in data loss. Always backup your database before rolling back!

## Migration 001: Comments, Templates, and Reopen Tracking

**Version:** 1.0.0 → 2.0.0  
**Date:** 2026-02-21

### Changes

1. **ticket_comments table**
   - Stores comments and replies on tickets
   - Supports threaded conversations
   - Internal comments for tech-only notes
   - Soft delete capability

2. **ticket_templates table**
   - Predefined templates for common issues
   - Category-based templates
   - Default priority and field mappings
   - JSON-based field configuration

3. **ticket_assignments table (updated)**
   - Changed from single assignment tracking to many-to-many
   - Supports multiple technicians per ticket
   - Primary and assisting roles
   - Unique constraint for active assignments

4. **tickets table (enhanced)**
   - Added `reopen_count` field
   - Added `last_reopened_at` timestamp
   - Extended status enum with 'cancelled' and 'reopened'

### Prerequisites

- Existing schema version 1.0.0 must be installed
- PostgreSQL 12 or higher
- All pending data operations should be completed

### Testing

After applying the migration:

1. Verify schema version:
   ```sql
   SELECT * FROM schema_version ORDER BY applied_at DESC LIMIT 1;
   ```

2. Check new tables exist:
   ```sql
   \dt ticket_comments
   \dt ticket_templates
   ```

3. Verify ticket_status enum:
   ```sql
   SELECT unnest(enum_range(NULL::ticket_status));
   ```

### Rollback Considerations

Rolling back migration 001 will:
- **DELETE all ticket comments** - no recovery possible
- **DELETE all ticket templates** - no recovery possible
- Convert multi-technician assignments to single primary assignment
- Remove reopen tracking data from tickets
- Reset cancelled/reopened tickets to 'open' status

**Always backup before rollback!**

## Best Practices

1. **Backup First**: Always create a database backup before applying migrations
2. **Test on Dev**: Test migrations on development/staging environment first
3. **Read the Script**: Review the migration script before applying
4. **Monitor Performance**: Large migrations may take time on production databases
5. **Plan Downtime**: Schedule migrations during low-traffic periods if possible

## Schema Version Tracking

The `schema_version` table tracks all applied migrations:

```sql
SELECT * FROM schema_version ORDER BY applied_at DESC;
```

### Version History

| Version | Date | Description | Apply Method |
|---------|------|-------------|--------------|
| **2.1.0** | 2026-02-22 | Complete email system (verification, notifications, monitoring) | ✅ In `schema.sql` or archived migrations |
| **2.0.0** | 2026-02-21 | Ticket comments, templates, multi-tech support, reopen tracking | Migration `001_add_comments...` |
| **1.0.0** | 2026-02-02 | Initial BlueClue schema (users, tickets, categories, AI integration) | Original `schema.sql` |

### What's Included in Each Version?

**v2.1.0 (Current)** - Complete Email System
- Email verification (token-based, 24hr expiration)
- Email notification preferences per user
- Email monitoring & logging system (email_logs table)
- Admin email management APIs
- Automatic log cleanup function

**v2.0.0** - Enhanced Ticket Management
- Multi-technician assignments
- Ticket comments with threading
- Ticket templates
- Reopen tracking (count + timestamp)
- Status enum additions (cancelled, reopened)

**v1.0.0** - Core System
- User management with RBAC
- Ticket lifecycle management
- AI classification integration
- Category system
- Notifications framework

---

Expected schema_version table after fresh install with schema.sql v2.1.0:

```sql
SELECT * FROM schema_version ORDER BY applied_at DESC;
```

Expected output after migration 001:
```
 version |        applied_at         |                    description
---------+---------------------------+----------------------------------------------------
 2.0.0   | 2026-02-21 10:30:00+00    | Added ticket_comments, updated ticket_assignments...
 1.0.0   | 2026-02-02 00:00:00+00    | Initial BlueClue database schema
```

## Troubleshooting

### Migration Fails Partway Through

Migrations use transactions (BEGIN/COMMIT) so they're atomic - either everything succeeds or nothing changes.

### Permission Denied Errors

Ensure your database user has sufficient privileges:
```sql
GRANT ALL PRIVILEGES ON DATABASE blueclue_db TO blueclue_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO blueclue_user;
```

### Enum Type Already Exists

If you see "type already exists" errors, the migration may have been partially applied. Check:
```sql
SELECT * FROM schema_version;
```

### Need to Re-run Migration

If a migration was rolled back or failed, you can re-run it. The migration scripts are idempotent where possible.

## Future Migrations

When creating new migrations:
1. Number them sequentially (002, 003, etc.)
2. Include both upgrade and rollback scripts
3. Add entry to this README
4. Test thoroughly before committing
5. Document breaking changes clearly
