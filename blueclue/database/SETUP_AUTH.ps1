# ============================================================================
# BlueClue Authentication System Setup Script
# ============================================================================
# This script sets up the authentication system for BlueClue
# Run this after the main database schema is set up

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "BlueClue Authentication System Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if PostgreSQL is available
try {
    $pgVersion = psql --version
    Write-Host "PostgreSQL found: $pgVersion" -ForegroundColor Green
} catch {
    Write-Host "PostgreSQL not found. Please install PostgreSQL first." -ForegroundColor Red
    exit 1
}

# Get database credentials
Write-Host ""
Write-Host "Database Configuration:" -ForegroundColor Yellow
$DB_NAME = Read-Host "Database name (default: blueclue)"
if ([string]::IsNullOrWhiteSpace($DB_NAME)) { $DB_NAME = "blueclue" }

$DB_USER = Read-Host "Database user (default: postgres)"
if ([string]::IsNullOrWhiteSpace($DB_USER)) { $DB_USER = "postgres" }

$DB_HOST = Read-Host "Database host (default: localhost)"
if ([string]::IsNullOrWhiteSpace($DB_HOST)) { $DB_HOST = "localhost" }

$DB_PORT = Read-Host "Database port (default: 5432)"
if ([string]::IsNullOrWhiteSpace($DB_PORT)) { $DB_PORT = "5432" }

Write-Host ""
Write-Host "Connecting to database: $($DB_NAME)@$($DB_HOST):$($DB_PORT) as $($DB_USER)" -ForegroundColor Cyan

# Run authentication setup SQL
Write-Host ""
Write-Host "Step 1: Setting up authentication tables and technician accounts..." -ForegroundColor Yellow

$securePassword = Read-Host "Enter database password" -AsSecureString
$env:PGPASSWORD = [System.Net.NetworkCredential]::new("", $securePassword).Password

try {
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "auth_setup.sql"
    Write-Host "Authentication tables created successfully" -ForegroundColor Green
    Write-Host "Technician accounts created: tnewc, cmcgo, jwill" -ForegroundColor Green
    Write-Host "Default password: admin123 (must be changed on first login)" -ForegroundColor Yellow
} catch {
    Write-Host " Error setting up authentication system" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Verify technician accounts
Write-Host ""
Write-Host "Step 2: Verifying technician accounts..." -ForegroundColor Yellow

try {
    $result = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM users WHERE role = 'technician';"
    $techCount = $result.Trim()
    
    if ($techCount -eq "3") {
        Write-Host "All 3 technician accounts verified" -ForegroundColor Green
    } else {
        Write-Host "Warning: Expected 3 technician accounts, found $techCount" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Error verifying accounts" -ForegroundColor Red
}

# Show technician accounts
Write-Host ""
Write-Host "Technician Accounts:" -ForegroundColor Cyan
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT username, email, role, force_password_change FROM users WHERE role = 'technician';"

# Update ticket categories
Write-Host ""
Write-Host "Step 3: Updating ticket categories for AI classifier..." -ForegroundColor Yellow

try {
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "update_categories.sql"
    Write-Host "Ticket categories updated successfully" -ForegroundColor Green
    Write-Host "AI classifier categories (hardware, software, network, login, other) added" -ForegroundColor Green
} catch {
    Write-Host "Error updating ticket categories" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

# Backend setup check
Write-Host ""
Write-Host "Step 4: Checking backend dependencies..." -ForegroundColor Yellow

$backendPath = "..\backend"
if (Test-Path "$backendPath\package.json") {
    Push-Location $backendPath
    
    # Check if dependencies are installed
    $hasBcrypt = npm list bcrypt 2>&1 | Select-String "bcrypt@"
    $hasJwt = npm list jsonwebtoken 2>&1 | Select-String "jsonwebtoken@"
    $hasCookieParser = npm list cookie-parser 2>&1 | Select-String "cookie-parser@"
    
    if ($hasBcrypt -and $hasJwt -and $hasCookieParser) {
        Write-Host "All backend dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "Installing authentication dependencies..." -ForegroundColor Yellow
        npm install bcrypt jsonwebtoken cookie-parser
        Write-Host "Dependencies installed" -ForegroundColor Green
    }
    
    Pop-Location
} else {
    Write-Host "Backend directory not found at $backendPath" -ForegroundColor Yellow
}

# Environment variables check
Write-Host ""
Write-Host "Step 5: Checking environment variables..." -ForegroundColor Yellow

$envPath = "..\backend\.env"
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    
    if ($envContent -match "JWT_SECRET") {
        Write-Host "JWT_SECRET found in .env" -ForegroundColor Green
    } else {
        Write-Host "JWT_SECRET not found in .env" -ForegroundColor Yellow
        Write-Host "Adding JWT_SECRET to .env..." -ForegroundColor Yellow
        Add-Content -Path $envPath -Value "`nJWT_SECRET=blueclue-secret-key-change-in-production`nJWT_EXPIRES_IN=24h"
        Write-Host "JWT_SECRET added (CHANGE IN PRODUCTION!)" -ForegroundColor Green
    }
} else {
    Write-Host ".env file not found at $envPath" -ForegroundColor Yellow
    Write-Host "Creating .env file..." -ForegroundColor Yellow
    
    $envTemplate = @"
# Database Configuration
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=your_password_here

# JWT Configuration
JWT_SECRET=blueclue-secret-key-change-in-production
JWT_EXPIRES_IN=24h

# Server Configuration
PORT=3000
"@
    
    Set-Content -Path $envPath -Value $envTemplate
    Write-Host ".env file created" -ForegroundColor Green
    Write-Host "  REMEMBER TO UPDATE DB_PASSWORD AND JWT_SECRET!" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Technician Accounts Created:" -ForegroundColor Cyan
Write-Host "  Username: tnewc | Password: admin123 (must change on first login)" -ForegroundColor White
Write-Host "  Username: cmcgo | Password: admin123 (must change on first login)" -ForegroundColor White
Write-Host "  Username: jwill | Password: admin123 (must change on first login)" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Start backend: cd ..\backend && npm run dev" -ForegroundColor White
Write-Host "  2. Start frontend: cd ..\frontend && npm run dev" -ForegroundColor White
Write-Host "  3. Navigate to http://localhost:5173/login" -ForegroundColor White
Write-Host "  4. Test technician login with credentials above" -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANT: Change JWT_SECRET in .env before production!" -ForegroundColor Yellow
Write-Host ""

# Cleanup
Remove-Item Env:\PGPASSWORD
