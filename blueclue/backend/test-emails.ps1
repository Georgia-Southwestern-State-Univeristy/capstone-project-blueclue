# BlueClue Email Service Testing Script
# Run this script to test all email templates

Write-Host "`n=== BlueClue Email Service Tester ===" -ForegroundColor Cyan
Write-Host "Testing all email templates...`n" -ForegroundColor Cyan

$baseUrl = "http://localhost:3000/api/dev/email-test"

# Test 1: Email Service Status
Write-Host "1. Checking Email Service Status..." -ForegroundColor Yellow
try {
    $status = Invoke-RestMethod -Uri "http://localhost:3000/api/dev/email-status" -Method Get
    Write-Host "   Status: $($status.mode) mode" -ForegroundColor Green
    Write-Host "   Ready: $($status.ready)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "   ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit
}

# Test 2: Welcome Email
Write-Host "2. Testing Welcome Email..." -ForegroundColor Yellow
try {
    $body = @{
        email = "john.doe@example.com"
        firstName = "John"
        verificationToken = "welcome-token-abc123"
    } | ConvertTo-Json
    
    $result = Invoke-RestMethod -Uri "$baseUrl/welcome" -Method Post -Body $body -ContentType "application/json"
    Write-Host "   ✅ $($result.message)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 3: Verification Email
Write-Host "3. Testing Verification Email..." -ForegroundColor Yellow
try {
    $body = @{
        email = "jane.smith@example.com"
        firstName = "Jane"
        verificationToken = "verify-token-xyz789"
    } | ConvertTo-Json
    
    $result = Invoke-RestMethod -Uri "$baseUrl/verification" -Method Post -Body $body -ContentType "application/json"
    Write-Host "   ✅ $($result.message)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 4: Ticket Created Email
Write-Host "4. Testing Ticket Created Email..." -ForegroundColor Yellow
try {
    $body = @{
        email = "customer@example.com"
        ticketId = 1001
        subject = "Cannot access my account"
        priority = "high"
        category = "account"
        description = "I'm unable to log into my account. Getting 'invalid credentials' error."
    } | ConvertTo-Json
    
    $result = Invoke-RestMethod -Uri "$baseUrl/ticket-created" -Method Post -Body $body -ContentType "application/json"
    Write-Host "   ✅ $($result.message)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 5: Ticket Status Update Email
Write-Host "5. Testing Ticket Status Update Email..." -ForegroundColor Yellow
try {
    $body = @{
        email = "customer@example.com"
        ticketId = 1001
        subject = "Cannot access my account"
        oldStatus = "open"
        newStatus = "in-progress"
        assignedTechnician = "Sarah Johnson"
        updateComment = "I've reviewed your issue and I'm working on a solution. Will have an update for you within 2 hours."
    } | ConvertTo-Json
    
    $result = Invoke-RestMethod -Uri "$baseUrl/ticket-status" -Method Post -Body $body -ContentType "application/json"
    Write-Host "   ✅ $($result.message)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 6: Password Reset Email
Write-Host "6. Testing Password Reset Email..." -ForegroundColor Yellow
try {
    $body = @{
        email = "user@example.com"
        firstName = "Alex"
        resetToken = "reset-token-def456"
    } | ConvertTo-Json
    
    $result = Invoke-RestMethod -Uri "$baseUrl/password-reset" -Method Post -Body $body -ContentType "application/json"
    Write-Host "   ✅ $($result.message)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "=== Test Complete ===" -ForegroundColor Cyan
Write-Host "Check the backend terminal/console to see the email content!`n" -ForegroundColor Green
