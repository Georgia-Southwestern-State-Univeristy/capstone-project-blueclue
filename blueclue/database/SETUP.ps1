# ============================================================================
# BlueClue Database Complete Setup Script
# ============================================================================
# This script provides a comprehensive database setup for BlueClue
# Run this to create a fresh database with all required tables and data
# ============================================================================

param(
    [switch]$SkipSeed,
    [switch]$Help
)

if ($Help) {
    Write-Host ""
    Write-Host "BlueClue Database Setup Script" -ForegroundColor Cyan
    Write-Host "==============================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\SETUP.ps1 [-SkipSeed] [-Help]" -ForegroundColor White
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -SkipSeed    Skip loading sample data (customers, admin)" -ForegroundColor White
    Write-Host "  -Help        Show this help message" -ForegroundColor White
    Write-Host ""
    Write-Host "Note: You will be prompted to optionally fix admin password or create manager account" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "What this script does:" -ForegroundColor Yellow
    Write-Host "  1. Drops existing 'blueclue' database (if exists)" -ForegroundColor White
    Write-Host "  2. Creates fresh 'blueclue' database" -ForegroundColor White
    Write-Host "  3. Creates schema (tables, ENUMs, functions, triggers)" -ForegroundColor White
    Write-Host "  4. Sets up RBAC system (privileges, role-based defaults)" -ForegroundColor White
    Write-Host "  5. Sets up authentication (guest sessions, technicians)" -ForegroundColor White
    Write-Host "  6. Loads sample data (unless -SkipSeed is used)" -ForegroundColor White
    Write-Host ""
    Write-Host "Technician Accounts Created:" -ForegroundColor Yellow
    Write-Host "  tnewc@blueclue.com (Thomas Newcomb) - Technician" -ForegroundColor White
    Write-Host "  cmcgo@blueclue.com (Clayton McGough) - Technician" -ForegroundColor White
    Write-Host "  jwill@blueclue.com (Jacob Williams) - Technician" -ForegroundColor White
    Write-Host "  mjohnson@blueclue.com (Maria Johnson) - Senior Technician" -ForegroundColor White
    Write-Host "  ebrown@blueclue.com (Eric Brown) - Senior Technician" -ForegroundColor White
    Write-Host "  jdoe@blueclue.com (Jane Doe) - Management" -ForegroundColor White
    Write-Host "  ssmith@blueclue.com (Sarah Smith) - Management" -ForegroundColor White
    Write-Host "  Password: admin123 (must change on first login)" -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "BlueClue Database Complete Setup" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# Check PostgreSQL
Write-Host "Checking PostgreSQL installation..." -ForegroundColor Yellow
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: PostgreSQL not found. Please install PostgreSQL first." -ForegroundColor Red
    Write-Host "Download: https://www.postgresql.org/download/" -ForegroundColor Yellow
    exit 1
}

$pgVersion = psql --version
Write-Host "PostgreSQL found: $pgVersion" -ForegroundColor Green
Write-Host ""

# Get credentials
Write-Host "Database Configuration:" -ForegroundColor Yellow
Write-Host "Database: blueclue" -ForegroundColor White
Write-Host "User: postgres" -ForegroundColor White
Write-Host "Host: localhost" -ForegroundColor White
Write-Host "Port: 5432" -ForegroundColor White
Write-Host ""

Write-Host "Enter PostgreSQL 'postgres' user password:" -ForegroundColor Yellow
$securePassword = Read-Host -AsSecureString
$env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword))

Write-Host ""

# Step 1: Drop existing database
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Step 1: Dropping existing database (if exists)..." -ForegroundColor Yellow
Write-Host "============================================================================" -ForegroundColor Cyan

# First, terminate all active connections to the database
Write-Host "Terminating active connections to blueclue database..." -ForegroundColor White
$terminateQuery = @"
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = 'blueclue' 
  AND pid <> pg_backend_pid();
"@

$null = psql -U postgres -c $terminateQuery 2>&1

# Now drop the database
$dropResult = psql -U postgres -c "DROP DATABASE IF EXISTS blueclue;" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Existing database dropped successfully" -ForegroundColor Green
} else {
    Write-Host "Note: Could not drop database (may not exist)" -ForegroundColor Yellow
    Write-Host $dropResult -ForegroundColor Gray
}

Write-Host ""

# Step 2: Create database
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Step 2: Creating fresh database..." -ForegroundColor Yellow
Write-Host "============================================================================" -ForegroundColor Cyan

$createResult = psql -U postgres -c "CREATE DATABASE blueclue;" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Database created successfully" -ForegroundColor Green
} else {
    Write-Host "ERROR: Failed to create database" -ForegroundColor Red
    Write-Host $createResult -ForegroundColor Red
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    exit 1
}

Write-Host ""

# Step 3: Create schema
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Step 3: Creating database schema..." -ForegroundColor Yellow
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Creating tables, ENUMs, indexes, triggers, and views..." -ForegroundColor White
Write-Host "Includes RBAC system with role-based default category access..." -ForegroundColor White

$null = psql -U postgres -d blueclue -f schema.sql -q 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Schema created successfully" -ForegroundColor Green
    Write-Host "  [OK] Core tables (users, tickets, categories)" -ForegroundColor Green
    Write-Host "  [OK] RBAC tables (privilege_types, user_privileges, category_access)" -ForegroundColor Green
    Write-Host "  [OK] Role defaults (admin, technician default category access)" -ForegroundColor Green
} else {
    Write-Host "ERROR: Failed to create schema" -ForegroundColor Red
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    exit 1
}

Write-Host ""

# Step 4: Setup authentication
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Step 4: Setting up authentication system..." -ForegroundColor Yellow
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Creating guest sessions table and technician accounts..." -ForegroundColor White

$null = psql -U postgres -d blueclue -f auth_setup.sql 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Authentication system configured successfully" -ForegroundColor Green
    Write-Host ""
    Write-Host "Technician accounts created (all levels):" -ForegroundColor Yellow
    Write-Host "  tnewc, cmcgo, jwill (Technicians)" -ForegroundColor White
    Write-Host "  mjohnson, ebrown (Senior Technicians)" -ForegroundColor White
    Write-Host "  jdoe, ssmith (Management)" -ForegroundColor White
    Write-Host "  Password: admin123 (must change on first login)" -ForegroundColor Yellow
} else {
    Write-Host "ERROR: Failed to setup authentication" -ForegroundColor Red
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    exit 1
}

Write-Host ""

# Step 4.5: Apply email-to-ticket migrations
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Step 4.5: Applying feature migrations..." -ForegroundColor Yellow
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Adding email tracking, thread management, spam protection, and comment system..." -ForegroundColor White

$migrationFiles = @(
    "migrations\004_add_email_created_flag.sql",
    "migrations\005_add_email_thread_tracking.sql",
    "migrations\006_add_spam_protection.sql",
    "migrations\007_add_admin_management.sql",
    "migrations\012_add_comment_reactions.sql",
    "migrations\013_add_comment_notification_type.sql",
    "migrations\014_add_ticket_reopen_tracking.sql",
    "migrations\015_add_ticket_collaborators.sql"
)

$migrationsApplied = 0
foreach ($migration in $migrationFiles) {
    if (Test-Path $migration) {
        Write-Host "  Applying $migration..." -ForegroundColor White
        $null = psql -U postgres -d blueclue -f $migration -q 2>&1
        if ($LASTEXITCODE -eq 0) {
            $migrationsApplied++
        } else {
            Write-Host "  WARNING: Failed to apply $migration" -ForegroundColor Yellow
        }
    }
}

if ($migrationsApplied -eq $migrationFiles.Count) {
    Write-Host "Email-to-ticket and comment system configured successfully" -ForegroundColor Green
    Write-Host "  [OK] Email creation tracking" -ForegroundColor Green
    Write-Host "  [OK] Email thread management" -ForegroundColor Green
    Write-Host "  [OK] Spam detection and filtering" -ForegroundColor Green
    Write-Host "  [OK] Admin management features" -ForegroundColor Green
    Write-Host "  [OK] Comment reactions and threading" -ForegroundColor Green
} else {
    Write-Host "WARNING: Some migrations failed to apply ($migrationsApplied/$($migrationFiles.Count))" -ForegroundColor Yellow
    Write-Host "Email-to-ticket features may not work correctly" -ForegroundColor Yellow
}

Write-Host ""

# Step 5: Load sample data (optional)
if (-not $SkipSeed) {
    Write-Host "============================================================================" -ForegroundColor Cyan
    Write-Host "Step 5: Loading sample data..." -ForegroundColor Yellow
    Write-Host "============================================================================" -ForegroundColor Cyan
    Write-Host "Creating sample customers and admin user..." -ForegroundColor White
    Write-Host "(No tickets will be created - submit via app to test AI classifier)" -ForegroundColor Yellow

    $null = psql -U postgres -d blueclue -f seed.sql -q 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Sample data loaded successfully" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Failed to load sample data" -ForegroundColor Yellow
        Write-Host "You can run seed.sql manually later if needed" -ForegroundColor Yellow
    }
} else {
    Write-Host "============================================================================" -ForegroundColor Cyan
    Write-Host "Step 5: Skipping sample data (as requested)" -ForegroundColor Yellow
    Write-Host "============================================================================" -ForegroundColor Cyan
}

Write-Host ""

# Step 6: Optional utility scripts (with user prompts)
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Optional Setup Tasks" -ForegroundColor Yellow
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# Prompt for admin password fix
$fixAdminResponse = Read-Host "Do you want to reset admin password to BlueClue2026!? (y/n)"
if ($fixAdminResponse -eq 'y' -or $fixAdminResponse -eq 'Y') {
    Write-Host ""
    Write-Host "Resetting admin@blueclue.com password..." -ForegroundColor White

    $null = psql -U postgres -d blueclue -f fix_admin_password.sql 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Admin password reset successfully" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Failed to reset admin password" -ForegroundColor Yellow
    }
}

Write-Host ""

# Prompt for manager account creation
$createManagerResponse = Read-Host "Do you want to create manager@blueclue.com account with full permissions? (y/n)"
if ($createManagerResponse -eq 'y' -or $createManagerResponse -eq 'Y') {
    Write-Host ""
    Write-Host "Creating manager@blueclue.com with full category permissions..." -ForegroundColor White

    $null = psql -U postgres -d blueclue -f create_manager_account.sql 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Manager account created successfully" -ForegroundColor Green
        Write-Host "  Login: manager@blueclue.com / BlueClue2026!" -ForegroundColor White
        $managerCreated = $true
    } else {
        Write-Host "WARNING: Failed to create manager account" -ForegroundColor Yellow
        $managerCreated = $false
    }
}

Write-Host ""

# Verify setup
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Verifying setup..." -ForegroundColor Yellow
Write-Host "============================================================================" -ForegroundColor Cyan

$techCount = (psql -U postgres -d blueclue -t -A -c "SELECT COUNT(*) FROM users WHERE role IN ('technician', 'senior_technician', 'management');" 2>&1).Trim()
$custCount = (psql -U postgres -d blueclue -t -A -c "SELECT COUNT(*) FROM users WHERE role = 'customer';" 2>&1).Trim()
$adminCount = (psql -U postgres -d blueclue -t -A -c "SELECT COUNT(*) FROM users WHERE role = 'admin';" 2>&1).Trim()
$catCount = (psql -U postgres -d blueclue -t -A -c "SELECT COUNT(*) FROM categories;" 2>&1).Trim()
$ticketCount = (psql -U postgres -d blueclue -t -A -c "SELECT COUNT(*) FROM tickets;" 2>&1).Trim()
$privTypeCount = (psql -U postgres -d blueclue -t -A -c "SELECT COUNT(*) FROM privilege_types WHERE is_active = true;" 2>&1).Trim()
$roleDefaultsCount = (psql -U postgres -d blueclue -t -A -c "SELECT COUNT(*) FROM role_category_defaults WHERE is_active = true;" 2>&1).Trim()

if ($LASTEXITCODE -eq 0) {
    Write-Host "Database Objects:" -ForegroundColor Yellow
    Write-Host "  Technicians (All Levels): $techCount" -ForegroundColor White
    Write-Host "  Customers: $custCount" -ForegroundColor White
    Write-Host "  Admins: $adminCount" -ForegroundColor White
    Write-Host "  Categories: $catCount" -ForegroundColor White
    Write-Host "  Tickets: $ticketCount" -ForegroundColor White
    Write-Host ""
    Write-Host "RBAC System:" -ForegroundColor Yellow
    Write-Host "  Privilege Types: $privTypeCount" -ForegroundColor White
    Write-Host "  Role Default Access Rules: $roleDefaultsCount" -ForegroundColor White
} else {
    Write-Host "  WARNING: Could not verify counts" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "RBAC System Enabled:" -ForegroundColor Yellow
Write-Host "  [OK] 5 Privilege types configured" -ForegroundColor Green
Write-Host "  [OK] Role-based default category access active" -ForegroundColor Green
Write-Host "  [OK] Admins: Full access to all categories" -ForegroundColor Green
Write-Host "  [OK] Management: Full assign access to all categories" -ForegroundColor Green
Write-Host "  [OK] Senior Technicians: Assign access to critical, edit to general" -ForegroundColor Green
Write-Host "  [OK] Technicians: Edit access to technical categories" -ForegroundColor Green
Write-Host ""
Write-Host "Email-to-Ticket System Enabled:" -ForegroundColor Yellow
Write-Host "  [OK] Mailgun webhook integration" -ForegroundColor Green
Write-Host "  [OK] Email thread tracking and replies" -ForegroundColor Green
Write-Host "  [OK] Spam detection and filtering" -ForegroundColor Green
Write-Host "  [OK] Automatic priority classification" -ForegroundColor Green
Write-Host ""
Write-Host "Comment System Enabled:" -ForegroundColor Yellow
Write-Host "  [OK] Threaded comments with reply support" -ForegroundColor Green
Write-Host "  [OK] Internal (tech-only) comments" -ForegroundColor Green
Write-Host "  [OK] Emoji reactions (6 types)" -ForegroundColor Green
Write-Host "  [OK] Real-time updates via WebSocket" -ForegroundColor Green
Write-Host ""
Write-Host "Connection String:" -ForegroundColor Yellow
Write-Host "postgresql://postgres:PASSWORD@localhost:5432/blueclue" -ForegroundColor White
Write-Host ""
Write-Host "Technician Login:" -ForegroundColor Yellow
Write-Host "  Technician: tnewc / cmcgo / jwill" -ForegroundColor White
Write-Host "  Senior Tech: mjohnson / ebrown" -ForegroundColor White
Write-Host "  Management: jdoe / ssmith" -ForegroundColor White
Write-Host "  Password: admin123 (must change on first login)" -ForegroundColor White
Write-Host ""

if (-not $SkipSeed) {
    Write-Host "Sample Customer Login:" -ForegroundColor Yellow
    Write-Host "  Email: mike.chen@startupxyz.io" -ForegroundColor White
    Write-Host "  Password: BlueClue2026!" -ForegroundColor White
    Write-Host ""
    Write-Host "Admin Login:" -ForegroundColor Yellow
    Write-Host "  Email: admin@blueclue.com" -ForegroundColor White
    Write-Host "  Password: BlueClue2026!" -ForegroundColor White
    Write-Host ""
}

if ($managerCreated) {
    Write-Host "Manager Login:" -ForegroundColor Yellow
    Write-Host "  Email: manager@blueclue.com" -ForegroundColor White
    Write-Host "  Password: BlueClue2026!" -ForegroundColor White
    Write-Host ""
}

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Start backend: cd blueclue\backend; npm run dev" -ForegroundColor White
Write-Host "2. Start frontend: cd blueclue\frontend; npm run dev" -ForegroundColor White
Write-Host "3. Submit tickets via the app to test AI classification" -ForegroundColor White
Write-Host "4. Configure email-to-ticket: docs\setup\INBOUND_EMAIL_SETUP_GUIDE.md" -ForegroundColor White
Write-Host ""
Write-Host "RBAC Documentation:" -ForegroundColor Yellow
Write-Host "  API Guide: docs\api\rbac-default-access.md" -ForegroundColor White
Write-Host "  Implementation: docs\api\rbac-default-access-implementation.md" -ForegroundColor White
Write-Host ""
Write-Host "Guest Cleanup:" -ForegroundColor Yellow
Write-Host "  Dry run: cd blueclue\backend; npm run cleanup:guests:dry-run" -ForegroundColor White
Write-Host "  Guide: blueclue\database\GUEST_CLEANUP_GUIDE.md" -ForegroundColor White
Write-Host ""

# Clean up password from environment
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
