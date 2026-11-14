@echo off
setlocal
echo ======================================================================
echo  HID Biometrics: ISO/IEC 30107-3 Presentation Attack Evaluation
echo ======================================================================

cd /d "%~dp0\backend"
py -3.11 -m tests.eval

pause
