# HID Entry Kiosk Launch Script
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " HID Entry Kiosk — Face Liveness & Authentication Prototype" -ForegroundColor White
Write-Host " Decision Latency <= 2.0s | ISO/IEC 30107-3 Liveness Compliant" -ForegroundColor DarkCyan
Write-Host "======================================================================" -ForegroundColor Cyan

$backendDir = Join-Path $PSScriptRoot "backend"
Set-Location $backendDir

Write-Host "`n[1/3] Ensuring models and database are ready..." -ForegroundColor Yellow
py -3.11 scripts/download_models.py
py -3.11 scripts/seed_demo_user.py

Write-Host "`n[2/3] Starting FastAPI Kiosk Server on http://localhost:8000 ..." -ForegroundColor Green
Start-Process "http://localhost:8000"
py -3.11 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
