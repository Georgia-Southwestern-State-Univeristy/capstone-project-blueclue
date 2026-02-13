# Database Setup - Testing Checklist

Use this checklist to verify the database consolidation is working correctly.

## Pre-Test Setup

- [ ] PostgreSQL installed and running
- [ ] Know postgres user password
- [ ] Backend dependencies installed (`cd blueclue/backend && npm install`)
- [ ] AI service dependencies installed (`cd blueclue/ai && pip install -r requirements.txt`)

## Test 1: Clean Database Setup

### Run Setup Script
```powershell
cd blueclue/database
.\SETUP.ps1
```

### Expected Output
```
✓ PostgreSQL found
✓ Existing database dropped successfully (or "No existing database to drop")
✓ Database 'blueclue' created successfully
✓ Schema created successfully
✓ Authentication system configured successfully
✓ Sample data loaded successfully
✓ Technicians: 3
✓ Customers: 4
✓ Admins: 1
✓ Categories: 10
✓ Tickets: 0
```

### Verification
- [ ] Script completed without errors
- [ ] 3 technicians created (Thomas, Clayton, Jacob)
- [ ] 4 customers created
- [ ] 1 admin created
- [ ] 10 categories exist
- [ ] 0 tickets exist

## Test 2: Database Structure

### Check Tables
```sql
psql -U postgres -d blueclue
\dt
```

### Expected Tables
- [ ] `users`
- [ ] `categories`
- [ ] `tickets`
- [ ] `ticket_assignments`
- [ ] `ticket_history`
- [ ] `ai_classifications`
- [ ] `guest_sessions`

### Check Users Table Columns
```sql
\d users
```

### Expected Columns
- [ ] `username` (VARCHAR(50) UNIQUE)
- [ ] `is_guest` (BOOLEAN DEFAULT false)
- [ ] `force_password_change` (BOOLEAN DEFAULT false)
- [ ] `user_priority` (ticket_priority)
- [ ] All standard columns (email, password_hash, etc.)

### Check Categories
```sql
SELECT name FROM categories ORDER BY id;
```

### Expected Categories (10)
- [ ] general
- [ ] technical
- [ ] billing
- [ ] account
- [ ] feature_request
- [ ] hardware
- [ ] software
- [ ] network
- [ ] login
- [ ] other

## Test 3: Authentication

### Test Technician Login (Backend Required)

**Start backend:**
```bash
cd blueclue/backend
npm run dev
```

**Login credentials:**
- Username: `tnewc` (or `cmcgo`, `jwill`)
- Password: `admin123`

**Expected:**
- [ ] Login succeeds
- [ ] Prompted to change password
- [ ] After password change, can log in with new password

### Test Customer Login

**Login credentials:**
- Email: `mike.chen@startupxyz.io`
- Password: `BlueClue2026!`

**Expected:**
- [ ] Login succeeds
- [ ] Can access dashboard

### Test Admin Login

**Login credentials:**
- Email: `admin@blueclue.com`
- Password: `BlueClue2026!`

**Expected:**
- [ ] Login succeeds
- [ ] Has admin privileges

## Test 4: AI Classification

### Start Services
```bash
# Terminal 1: Backend
cd blueclue/backend
npm run dev

# Terminal 2: AI Service
cd blueclue/ai
python app.py

# Terminal 3: Frontend
cd blueclue/frontend
npm run dev
```

### Submit Test Ticket

**Go to:** http://localhost:5173 (or your frontend port)

**Login as customer:** mike.chen@startupxyz.io / BlueClue2026!

**Create ticket:**
- Subject: "My computer won't turn on"
- Description: "I pressed the power button but nothing happens. The screen is black."

### Check AI Classification
```sql
SELECT 
    t.ticket_number,
    t.subject,
    t.category,
    t.user_priority,
    a.ai_category,
    a.ai_priority,
    a.confidence,
    a.classified_at
FROM tickets t
LEFT JOIN ai_classifications a ON t.id = a.ticket_id
ORDER BY t.created_at DESC
LIMIT 1;
```

### Expected Results
- [ ] Ticket created successfully
- [ ] `category` should be AI category (likely `hardware`)
- [ ] `ai_classifications` record exists
- [ ] `confidence` score present (0.0 - 1.0)
- [ ] `ai_category` matches AI classifier result
- [ ] `ai_priority` is set (low/medium/high/urgent)

## Test 5: Guest User System

### Submit Guest Ticket

**Go to:** http://localhost:5173 (or your frontend port)

**As guest (not logged in):**
- Email: test.guest@example.com
- Name: Test Guest
- Subject: "Password reset help"
- Description: "I can't remember my password"

### Check Guest User Creation
```sql
SELECT email, first_name, last_name, is_guest, created_at
FROM users
WHERE email = 'test.guest@example.com';
```

### Expected Results
- [ ] Guest user created with `is_guest = true`
- [ ] Ticket submitted successfully
- [ ] Guest can view their ticket by email
- [ ] Guest session warning appears on page navigation

### Test Guest Cleanup
```bash
cd blueclue/backend
npm run cleanup:guests:dry-run
```

### Expected Results
- [ ] Script runs without errors
- [ ] Shows guest users that would be deleted (if any >30 days old with 0 tickets)
- [ ] New guest user NOT listed (too recent)

## Test 6: Reset Database

### Run Setup Again
```powershell
cd blueclue/database
.\SETUP.ps1
```

### Expected Results
- [ ] Old database dropped
- [ ] New database created
- [ ] All data reset (tickets back to 0)
- [ ] Users recreated from seed.sql
- [ ] No errors

## Test 7: Skip Seed Option

### Run Setup Without Sample Data
```powershell
cd blueclue/database
.\SETUP.ps1 -SkipSeed
```

### Check Users
```sql
SELECT COUNT(*) FROM users WHERE role = 'technician';
SELECT COUNT(*) FROM users WHERE role = 'customer';
```

### Expected Results
- [ ] 3 technicians (from auth_setup.sql)
- [ ] 0 customers (seed.sql skipped)
- [ ] 0 admin (seed.sql skipped)

## Test 8: Help System

### Run Help Command
```powershell
.\SETUP.ps1 -Help
```

### Expected Results
- [ ] Help text displayed
- [ ] Usage examples shown
- [ ] Options explained
- [ ] Technician credentials listed

## Troubleshooting

### Issue: "Database already exists"
**Solution:** SETUP.ps1 should drop it automatically. If not, manually drop:
```powershell
psql -U postgres -c "DROP DATABASE IF EXISTS blueclue;"
```

### Issue: "Password authentication failed"
**Solution:** Verify postgres password, set env var:
```powershell
$env:PGPASSWORD = "your_password"
```

### Issue: "AI classification not working"
**Solutions:**
1. Verify AI service is running on port 5000
2. Check backend .env has correct AI_SERVICE_URL
3. Check AI service logs for errors

### Issue: "Guest cleanup deletes too many users"
**Solution:** Use dry-run first, adjust retention period in cleanup script

## Sign-Off

- [ ] All tests passed
- [ ] Database setup works correctly
- [ ] AI classification working
- [ ] Guest system functional
- [ ] Documentation updated
- [ ] Team notified of changes

**Tested by:** _______________  
**Date:** _______________  
**Notes:** _______________
