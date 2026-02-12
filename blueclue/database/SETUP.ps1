# BlueClue Database Setup Script
# Run this to automatically set up the database

param(
    [switch]$Reset
)

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "BlueClue Database Setup" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# Check PostgreSQL
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: PostgreSQL not found. Please install PostgreSQL first." -ForegroundColor Red
    Write-Host "Download: https://www.postgresql.org/download/" -ForegroundColor Yellow
    exit 1
}

Write-Host "PostgreSQL found: $(psql --version)" -ForegroundColor Green
Write-Host ""

# Get password
Write-Host "Enter PostgreSQL 'postgres' user password:" -ForegroundColor Yellow
$password = Read-Host -AsSecureString
$env:PGPASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
)

Write-Host ""

# Reset if requested
if ($Reset) {
    Write-Host "Dropping existing database..." -ForegroundColor Yellow
    psql -U postgres -c "DROP DATABASE IF EXISTS blueclue;" 2>$null
    Write-Host "Database dropped" -ForegroundColor Green
    Write-Host ""
}

# Create database
Write-Host "Creating database..." -ForegroundColor Yellow
$result = psql -U postgres -c "CREATE DATABASE blueclue;" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Database created successfully" -ForegroundColor Green
} elseif ($result -match "already exists") {
    Write-Host "Database already exists (OK)" -ForegroundColor Yellow
} else {
    Write-Host "ERROR: Failed to create database" -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
    exit 1
}

Write-Host ""

# Run schema
Write-Host "Creating schema..." -ForegroundColor Yellow
psql -U postgres -d blueclue -f schema.sql -q

if ($LASTEXITCODE -eq 0) {
    Write-Host "Schema created successfully" -ForegroundColor Green
} else {
    Write-Host "ERROR: Failed to create schema" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Run seed
Write-Host "Inserting sample data..." -ForegroundColor Yellow
psql -U postgres -d blueclue -f seed.sql -q

if ($LASTEXITCODE -eq 0) {
    Write-Host "Sample data inserted successfully" -ForegroundColor Green
} else {
    Write-Host "ERROR: Failed to insert sample data" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Verify
Write-Host "Verifying setup..." -ForegroundColor Yellow
$counts = psql -U postgres -d blueclue -t -A -c "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM tickets; SELECT COUNT(*) FROM categories;"

if ($counts) {
    $lines = $counts -split "`n"
    Write-Host "  Users: $($lines[0].Trim())" -ForegroundColor White
    Write-Host "  Tickets: $($lines[1].Trim())" -ForegroundColor White
    Write-Host "  Categories: $($lines[2].Trim())" -ForegroundColor White
}

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Connection: postgresql://postgres:PASSWORD@localhost:5432/blueclue" -ForegroundColor White
Write-Host ""
Write-Host "Sample Users (Password: BlueClue2026!):" -ForegroundColor Yellow
Write-Host "  Customer: mike.chen@startupxyz.io" -ForegroundColor White
Write-Host "  Customer: emily.rodriguez@freelance.net" -ForegroundColor White
Write-Host "  Technician: david.park@blueclue.com" -ForegroundColor White
Write-Host "  Admin: admin@blueclue.com" -ForegroundColor White
Write-Host ""
Write-Host "Next: Update backend/.env with database credentials" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan

# Clear password
$env:PGPASSWORD = $null
