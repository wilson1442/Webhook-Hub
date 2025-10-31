#!/bin/bash

###############################################################################
# Webhook Gateway Hub - Simple Update Script
# Repository: https://github.com/wilson1442/Webhook-Hub
# 
# Default installation path: /opt/webhook-gateway
# Usage: bash update.sh
###############################################################################

echo "=========================================="
echo "  Webhook Gateway Hub - Quick Update"
echo "=========================================="
echo ""

# Find installation directory
if [ -f "/opt/webhook-gateway/backend/server.py" ]; then
    echo "✓ Found installation at /opt/webhook-gateway"
    APP_DIR="/opt/webhook-gateway"
elif [ -f "/app/backend/server.py" ]; then
    echo "✓ Found installation at /app"
    APP_DIR="/app"
elif [ -f "./backend/server.py" ]; then
    echo "✓ Found installation in current directory"
    APP_DIR="$(pwd)"
elif [ -f "../backend/server.py" ]; then
    echo "✓ Found installation in parent directory"
    APP_DIR="$(cd .. && pwd)"
else
    echo "? Where is your Webhook Gateway Hub installed?"
    echo "  (Press Enter to try /opt/webhook-gateway, or type the full path)"
    read -p "Path: " USER_PATH
    
    if [ -z "$USER_PATH" ]; then
        APP_DIR="/opt/webhook-gateway"
    else
        APP_DIR="$USER_PATH"
    fi
    
    if [ ! -f "$APP_DIR/backend/server.py" ]; then
        echo "✗ Error: Cannot find backend/server.py in $APP_DIR"
        echo ""
        echo "To install fresh:"
        echo "  git clone https://github.com/wilson1442/Webhook-Hub.git /opt/webhook-gateway"
        echo "  cd /opt/webhook-gateway"
        echo "  bash install.sh"
        exit 1
    fi
fi

cd "$APP_DIR"
echo "  Working directory: $APP_DIR"
echo ""

# Create backup
echo "→ Creating backup..."
BACKUP="/tmp/webhook-backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP"
cp -r backend frontend "$BACKUP/" 2>/dev/null
[ -f .env ] && cp .env "$BACKUP/" 2>/dev/null
echo "  Backup: $BACKUP"
echo ""

# Setup git if needed
echo "→ Setting up git repository..."
if [ ! -d ".git" ]; then
    git init
    git remote add origin https://github.com/wilson1442/Webhook-Hub.git
    echo "  Git initialized"
else
    git remote set-url origin https://github.com/wilson1442/Webhook-Hub.git 2>/dev/null || \
    git remote add origin https://github.com/wilson1442/Webhook-Hub.git 2>/dev/null
    echo "  Git configured"
fi
echo ""

# Stash local changes
echo "→ Saving local changes..."
git stash push -m "Before update $(date)" 2>/dev/null || true
echo "  Local changes stashed"
echo ""

# Fetch and pull
echo "→ Pulling latest changes from GitHub..."
git fetch origin
git checkout main 2>/dev/null || git checkout -b main origin/main
git pull origin main
COMMIT=$(git rev-parse --short HEAD)
echo "  Current commit: $COMMIT"
echo ""

# Install backend dependencies
echo "→ Installing backend dependencies..."
cd "$APP_DIR/backend"
pip install -r requirements.txt -q
echo "  Backend dependencies updated"
echo ""

# Install frontend dependencies
echo "→ Installing frontend dependencies..."
cd "$APP_DIR/frontend"
yarn install --silent
echo "  Frontend dependencies updated"
echo ""

# Restart services
cd "$APP_DIR"
echo "→ Restarting services..."
echo ""
echo "Choose restart method:"
echo "  1) supervisorctl (systemd)"
echo "  2) pm2"
echo "  3) Manual (I'll restart myself)"
read -p "Choice [1]: " RESTART_METHOD
RESTART_METHOD=${RESTART_METHOD:-1}

case $RESTART_METHOD in
    1)
        sudo supervisorctl restart all 2>/dev/null && echo "  ✓ Services restarted" || echo "  ✗ Restart failed"
        ;;
    2)
        pm2 restart all 2>/dev/null && echo "  ✓ Services restarted" || echo "  ✗ Restart failed"
        ;;
    3)
        echo "  Please restart manually:"
        echo "    Backend:  cd $APP_DIR/backend && uvicorn server:app --host 0.0.0.0 --port 8001"
        echo "    Frontend: cd $APP_DIR/frontend && npm start"
        ;;
esac

echo ""
echo "=========================================="
echo "  Update Complete!"
echo "=========================================="
echo ""
echo "Version: 1.0.0 - main ($COMMIT)"
echo "Backup:  $BACKUP"
echo ""
echo "What's new in v1.0.0:"
echo "  • Fixed dark mode colors"
echo "  • Added GitHub auto-update in Settings → Updates"
echo "  • Enhanced webhook URL display"
echo "  • Automated backup scheduler"
echo "  • Profile page with dark mode toggle"
echo ""
echo "Next steps:"
echo "  1. Open your Webhook Hub in browser"
echo "  2. Go to Settings → Updates"
echo "  3. Enter your repo URL for future auto-updates"
echo ""
