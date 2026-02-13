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
    Write-Host "What this script does:" -ForegroundColor Yellow
    Write-Host "  1. Drops existing 'blueclue' database (if exists)" -ForegroundColor White
    Write-Host "  2. Creates fresh 'blueclue' database" -ForegroundColor White
    Write-Host "  3. Creates schema (tables, ENUMs, functions, triggers)" -ForegroundColor White
    Write-Host "  4. Sets up authentication (guest sessions, technicians)" -ForegroundColor White
    Write-Host "  5. Loads sample data (unless -SkipSeed is used)" -ForegroundColor White
    Write-Host ""
    Write-Host "Technician Accounts Created:" -ForegroundColor Yellow
    Write-Host "  tnewc@blueclue.com (Thomas Newcomb)" -ForegroundColor White
    Write-Host "  cmcgo@blueclue.com (Clayton McGough)" -ForegroundColor White
    Write-Host "  jwill@blueclue.com (Jacob Williams)" -ForegroundColor White
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

$null = psql -U postgres -c "DROP DATABASE IF EXISTS blueclue;" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Existing database dropped successfully" -ForegroundColor Green
} else {
    Write-Host "No existing database to drop (OK)" -ForegroundColor Yellow
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

$null = psql -U postgres -d blueclue -f schema.sql -q 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Schema created successfully" -ForegroundColor Green
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
    Write-Host "Technician accounts created:" -ForegroundColor Yellow
    Write-Host "  tnewc@blueclue.com (Thomas Newcomb)" -ForegroundColor White
    Write-Host "  cmcgo@blueclue.com (Clayton McGough)" -ForegroundColor White
    Write-Host "  jwill@blueclue.com (Jacob Williams)" -ForegroundColor White
    Write-Host "  Password: admin123 (must change on first login)" -ForegroundColor Yellow
} else {
    Write-Host "ERROR: Failed to setup authentication" -ForegroundColor Red
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    exit 1
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

# Verify setup
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Verifying setup..." -ForegroundColor Yellow
Write-Host "============================================================================" -ForegroundColor Cyan

$techCount = (psql -U postgres -d blueclue -t -A -c "SELECT COUNT(*) FROM users WHERE role = 'technician';" 2>&1).Trim()
$custCount = (psql -U postgres -d blueclue -t -A -c "SELECT COUNT(*) FROM users WHERE role = 'customer';" 2>&1).Trim()
$adminCount = (psql -U postgres -d blueclue -t -A -c "SELECT COUNT(*) FROM users WHERE role = 'admin';" 2>&1).Trim()
$catCount = (psql -U postgres -d blueclue -t -A -c "SELECT COUNT(*) FROM categories;" 2>&1).Trim()
$ticketCount = (psql -U postgres -d blueclue -t -A -c "SELECT COUNT(*) FROM tickets;" 2>&1).Trim()

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Technicians: $techCount" -ForegroundColor White
    Write-Host "  Customers: $custCount" -ForegroundColor White
    Write-Host "  Admins: $adminCount" -ForegroundColor White
    Write-Host "  Categories: $catCount" -ForegroundColor White
    Write-Host "  Tickets: $ticketCount" -ForegroundColor White
} else {
    Write-Host "  WARNING: Could not verify counts" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Connection String:" -ForegroundColor Yellow
Write-Host "postgresql://postgres:PASSWORD@localhost:5432/blueclue" -ForegroundColor White
Write-Host ""
Write-Host "Technician Login:" -ForegroundColor Yellow
Write-Host "  Username: tnewc / cmcgo / jwill" -ForegroundColor White
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

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Start backend: cd blueclue\backend; npm run dev" -ForegroundColor White
Write-Host "2. Start frontend: cd blueclue\frontend; npm run dev" -ForegroundColor White
Write-Host "3. Submit tickets via the app to test AI classification" -ForegroundColor White
Write-Host ""
Write-Host "Guest Cleanup:" -ForegroundColor Yellow
Write-Host "  Dry run: cd blueclue\backend; npm run cleanup:guests:dry-run" -ForegroundColor White
Write-Host "  Guide: blueclue\database\GUEST_CLEANUP_GUIDE.md" -ForegroundColor White
Write-Host ""

# Clean up password from environment
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
