Write-Host "=================================" -ForegroundColor Cyan
Write-Host "  Starting Aura AI Face Analysis  " -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

$backendDir = Join-Path $PSScriptRoot "backend"
$frontendDir = Join-Path $PSScriptRoot "frontend"

# Check if .venv exists
$pythonPath = "python"
if (Test-Path (Join-Path $backendDir ".venv\Scripts\python.exe")) {
    $pythonPath = ".\.venv\Scripts\python.exe"
    Write-Host "Using Virtual Environment Python..." -ForegroundColor Green
}

# Start Backend
Write-Host "-> Starting Python Backend API on port 8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendDir'; & $pythonPath api.py"

# Start Frontend
Write-Host "-> Starting Next.js Frontend on port 3000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendDir'; npm run dev"

Write-Host ""
Write-Host "Success! Servers are starting in separate windows." -ForegroundColor Green
Write-Host "Please wait a moment and then open: http://localhost:3000 in your browser." -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
