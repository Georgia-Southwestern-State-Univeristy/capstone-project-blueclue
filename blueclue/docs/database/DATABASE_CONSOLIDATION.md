# Database Consolidation Guide

**🎉 Status: FULLY CONSOLIDATED (v2.3.0) - All migrations integrated into schema.sql**

## Overview
This document describes the database file consolidation completed on February 24, 2026. All table definitions, functions, and views have been fully consolidated into the main `schema.sql` file (version 2.3.0), while maintaining separate utility and seed data files.

---

## 📋 Consolidated Schema (schema.sql)

The `schema.sql` file now contains **ALL** table definitions needed for the BlueClue system:

### Core Tables
- **users** - User accounts and authentication
- **categories** - Ticket categories
- **tickets** - Support tickets with AI classification
- **ticket_assignments** - Ticket assignment tracking
- **ticket_history** - Audit trail for ticket changes
- **ticket_comments** - Comments on tickets
- **ticket_templates** - Reusable ticket templates
- **ai_classifications** - AI classification results

### Authentication & Security
- **refresh_tokens** ✨ *(consolidated from auth_setup.sql)*
  - JWT refresh tokens for secure authentication
  - Includes cleanup function for expired tokens

### Notifications & Requests
- **notifications** ✨ *(added - was missing)*
  - User notifications for assignments, mentions, etc.
  
- **ticket_assignment_requests** ✨ *(consolidated from migration 008)*
  - Technician requests to be assigned to tickets
  - Management/admin approval workflow

### AI Configuration & Analytics
- **ai_configuration** ✨ *(consolidated from migration 002)*
  - AI system configuration and admin settings
  - Priority weights and thresholds

- **priority_overrides** ✨ *(consolidated from migration 002)*
  - Tracks AI priority recommendation overrides
  - Analytics for AI vs human decision-making

- **email_logs**
  - Email delivery tracking and error logging

### Email & Spam Protection ✨ *(consolidated from migrations 006 & 007)*
- **email_spam_logs** - Audit log of all inbound emails with spam analysis
- **email_rate_limits** - Rate limiting per email address (10/day default)
- **domain_blacklist** - Blocked spam domains
- **domain_allowlist** - Trusted domains bypassing spam filters
- **email_verification_challenges** - Verification for suspicious senders
- **spam_keywords** - Configurable spam detection patterns
- **security_alerts** - Security monitoring and incident response
- **system_settings** - Global system configuration

### RBAC (Role-Based Access Control)
- **privilege_types** - System privilege definitions
- **user_privileges** - User-specific privileges
- **category_access** - Category-level access control
- **role_category_defaults** - Default category access by role

### Metadata
- **schema_version** - Tracks schema version and migrations
  - Current version: **2.3.0** (fully consolidated)

---

## 📁 File Organization

### Main Schema
| File | Purpose | When to Use |
|------|---------|-------------|
| `schema.sql` | **Complete database schema** | Fresh installations, full database rebuild |
| `seed.sql` | Initial data (categories, privileges, etc.) | After running schema.sql |

### Migrations
| File | Purpose | Status |
|------|---------|--------|
| `migrations/001_*.sql` | Add comments, templates, reopen tracking | ✅ Consolidated (v2.2.0) - archived |
| `migrations/002_*.sql` | AI priority influence & configuration | ✅ Consolidated (v2.3.0) - **archived** |
| `migrations/004_*.sql` | Email created flag on users | ✅ Consolidated (v2.3.0) - **archived** |
| `migrations/005_*.sql` | Email thread tracking on tickets | ✅ Consolidated (v2.3.0) - **archived** |
| `migrations/006_*.sql` | Spam protection (6 tables) | ✅ Consolidated (v2.3.0) - **archived** |
| `migrations/007_*.sql` | Admin management (allowlist, settings) | ✅ Consolidated (v2.3.0) - **archived** |
| `migrations/008_*.sql` | Ticket assignment requests | ✅ Consolidated (v2.2.0) - archived |
| `migrations/009_*.sql` | Notifications table | ✅ Consolidated (v2.2.0) - archived |
| `migrations/010_*.sql` | Consolidation migration for v2.2.0 | Optional (for existing DBs) |

### Utility Scripts (Keep Separate)
| File | Purpose | When to Use |
|------|---------|-------------|
| `auth_setup.sql` | Creates hardcoded tech accounts | After schema.sql to add default technicians |
| `create_manager_account.sql` | Creates manager account | When you need a manager user |
| `fix_admin_password.sql` | Resets admin password | Password recovery for admin |
| `sample_data.sql` | Test data for development | Development/testing only |
| `verify_migration.sql` | Verifies migration success | After running migrations |

### Documentation
| File | Purpose |
|------|---------|
| `README.md` | Main database documentation |
| `QUICK_REFERENCE.md` | Quick reference guide |
| `CHANGELOG.md` | Version history |
| `SCHEMA_EXTENSION_SUMMARY.md` | Extension details |
| `TESTING_CHECKLIST.md` | Testing procedures |
| `DATABASE_CONSOLIDATION.md` | This file |

---

## 🚀 Setup Instructions

### Fresh Installation

```powershell
# 1. Navigate to database directory
cd C:\BlueClue\capstone-project-blueclue\capstone-project-blueclue\blueclue\database

# 2. Create database (if needed)
createdb -U postgres blueclue

# 3. Run consolidated schema
psql -U postgres -d blueclue -f schema.sql

# 4. Load seed data
psql -U postgres -d blueclue -f seed.sql

# 5. (Optional) Add hardcoded technician accounts
psql -U postgres -d blueclue -f auth_setup.sql

# 6. (Optional) Create manager account
psql -U postgres -d blueclue -f create_manager_account.sql

# 7. (Optional) Load sample test data
psql -U postgres -d blueclue -f sample_data.sql
```

### Verify Installation

```powershell
psql -U postgres -d blueclue -f verify_migration.sql
```

---

## 📊 What Changed

### Version 2.3.0 - Full Consolidation (February 24, 2026)

#### Tables Added to schema.sql
1. **ai_configuration** *(from migration 002)*
   - AI system configuration and admin settings
   - Priority weight configuration

2. **email_spam_logs** *(from migration 006)*
   - Comprehensive spam analysis and audit trail
   - SPF/DKIM authentication results

3. **email_rate_limits** *(from migration 006)*
   - Rate limiting per email address
   - Daily ticket creation tracking

4. **domain_blacklist** *(from migration 006)*
   - Blocked spam domains
   - Usage tracking

5. **domain_allowlist** *(from migration 007)*
   - Trusted domains bypassing spam filters
   - Hit count tracking

6. **email_verification_challenges** *(from migration 006)*
   - Verification system for suspicious senders
   - Challenge token management

7. **spam_keywords** *(from migration 006)*
   - Configurable spam detection patterns
   - Weighted scoring system

8. **security_alerts** *(from migration 006)*
   - Security monitoring and incident response
   - Admin alert management

9. **system_settings** *(from migration 007)*
   - Global system configuration
   - Test mode and threshold settings

#### Columns Added
- **users.email_created** *(from migration 004)*
  - Tracks accounts created via email submission
  
- **tickets.email_message_id** *(from migration 005)*
  - Email thread tracking for reply-to-update
  
- **tickets.ai_recommended_priority** *(from migration 002)*
  - Original AI recommendation before override
  
- **tickets.priority_overridden** *(from migration 002)*
  - Flag for user overrides
  
- **tickets.priority_override_reason** *(from migration 002)*
  - Reason for override
  
- **tickets.priority_calculation_method** *(from migration 002)*
  - Calculation methodology tracking

#### Functions Added
- **update_ai_configuration_updated_at()** *(from migration 002)*
  - Auto-update timestamp trigger
  
- **reset_daily_rate_limits()** *(from migration 006)*
  - Midnight rate limit counter reset
  
- **cleanup_expired_challenges()** *(from migration 006)*
  - Remove expired verification challenges
  
- **increment_allowlist_hit_count()** *(from migration 007)*
  - Track allowlist domain usage
  
- **get_system_setting()** *(from migration 007)*
  - Retrieve system configuration values

#### Views Added
- **v_priority_analytics** *(from migration 002)*
  - AI override analytics and confidence tracking
  
- **v_ai_priority_accuracy** *(from migration 002)*
  - Resolution time and accuracy metrics
  
- **admin_email_dashboard** *(from migration 007)*
  - Daily email statistics and monitoring

#### Default Data Inserted
- AI configuration defaults (priority weights, analytics settings)
- Spam keyword patterns (pharmacy, financial, phishing, etc.)
- Domain blacklist (temporary email services)  
- Domain allowlist (trusted domains)
- System settings (spam thresholds, rate limits)

### Version 2.2.0 - Initial Consolidation

#### Tables Added to schema.sql
1. **refresh_tokens** *(from auth_setup.sql)*
   - JWT refresh tokens for secure authentication
   - Includes indexes and cleanup function

2. **ticket_assignment_requests** *(from migration 008)*
   - Technician self-assignment requests
   - Management approval workflow

3. **priority_overrides** *(from migration 002)*
   - AI priority override tracking
   - Analytics indexes

4. **notifications** *(was missing)*
   - User notification system
   - Assignment and mention tracking

5. **request_status enum**
   - Added for ticket assignment request workflow

### What Remains Separate
- **auth_setup.sql** - Contains INSERT statements for hardcoded users
  - Reason: Seed data, not schema definition
  
- **create_manager_account.sql** - Utility script
  - Reason: One-time operation, not always needed
  
- **fix_admin_password.sql** - Maintenance script
  - Reason: Recovery/utility, not schema
  
- **sample_data.sql** - Test data only
  - Reason: Development/testing, not production
  
- **Migration files** - Historical record
  - Reason: Track incremental changes, audit trail

---

## ✅ Benefits of Consolidation

1. **Single Source of Truth**
   - All table definitions in one place
   - Easier to understand complete schema

2. **Simpler Fresh Installs**
   - One file creates entire database
   - No need to track which migrations to run

3. **Better Documentation**
   - Complete schema with comments
   - Clear separation of schema vs data

4. **Reduced Errors**
   - Missing table definitions now caught
   - All indexes and constraints defined

5. **Easier Maintenance**
   - Update schema.sql for new tables
   - Migrations for incremental changes only

---

## 🔄 Future Changes

### Adding New Tables
1. Add table definition to `schema.sql`
2. Add DROP statement at top of file
3. Update schema version
4. Create migration file for existing databases

### Modifying Existing Tables
1. Create new migration file
2. Document change in CHANGELOG.md
3. Eventually consolidate into schema.sql for next major version

---

## 📝 Schema Version

- **Current Version**: 2.2.0
- **Previous Version**: 2.1.0
- **Changes**: Consolidated refresh_tokens, ticket_assignment_requests, priority_overrides, and notifications

---

## 🎯 Key Takeaways

✅ **schema.sql** = All table definitions  
✅ **seed.sql** = Initial required data  
✅ **auth_setup.sql** = Optional user seeding  
✅ **Migrations** = Historical changes (for existing databases)  
✅ **Utility scripts** = One-time operations  

---

## Questions?

If you encounter issues after consolidation:
1. Check that you're using the latest `schema.sql`
2. Verify all migrations were applied: `SELECT * FROM schema_version;`
3. Run verification script: `psql -U postgres -d blueclue -f verify_migration.sql`

For a fresh install, you only need:
- `schema.sql` (required)
- `seed.sql` (required)
- `auth_setup.sql` (optional, for default tech accounts)

---

**Last Updated**: February 24, 2026  
**Schema Version**: 2.2.0  
**Status**: ✅ Consolidated
