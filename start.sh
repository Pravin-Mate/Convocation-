#!/bin/bash
echo "======================================================================"
echo "  MGM UNIVERSITY CONVOCATION QR REPORTING & LIVE STAGE DISPLAY SYSTEM"
echo "======================================================================"
echo ""

if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed! Please install Node.js v18+"
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install --production
fi

echo "Starting Convocation Live Ceremony Server..."
echo "----------------------------------------------------------------------"
echo "  Main Operator Portal:     http://localhost:3000"
echo "  16:9 Live Stage LED:      http://localhost:3000/#display"
echo "----------------------------------------------------------------------"
echo ""
node server.js
