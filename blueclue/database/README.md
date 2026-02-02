# BlueClue Database Setup

Quick setup guide for the BlueClue PostgreSQL database.

## Prerequisites

- PostgreSQL 14+ installed ([Download](https://www.postgresql.org/download/))
- Know your `postgres` user password

## Quick Setup

### 1. Create Database

```powershell
# Navigate to this folder
cd blueclue/database

# Create database
psql -U postgres -c "CREATE DATABASE blueclue;"

# Run schema
psql -U postgres -d blueclue -f schema.sql

# Add sample data
psql -U postgres -d blueclue -f seed.sql
```

### 2. Verify

```powershell
psql -U postgres -d blueclue -c "SELECT COUNT(*) FROM users;"
# Should show: 6

psql -U postgres -d blueclue -c "SELECT COUNT(*) FROM tickets;"
# Should show: 10
```

## What You Get

**Tables:**
- `users` - 6 sample users (3 customers, 2 technicians, 1 admin)
- `tickets` - 10 sample tickets with AI classifications
- `categories` - 5 ticket categories
- `ticket_assignments` - Assignment history
- `ticket_history` - Audit log

**Sample Login (Password: `BlueClue2026!`):**
- Customer: `sarah.johnson@techcorp.com`
- Technician: `david.park@blueclue.com`
- Admin: `admin@blueclue.com`

## Backend Configuration

Create `blueclue/backend/.env`:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/blueclue
PORT=3000
NODE_ENV=development
```

Install dependencies:

```bash
cd blueclue/backend
npm install pg dotenv
```

## Troubleshooting

**Password authentication failed?**

Set environment variable before running commands:
```powershell
$env:PGPASSWORD = "your_postgres_password"
psql -U postgres -c "CREATE DATABASE blueclue;"
```

**Need to reset database?**

```powershell
psql -U postgres -c "DROP DATABASE blueclue;"
psql -U postgres -c "CREATE DATABASE blueclue;"
psql -U postgres -d blueclue -f schema.sql
psql -U postgres -d blueclue -f seed.sql
```

## Database Schema

**Key Features:**
- Automated ticket number generation (TICK-2026-00001)
- AI classification metadata (confidence, keywords, fallback)
- SLA tracking with auto-calculated due dates
- Complete audit trail via triggers
- Performance indexes on all query columns

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

-- View sample tickets
SELECT ticket_number, subject, category, priority, status 
FROM tickets 
ORDER BY created_at DESC 
LIMIT 5;

-- Check AI classification stats
SELECT 
    ai_classified,
    COUNT(*) as count,
    ROUND(AVG(ai_confidence)::numeric, 2) as avg_confidence
FROM tickets
GROUP BY ai_classified;

-- Exit
\q
```

## Files

- `schema.sql` - Complete database structure (tables, indexes, triggers, views)
- `seed.sql` - Sample data for testing and demos
- `README.md` - This file
- `SETUP.ps1` - Automated setup script (Windows)

---

**Questions?** See the full documentation in `docs/database/` or ask your team lead.
