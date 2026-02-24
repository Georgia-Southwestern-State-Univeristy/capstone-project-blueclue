# BlueClue Database Setup

**Current Schema Version: 2.3.0 (Fully Consolidated)**

Complete setup guide for the BlueClue PostgreSQL database with AI classification, spam protection, email tracking, and comprehensive ticket management features.

## Prerequisites

- PostgreSQL 14+ installed ([Download](https://www.postgresql.org/download/))
- Know your `postgres` user password

## Quick Setup (Recommended)

### Automated Setup Script

The easiest way to set up the database is using the automated PowerShell script:

```powershell
# Navigate to database folder
cd blueclue/database

# Run setup (drops existing database, creates fresh)
.\SETUP.ps1

# Or skip sample data
.\SETUP.ps1 -SkipSeed

# Or show help
.\SETUP.ps1 -Help
```

**What the script does:**
1. Drops existing `blueclue` database (if exists)
2. Creates fresh `blueclue` database
3. Creates complete schema (tables, ENUMs, indexes, triggers, views)
4. Sets up authentication system (guest sessions, technician accounts)
5. Loads sample data (optional)

## Manual Setup

If you prefer manual control:

```powershell
# Navigate to this folder
cd blueclue/database

# Drop existing database (optional)
psql -U postgres -c "DROP DATABASE IF EXISTS blueclue;"

# Create database
psql -U postgres -c "CREATE DATABASE blueclue;"

# Run schema (tables, ENUMs, triggers)
psql -U postgres -d blueclue -f schema.sql

# Run auth setup (guest sessions, technicians)
psql -U postgres -d blueclue -f auth_setup.sql

# Add sample data (optional)
psql -U postgres -d blueclue -f seed.sql
```

## Verify Setup

```powershell
# Check users
psql -U postgres -d blueclue -c "SELECT COUNT(*) FROM users WHERE role = 'technician';"
# Should show: 3

psql -U postgres -d blueclue -c "SELECT COUNT(*) FROM users WHERE role = 'customer';"
# Should show: 4 (if seed.sql was run)

psql -U postgres -d blueclue -c "SELECT COUNT(*) FROM tickets;"
# Should show: 0 (tickets are created via app)

psql -U postgres -d blueclue -c "SELECT COUNT(*) FROM categories;"
# Should show: 10 (5 original + 5 AI categories)

psql -U postgres -d blueclue -c "SELECT COUNT(*) FROM ticket_templates WHERE is_active = true;"
# Should show: 15 (if seed.sql was run)

psql -U postgres -d blueclue -c "SELECT version FROM schema_version ORDER BY applied_at DESC LIMIT 1;"
# Should show: 2.3.0
# Should show: 2.0.0
```

## What You Get

### Database Files

- **`schema.sql`** - Complete database schema (v2.0.0)
  - All tables, ENUMs, indexes, triggers, views
  - Includes: username, is_guest, force_password_change columns
  - AI categories: hardware, software, network, login, other
  - **NEW:** Ticket comments with threaded replies
  - **NEW:** Ticket templates for common issues
  - **NEW:** Multi-technician assignment (primary/assisting roles)
  - **NEW:** Ticket reopen tracking (reopen_count, last_reopened_at)
  - **NEW:** Extended status enum (cancelled, reopened)
  
- **`auth_setup.sql`** - Authentication system
  - Guest sessions table
  - Technician accounts (Thomas, Clayton, Jacob)
  
- **`seed.sql`** - Sample data (optional)
  - 4 customer users
  - 1 admin user
  - 15 ticket templates (hardware, software, network, login, general)
  - NO pre-created tickets (create via app)

- **`migrations/`** - Database migration scripts
  - `001_add_comments_templates_reopen_tracking.sql` - Upgrade to v2.0.0
  - `001_rollback.sql` - Rollback to v1.0.0
  - `README.md` - Migration documentation

### Technician Accounts

**Username:** `tnewc` / `cmcgo` / `jwill`  
**Password:** `admin123` (must change on first login)  
**Full Names:** Thomas Newcomb, Clayton McGough, Jacob Williams

### Sample Customer Accounts (if seed.sql was run)

**Email:** `mike.chen@startupxyz.io`  
**Password:** `test123`

**Email:** `admin@blueclue.com` (Admin)  
**Password:** `test123`

## Backend Configuration

### 1. Install Dependencies

```bash
cd blueclue/backend
npm install pg dotenv
```

### 2. Configure Environment Variables

Create `blueclue/backend/.env`:

```env
# Database Configuration
DB_USER=postgres
DB_HOST=localhost
DB_NAME=blueclue
DB_PASSWORD=YOUR_POSTGRES_PASSWORD
DB_PORT=5432

# Server Configuration
PORT=3000
NODE_ENV=development

# Security (generate these in production)
JWT_SECRET=your_jwt_secret_key_here
SESSION_SECRET=your_session_secret_here
```

**Important:** Replace `YOUR_POSTGRES_PASSWORD` with your actual PostgreSQL password.

### 3. Start Backend Server

```bash
cd blueclue/backend
npm run dev
```

You should see:
```
✓ Database connected successfully
✓ Database connection test passed: [timestamp]
Server is running on http://localhost:3000
```

### 4. Test Database Connection

Open in browser: http://localhost:3000/api/test-db

Expected response:
```json
{
  "status": "success",
  "message": "Database connection is working!",
  "database": {
    "connected": true,
    "timestamp": "2026-02-02T21:14:58.223Z",
    "tables": {
      "users": 7,
      "tickets": 0,
      "categories": 10
    }
  }
}
```

## Guest User System

BlueClue supports **guest users** who can submit tickets without creating full accounts.

### Guest Features

- Submit tickets by email + name (no password required)
- Short session access (JWT token expires in 1 hour)
- View their own tickets by email
- Session warning when leaving page

### Guest Cleanup

Guest users are automatically cleaned up to prevent database bloat:

```bash
# Dry run (shows what would be deleted)
cd blueclue/backend
npm run cleanup:guests:dry-run

# Execute cleanup (delete guests >30 days old with no tickets)
npm run cleanup:guests

# Force cleanup (delete all guests with no tickets regardless of age)
npm run cleanup:guests:force
```

**Retention Policy:**
- Guests with tickets: **Kept indefinitely**
- Guests without tickets: **Deleted after 30 days**

See [GUEST_CLEANUP_GUIDE.md](GUEST_CLEANUP_GUIDE.md) for full details.

## AI Classification

All new tickets are **automatically classified** by the AI system:

**AI Categories:**
- `hardware` - Physical equipment issues
- `software` - Application/program problems
- `network` - Connectivity and network issues
- `login` - Authentication and access problems
- `other` - General inquiries

**Original Categories (still supported):**
- `general` - General support
- `technical` - Technical issues
- `billing` - Billing and payment
- `account` - Account management
- `feature_request` - Feature requests

**Testing AI Classification:**
1. Start the backend: `cd blueclue/backend && npm run dev`
2. Start the AI service: `cd blueclue/ai && python app.py`
3. Submit a ticket via the frontend
4. Check the `ai_classifications` table for results

## New Features (v2.0.0)

### Ticket Comments

Support for threaded conversations on tickets with internal tech-only notes:

**Features:**
- Public comments visible to all ticket participants
- Internal comments for tech-to-tech communication
- Threaded replies via `parent_comment_id`
- Soft delete capability (comments marked as deleted, not removed)
- User type tracking (client/tech/management)

**Example Query:**
```sql
-- Get all comments for a ticket
SELECT 
    c.id,
    u.first_name || ' ' || u.last_name AS author,
    c.user_type,
    c.content,
    c.is_internal,
    c.created_at
FROM ticket_comments c
JOIN users u ON c.user_id = u.id
WHERE c.ticket_id = 1 
  AND c.deleted_at IS NULL
ORDER BY c.created_at DESC;
```

### Ticket Templates

Predefined templates for common issues to speed up ticket creation:

**Categories Covered:**
- Hardware: Laptop power, printer offline, monitor issues
- Software: Application crashes, installation requests, performance
- Network: Internet connectivity, WiFi drops, VPN problems
- Login: Password resets, account locks, access requests
- General: Inquiries, feature requests

**Example Query:**
```sql
-- Get all active templates for a category
SELECT name, description, default_priority, field_mappings
FROM ticket_templates
WHERE category = 'hardware' AND is_active = true
ORDER BY name;
```

**Field Mappings:**
Templates include JSON field mappings with default values, common solutions, and required information.

### Multi-Technician Assignment

Support for multiple technicians working on the same ticket:

**Roles:**
- **Primary:** Main technician responsible for the ticket
- **Assisting:** Supporting technicians helping with resolution

**Features:**
- Multiple active assignments per ticket
- Role-based assignment tracking
- Assignment history with timestamps
- Assigned by tracking for audit trail

**Example Query:**
```sql
-- Get all technicians assigned to a ticket
SELECT 
    u.first_name || ' ' || u.last_name AS technician,
    ta.role,
    ta.assigned_at,
    assigner.first_name || ' ' || assigner.last_name AS assigned_by
FROM ticket_assignments ta
JOIN users u ON ta.user_id = u.id
LEFT JOIN users assigner ON ta.assigned_by = assigner.id
WHERE ta.ticket_id = 1 
  AND ta.unassigned_at IS NULL
ORDER BY ta.role, ta.assigned_at;
```

### Ticket Reopen Tracking

Track when tickets are reopened after closure:

**Fields Added:**
- `reopen_count` - Number of times ticket has been reopened
- `last_reopened_at` - Timestamp of most recent reopen

**Status Enum Extended:**
- Added `cancelled` - For tickets cancelled by customer or management
- Added `reopened` - For tickets reopened after closure

**Example Query:**
```sql
-- Find frequently reopened tickets
SELECT 
    ticket_number,
    subject,
    reopen_count,
    last_reopened_at
FROM tickets
WHERE reopen_count > 0
ORDER BY reopen_count DESC, last_reopened_at DESC;
```

## Database Migrations

For upgrading from v1.0.0 to v2.0.0, use the migration scripts:

```powershell
# Apply migration (upgrade to v2.0.0)
psql -U postgres -d blueclue -f migrations/001_add_comments_templates_reopen_tracking.sql

# Rollback if needed (back to v1.0.0)
psql -U postgres -d blueclue -f migrations/001_rollback.sql
```

**Important:** Always backup your database before running migrations!

See [migrations/README.md](migrations/README.md) for detailed migration documentation.

## Troubleshooting

**Password authentication failed?**

Set environment variable before running commands:
```powershell
$env:PGPASSWORD = "your_postgres_password"
psql -U postgres -c "CREATE DATABASE blueclue;"
```

**Need to reset database?**

Use the automated script:
```powershell
.\SETUP.ps1
```

Or manually:
```powershell
psql -U postgres -c "DROP DATABASE IF EXISTS blueclue;"
psql -U postgres -c "CREATE DATABASE blueclue;"
psql -U postgres -d blueclue -f schema.sql
psql -U postgres -d blueclue -f auth_setup.sql
psql -U postgres -d blueclue -f seed.sql
```

**No tickets in database?**

This is **intentional**! The new setup doesn't pre-create tickets. Submit tickets via the app to test AI classification with fresh data.

## Database Schema

**Schema Version:** 2.0.0

**Key Features:**
- Automated ticket number generation (TICK-2026-00001)
- AI classification with dual priority system (user_priority + ai_priority)
- Guest user support (is_guest flag)
- Force password change on first login
- Username-based authentication for technicians
- SLA tracking with auto-calculated due dates
- Complete audit trail via triggers
- Performance indexes on all query columns
- **Ticket comments with threaded conversations**
- **Ticket templates with JSON field mappings**
- **Multi-technician assignments (primary/assisting roles)**
- **Reopen tracking with counters and timestamps**

**Core Tables:**
- `users` - All system users (customers, technicians, admins)
- `tickets` - Support tickets with AI classification and reopen tracking
- `ticket_comments` - Comments and replies on tickets
- `ticket_assignments` - Many-to-many technician assignments
- `ticket_templates` - Predefined templates for common issues
- `ticket_history` - Audit trail for all ticket changes
- `categories` - Ticket categories (synchronized with AI)
- `ai_classifications` - AI prediction results
- `notifications` - User notifications
- `guest_sessions` - Guest user session management

**RBAC Tables:**
- `user_privileges` - Granular user permissions
- `category_access` - Category-based access control
- `role_category_defaults` - Default access for roles
- `privilege_types` - Available privilege definitions
- `privilege_audit_log` - Complete RBAC audit trail

**Views:**
- `active_tickets_view` - Open tickets with user info
- `technician_workload_view` - Tickets per technician
- `category_statistics_view` - Category metrics

## Useful Commands

```sql
-- Connect to database
psql -U postgres -d blueclue

-- List all tables
\dt

-- View sample users
SELECT email, first_name, last_name, role, is_guest 
FROM users 
ORDER BY role, created_at;

-- Check categories (should show 10 total)
SELECT id, name FROM categories ORDER BY id;

-- Check guest sessions
SELECT * FROM guest_sessions WHERE expires_at > NOW();

-- View AI classification stats (after submitting tickets)
SELECT 
    ai_classified,
    COUNT(*) as count,
    ROUND(AVG(ai_confidence)::numeric, 2) as avg_confidence
FROM tickets
GROUP BY ai_classified;

-- View ticket templates
SELECT name, category, default_priority, is_active
FROM ticket_templates
WHERE is_active = true
ORDER BY category, name;

-- Get ticket comments for a specific ticket
SELECT 
    u.first_name || ' ' || u.last_name AS author,
    c.user_type,
    c.content,
    c.is_internal,
    c.created_at
FROM ticket_comments c
JOIN users u ON c.user_id = u.id
WHERE c.ticket_id = 1 AND c.deleted_at IS NULL
ORDER BY c.created_at;

-- View multi-technician assignments
SELECT 
    t.ticket_number,
    u.first_name || ' ' || u.last_name AS technician,
    ta.role,
    ta.assigned_at
FROM ticket_assignments ta
JOIN tickets t ON ta.ticket_id = t.id
JOIN users u ON ta.user_id = u.id
WHERE ta.unassigned_at IS NULL
ORDER BY t.ticket_number, ta.role;

-- Check reopened tickets
SELECT 
    ticket_number,
    subject,
    status,
    reopen_count,
    last_reopened_at
FROM tickets
WHERE reopen_count > 0
ORDER BY reopen_count DESC;

-- Check schema version
SELECT * FROM schema_version ORDER BY applied_at DESC;

-- Exit
\q
```

## Files

- **`schema.sql`** - Complete database structure v2.0.0 (tables, indexes, triggers, views)
- **`auth_setup.sql`** - Authentication system (guest sessions, technician accounts)
- **`seed.sql`** - Sample data for testing (customers, admin, templates - NO tickets)
- **`migrations/`** - Database migration scripts
  - `001_add_comments_templates_reopen_tracking.sql` - v1.0.0 → v2.0.0
  - `001_rollback.sql` - v2.0.0 → v1.0.0
  - `README.md` - Migration documentation
- **`SETUP.ps1`** - Automated setup script (Windows) - **Use this!**
- **`GUEST_CLEANUP_GUIDE.md`** - Guest user cleanup documentation
- **`README.md`** - This file

---

**Questions?** See the full documentation in `docs/` or ask your team lead.
