@echo off
TITLE MGM University Convocation System - Local Server
echo ======================================================================
echo   MGM UNIVERSITY CONVOCATION QR REPORTING & LIVE STAGE DISPLAY SYSTEM
echo ======================================================================
echo.
echo [1/3] Checking Node.js runtime...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH! Please install Node.js v18+
    pause
    exit /b 1
)

echo [2/3] Checking dependencies...
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install --production
)

echo [3/3] Starting Convocation Live Ceremony Server...
echo.
echo ----------------------------------------------------------------------
echo   Main Operator Portal:     http://localhost:3000
echo   16:9 Live Stage LED:      http://localhost:3000/#display
echo ----------------------------------------------------------------------
echo.
echo Press Ctrl+C to stop the server safely.
echo.
node server.js
pause
