#!/bin/bash

###############################################################################
# Webhook Gateway Hub - GitHub Update Script
# Repository: https://github.com/wilson1442/Webhook-Hub
# 
# This script updates your Webhook Gateway Hub installation from GitHub.
# Default installation path: /opt/webhook-gateway
###############################################################################

echo "========================================"
echo "  Webhook Gateway Hub - Update Script"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}➜ $1${NC}"
}

print_question() {
    echo -e "${BLUE}? $1${NC}"
}

# Detect installation directory
print_info "Detecting installation directory..."

# Check common locations
if [ -f "/opt/webhook-gateway/backend/server.py" ]; then
    APP_DIR="/opt/webhook-gateway"
elif [ -f "/app/backend/server.py" ]; then
    APP_DIR="/app"
elif [ -f "./backend/server.py" ]; then
    APP_DIR="$(pwd)"
elif [ -f "../backend/server.py" ]; then
    APP_DIR="$(dirname $(pwd))"
elif [ -f "$HOME/webhook-gateway/backend/server.py" ]; then
    APP_DIR="$HOME/webhook-gateway"
elif [ -f "$HOME/Webhook-Hub/backend/server.py" ]; then
    APP_DIR="$HOME/Webhook-Hub"
else
    print_error "Could not find Webhook Gateway Hub installation!"
    echo ""
    print_question "Please enter the full path to your installation directory:"
    print_info "Example: /opt/webhook-gateway or /home/user/webhook-gateway"
    read -p "Path: " APP_DIR
    
    if [ ! -f "$APP_DIR/backend/server.py" ]; then
        print_error "backend/server.py not found in $APP_DIR"
        echo ""
        print_info "To install fresh from GitHub, run:"
        echo "  git clone https://github.com/wilson1442/Webhook-Hub.git /opt/webhook-gateway"
        echo "  cd /opt/webhook-gateway"
        echo "  bash install.sh"
        exit 1
    fi
fi

print_success "Found installation at: $APP_DIR"
cd "$APP_DIR"

print_success "Found installation at: $APP_DIR"
cd "$APP_DIR"
echo ""

print_info "Current directory: $(pwd)"
echo ""

# Step 1: Backup current state
print_info "Step 1: Creating backup of current state..."
BACKUP_DIR="/tmp/webhook-backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r "$APP_DIR/backend" "$BACKUP_DIR/" 2>/dev/null || true
cp -r "$APP_DIR/frontend" "$BACKUP_DIR/" 2>/dev/null || true
[ -f "$APP_DIR/.env" ] && cp "$APP_DIR/.env" "$BACKUP_DIR/" 2>/dev/null || true
[ -f "$APP_DIR/backend/.env" ] && cp "$APP_DIR/backend/.env" "$BACKUP_DIR/" 2>/dev/null || true
[ -f "$APP_DIR/frontend/.env" ] && cp "$APP_DIR/frontend/.env" "$BACKUP_DIR/" 2>/dev/null || true
print_success "Backup created at: $BACKUP_DIR"
echo ""

# Step 2: Check git repository
print_info "Step 2: Checking git repository..."
if [ ! -d ".git" ]; then
    print_error "Not a git repository. Initializing..."
    git init
    git remote add origin https://github.com/wilson1442/Webhook-Hub.git
    print_success "Git repository initialized"
else
    # Check if remote exists
    if ! git remote get-url origin &>/dev/null; then
        git remote add origin https://github.com/wilson1442/Webhook-Hub.git
        print_success "Added remote origin"
    else
        # Update remote URL to ensure it's correct
        git remote set-url origin https://github.com/wilson1442/Webhook-Hub.git
        print_success "Remote origin updated"
    fi
fi
echo ""

# Step 3: Stash local changes
print_info "Step 3: Stashing local changes (if any)..."
git stash push -m "Auto-stash before update $(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
print_success "Local changes stashed"
echo ""

# Step 4: Fetch latest changes
print_info "Step 4: Fetching latest changes from GitHub..."
git fetch origin --tags
print_success "Fetched latest changes"
echo ""

# Step 5: Determine version to deploy
print_info "Step 5: Determining latest version..."
LATEST_TAG=$(git ls-remote --tags origin | grep -v '{}' | awk '{print $2}' | sed 's/refs\/tags\///' | sort -V | tail -1)

if [ -z "$LATEST_TAG" ]; then
    print_info "No tags found. Using main branch..."
    TARGET="main"
else
    print_info "Latest tag found: $LATEST_TAG"
    TARGET="$LATEST_TAG"
fi
echo ""

# Step 6: Checkout target version
print_info "Step 6: Checking out $TARGET..."
git checkout $TARGET 2>/dev/null || git checkout -b $TARGET origin/$TARGET 2>/dev/null || git checkout main
git pull origin $TARGET 2>/dev/null || git pull origin main
CURRENT_COMMIT=$(git rev-parse --short HEAD)
print_success "Checked out: $TARGET (commit: $CURRENT_COMMIT)"
echo ""

# Step 7: Install backend dependencies
print_info "Step 7: Installing backend dependencies..."
cd "$APP_DIR/backend"
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt --quiet 2>&1 | tail -5
    print_success "Backend dependencies installed"
else
    print_error "requirements.txt not found!"
fi
echo ""

# Step 8: Install frontend dependencies
print_info "Step 8: Installing frontend dependencies..."
cd "$APP_DIR/frontend"
if [ -f "package.json" ]; then
    yarn install --silent 2>&1 | tail -5
    print_success "Frontend dependencies installed"
else
    print_error "package.json not found!"
fi
echo ""

# Step 9: Restart services
print_info "Step 9: Restarting services..."
echo ""
print_question "Do you use supervisorctl to manage services? (y/n)"
read -p "Answer: " USE_SUPERVISOR

if [ "$USE_SUPERVISOR" = "y" ] || [ "$USE_SUPERVISOR" = "Y" ]; then
    sudo supervisorctl restart all
    sleep 3
    print_success "Services restarted via supervisorctl"
    
    # Step 10: Verify services
    print_info "Step 10: Verifying services..."
    BACKEND_STATUS=$(sudo supervisorctl status backend 2>/dev/null | awk '{print $2}')
    FRONTEND_STATUS=$(sudo supervisorctl status frontend 2>/dev/null | awk '{print $2}')

    if [ "$BACKEND_STATUS" = "RUNNING" ]; then
        print_success "Backend is running"
    else
        print_error "Backend is not running! Status: $BACKEND_STATUS"
    fi

    if [ "$FRONTEND_STATUS" = "RUNNING" ]; then
        print_success "Frontend is running"
    else
        print_error "Frontend is not running! Status: $FRONTEND_STATUS"
    fi
else
    print_info "Please restart your services manually:"
    echo "  Backend: cd $APP_DIR/backend && uvicorn server:app --reload"
    echo "  Frontend: cd $APP_DIR/frontend && npm start"
fi
echo ""

# Final summary
echo "=========================================="
echo "  Update Complete!"
echo "=========================================="
echo ""
echo "Version: 1.0.0 - $TARGET (commit: $CURRENT_COMMIT)"
echo "Backup Location: $BACKUP_DIR"
echo ""
print_success "Your Webhook Gateway Hub has been updated successfully!"
echo ""
print_info "What's New in v1.0.0:"
echo "  • Dark mode with improved colors"
echo "  • GitHub auto-update system"
echo "  • Enhanced webhook display with full URLs"
echo "  • Automated backup scheduler"
echo "  • Profile page with preferences"
echo ""
print_info "If you encounter any issues:"
echo "  1. Check logs: tail -f /var/log/supervisor/backend.err.log"
echo "  2. Check logs: tail -f /var/log/supervisor/frontend.err.log"
echo "  3. Restore from backup: cp -r $BACKUP_DIR/* /app/"
echo ""
