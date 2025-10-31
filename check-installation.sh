#!/bin/bash

###############################################################################
# Webhook Gateway Hub - Installation Path Checker
# This script helps verify your installation location
###############################################################################

echo "================================================"
echo "  Webhook Gateway Hub - Path Checker"
echo "================================================"
echo ""

# Check common installation paths
echo "Checking common installation paths..."
echo ""

if [ -f "/opt/webhook-gateway/backend/server.py" ]; then
    echo "✅ FOUND: /opt/webhook-gateway"
    echo "   Backend: /opt/webhook-gateway/backend/server.py"
    echo "   Frontend: /opt/webhook-gateway/frontend/"
    INSTALL_PATH="/opt/webhook-gateway"
fi

if [ -f "/app/backend/server.py" ]; then
    echo "✅ FOUND: /app"
    echo "   Backend: /app/backend/server.py"
    echo "   Frontend: /app/frontend/"
    INSTALL_PATH="/app"
fi

if [ -f "$HOME/webhook-gateway/backend/server.py" ]; then
    echo "✅ FOUND: $HOME/webhook-gateway"
    echo "   Backend: $HOME/webhook-gateway/backend/server.py"
    echo "   Frontend: $HOME/webhook-gateway/frontend/"
    INSTALL_PATH="$HOME/webhook-gateway"
fi

if [ -z "$INSTALL_PATH" ]; then
    echo "❌ No installation found in common locations"
    echo ""
    echo "Checked:"
    echo "  - /opt/webhook-gateway"
    echo "  - /app"
    echo "  - $HOME/webhook-gateway"
    echo ""
    exit 1
fi

echo ""
echo "================================================"
echo "  Installation Details"
echo "================================================"
cd "$INSTALL_PATH"

# Check git status
if [ -d ".git" ]; then
    echo "Git Repository: Yes"
    echo "Current Branch: $(git branch --show-current 2>/dev/null || echo 'unknown')"
    echo "Current Commit: $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
    echo "Remote URL: $(git remote get-url origin 2>/dev/null || echo 'not set')"
else
    echo "Git Repository: No"
fi

echo ""
echo "Files:"
echo "  Backend: $([ -f "$INSTALL_PATH/backend/server.py" ] && echo "✅" || echo "❌")"
echo "  Frontend: $([ -d "$INSTALL_PATH/frontend/src" ] && echo "✅" || echo "❌")"
echo "  Requirements: $([ -f "$INSTALL_PATH/backend/requirements.txt" ] && echo "✅" || echo "❌")"
echo "  Package.json: $([ -f "$INSTALL_PATH/frontend/package.json" ] && echo "✅" || echo "❌")"

echo ""
echo "Environment Files:"
echo "  Backend .env: $([ -f "$INSTALL_PATH/backend/.env" ] && echo "✅" || echo "❌")"
echo "  Frontend .env: $([ -f "$INSTALL_PATH/frontend/.env" ] && echo "✅" || echo "❌")"

echo ""
echo "================================================"
echo "  Update Script Test"
echo "================================================"

if [ -f "$INSTALL_PATH/update-from-github.sh" ]; then
    echo "✅ Update script found"
    echo ""
    echo "To update your installation, run:"
    echo "  cd $INSTALL_PATH"
    echo "  sudo bash update-from-github.sh"
elif [ -f "$INSTALL_PATH/quick-update.sh" ]; then
    echo "✅ Quick update script found"
    echo ""
    echo "To update your installation, run:"
    echo "  cd $INSTALL_PATH"
    echo "  sudo bash quick-update.sh"
else
    echo "❌ Update scripts not found"
    echo ""
    echo "Download update script:"
    echo "  cd $INSTALL_PATH"
    echo "  wget https://raw.githubusercontent.com/wilson1442/Webhook-Hub/main/quick-update.sh"
    echo "  chmod +x quick-update.sh"
    echo "  sudo bash quick-update.sh"
fi

echo ""
