@echo off
setlocal
echo ======================================================================
echo  HID Entry Kiosk — Face Liveness & Authentication Prototype
echo  InsightFace buffalo_l + MiniFASNet Ensemble + Decision Latency <= 2.0s
echo ======================================================================

cd /d "%~dp0\backend"

echo [1/3] Ensuring models and database are ready...
py -3.11 scripts\download_models.py
py -3.11 scripts\seed_demo_user.py

echo [2/3] Starting FastAPI Kiosk Server on http://localhost:8000 ...
start "" "http://localhost:8000"
py -3.11 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

pause
