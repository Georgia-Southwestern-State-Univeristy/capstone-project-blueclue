# BlueClue Development Startup Script
# This script installs dependencies and starts both frontend and backend dev servers

Write-Host "BlueClue Development Setup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to project root
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location "$scriptPath\..\..\..\"

# Install dependencies for frontend
Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location blueclue\frontend
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend installation failed!" -ForegroundColor Red
    exit 1
}
Set-Location ..\..

# Install dependencies for backend
Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
Set-Location blueclue\backend
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Backend installation failed!" -ForegroundColor Red
    exit 1
}
Set-Location ..\..

Write-Host ""
Write-Host "All dependencies installed successfully!" -ForegroundColor Green
Write-Host ""

# Ask user if they want to start dev servers
$response = Read-Host "Do you want to start the development servers? (Y/N)"
if ($response -eq 'Y' -or $response -eq 'y') {
    Write-Host ""
    Write-Host "Starting development servers..." -ForegroundColor Yellow
    Write-Host ""

    # Get the absolute paths for starting dev servers
    $projectRoot = Get-Location
    $frontendPath = Join-Path $projectRoot "blueclue\frontend"
    $backendPath = Join-Path $projectRoot "blueclue\backend"

    # Start both dev servers
    $frontend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; npm run dev" -PassThru
    $backend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; npm run dev" -PassThru

    Write-Host "Development servers started!" -ForegroundColor Green
    Write-Host "   Frontend and Backend are running in separate windows" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Press Ctrl+C to stop monitoring (servers will continue in their windows)" -ForegroundColor Gray

    # Keep script running to monitor processes
    try {
        while ($frontend.HasExited -eq $false -or $backend.HasExited -eq $false) {
            Start-Sleep -Seconds 2
        }
    }
    catch {
        Write-Host "Monitoring stopped" -ForegroundColor Yellow
    }
}
else {
    Write-Host ""
    Write-Host "Setup complete! Run 'npm run dev' from the root directory to start servers later." -ForegroundColor Cyan
}
