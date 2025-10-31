#!/bin/bash

#####################################################################
# Webhook Gateway Hub - Ubuntu 24.04 Installation Script
# Tech Stack: FastAPI (Python) + React + MongoDB
# 
# This script will:
# - Install all dependencies (Python, Node.js, MongoDB, Cloudflared)
# - Set up the database
# - Configure environment variables
# - Set up Cloudflare Tunnel
# - Start services with systemd
#####################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   log_error "This script must be run as root (use sudo)"
   exit 1
fi

# Check Ubuntu version
log_info "Checking Ubuntu version..."
if ! grep -q "Ubuntu 24.04" /etc/os-release; then
    log_warning "This script is designed for Ubuntu 24.04 LTS"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

log_success "Environment check passed"

#####################################################################
# PART 1: Gather User Input
#####################################################################

echo ""
echo "=========================================="
echo "  Webhook Gateway Hub Installation"
echo "=========================================="
echo ""

# Get Cloudflare Tunnel URL
read -p "Enter your Cloudflare Tunnel URL (e.g., https://gateway.yourdomain.com): " TUNNEL_URL
if [[ -z "$TUNNEL_URL" ]]; then
    log_error "Tunnel URL is required"
    exit 1
fi

# Ask if cloudflared should be installed
read -p "Do you want to install Cloudflared on this server? (y/n) [n]: " INSTALL_CLOUDFLARED
INSTALL_CLOUDFLARED=${INSTALL_CLOUDFLARED:-n}

# Get installation directory
read -p "Installation directory [/opt/webhook-gateway]: " INSTALL_DIR
INSTALL_DIR=${INSTALL_DIR:-/opt/webhook-gateway}

# Database credentials
read -p "MongoDB database name [webhook_gateway]: " DB_NAME
DB_NAME=${DB_NAME:-webhook_gateway}

#####################################################################
# PART 2: Install System Dependencies
#####################################################################

log_info "Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

log_info "Installing system dependencies..."
apt-get install -y -qq \
    curl \
    wget \
    git \
    build-essential \
    software-properties-common \
    gnupg \
    lsb-release \
    ca-certificates \
    python3-pip \
    python3-venv

log_success "System dependencies installed"

#####################################################################
# PART 3: Install Node.js 20.x
#####################################################################

log_info "Installing Node.js 20.x..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    npm install -g yarn pm2
    log_success "Node.js and Yarn installed"
else
    log_info "Node.js already installed ($(node --version))"
fi

#####################################################################
# PART 4: Install MongoDB
#####################################################################

log_info "Installing MongoDB..."
if ! command -v mongod &> /dev/null; then
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
        gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
    
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
        tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    
    apt-get update -qq
    apt-get install -y mongodb-org
    
    # Start and enable MongoDB
    systemctl start mongod
    systemctl enable mongod
    
    log_success "MongoDB installed and started"
else
    log_info "MongoDB already installed"
fi

#####################################################################
# PART 5: Install Cloudflared (Optional)
#####################################################################

if [[ "$INSTALL_CLOUDFLARED" =~ ^[Yy]$ ]]; then
    log_info "Installing Cloudflare Tunnel (cloudflared)..."
    if ! command -v cloudflared &> /dev/null; then
        wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
        dpkg -i cloudflared-linux-amd64.deb
        rm cloudflared-linux-amd64.deb
        log_success "Cloudflared installed"
    else
        log_info "Cloudflared already installed"
    fi
else
    log_info "Skipping Cloudflared installation (running on another host)"
fi

#####################################################################
# PART 6: Clone/Setup Application
#####################################################################

log_info "Setting up application in $INSTALL_DIR..."

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if backend and frontend exist in the script directory
if [ -d "$SCRIPT_DIR/backend" ] && [ -d "$SCRIPT_DIR/frontend" ]; then
    log_info "Found application files in $SCRIPT_DIR"
    
    # If install directory is different from script directory, copy files
    if [ "$SCRIPT_DIR" != "$INSTALL_DIR" ]; then
        log_info "Copying application files to $INSTALL_DIR..."
        mkdir -p "$INSTALL_DIR"
        cp -r "$SCRIPT_DIR/backend" "$INSTALL_DIR/"
        cp -r "$SCRIPT_DIR/frontend" "$INSTALL_DIR/"
        
        # Copy documentation files
        [ -f "$SCRIPT_DIR/README.md" ] && cp "$SCRIPT_DIR/README.md" "$INSTALL_DIR/"
        [ -f "$SCRIPT_DIR/DEPLOYMENT.md" ] && cp "$SCRIPT_DIR/DEPLOYMENT.md" "$INSTALL_DIR/"
        [ -f "$SCRIPT_DIR/INSTALL_GUIDE.md" ] && cp "$SCRIPT_DIR/INSTALL_GUIDE.md" "$INSTALL_DIR/"
        [ -f "$SCRIPT_DIR/QUICKSTART.md" ] && cp "$SCRIPT_DIR/QUICKSTART.md" "$INSTALL_DIR/"
        
        log_success "Application files copied"
    else
        log_info "Installing in place at $INSTALL_DIR"
        INSTALL_DIR="$SCRIPT_DIR"
    fi
else
    log_error "Application files not found!"
    log_error "Make sure you run this script from the Webhook-Hub directory."
    log_error "Expected structure:"
    log_error "  Webhook-Hub/"
    log_error "    ├── backend/"
    log_error "    ├── frontend/"
    log_error "    └── install.sh"
    echo ""
    log_error "If you haven't cloned the repository yet, run:"
    log_error "  git clone https://github.com/wilson1442/Webhook-Hub.git"
    log_error "  cd Webhook-Hub"
    log_error "  sudo ./install.sh"
    exit 1
fi

#####################################################################
# PART 7: Setup Backend (FastAPI)
#####################################################################

log_info "Setting up Python backend..."

cd "$INSTALL_DIR/backend"

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install --upgrade pip -q
pip install -r requirements.txt -q

# Generate secrets
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")

# Create .env file
cat > .env << EOF
MONGO_URL="mongodb://localhost:27017"
DB_NAME="$DB_NAME"
CORS_ORIGINS="*"
JWT_SECRET="$JWT_SECRET"
ENCRYPTION_KEY="$ENCRYPTION_KEY"
EOF

log_success "Backend configured"

#####################################################################
# PART 8: Setup Frontend (React)
#####################################################################

log_info "Setting up React frontend..."

cd "$INSTALL_DIR/frontend"

# Install dependencies
yarn install --silent

# Create .env file
cat > .env << EOF
REACT_APP_BACKEND_URL="$TUNNEL_URL"
REACT_APP_ENABLE_VISUAL_EDITS=false
ENABLE_HEALTH_CHECK=false
EOF

# Build production frontend
log_info "Building frontend (this may take a few minutes)..."
yarn build

log_success "Frontend built"

#####################################################################
# PART 9: Setup Systemd Services
#####################################################################

log_info "Creating systemd services..."

# Backend service
cat > /etc/systemd/system/webhook-gateway-backend.service << EOF
[Unit]
Description=Webhook Gateway Backend (FastAPI)
After=network.target mongod.service

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR/backend
Environment="PATH=$INSTALL_DIR/backend/venv/bin"
ExecStart=$INSTALL_DIR/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Frontend service (using serve to host the build)
npm install -g serve

cat > /etc/systemd/system/webhook-gateway-frontend.service << EOF
[Unit]
Description=Webhook Gateway Frontend (React)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR/frontend/build
ExecStart=/usr/bin/npx serve -s . -l 3000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
systemctl daemon-reload

# Enable services
systemctl enable webhook-gateway-backend.service
systemctl enable webhook-gateway-frontend.service

# Make sure MongoDB is fully started
log_info "Waiting for MongoDB to be ready..."
sleep 5
until mongosh --eval "db.adminCommand('ping')" &> /dev/null; do
    log_info "Waiting for MongoDB..."
    sleep 2
done
log_success "MongoDB is ready"

# Start backend first and wait for it to create admin user
log_info "Starting backend service..."
systemctl start webhook-gateway-backend.service
sleep 10

# Verify admin user was created
log_info "Verifying admin user creation..."
ADMIN_EXISTS=$(mongosh "$DB_NAME" --quiet --eval "db.users.countDocuments({username: 'admin'})")

if [ "$ADMIN_EXISTS" -eq "0" ]; then
    log_warning "Admin user not found, creating manually..."
    
    # Create admin user manually using Python
    cd "$INSTALL_DIR/backend"
    source venv/bin/activate
    
    python3 << 'EOFPYTHON'
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
import uuid
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

load_dotenv()

async def create_admin():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    # Check if admin exists
    existing = await db.users.find_one({"username": "admin"})
    if existing:
        print("Admin user already exists")
        return
    
    # Create admin user
    password_hash = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    admin_user = {
        "id": str(uuid.uuid4()),
        "username": "admin",
        "password_hash": password_hash,
        "role": "admin",
        "force_password_change": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_login": None
    }
    
    await db.users.insert_one(admin_user)
    print("Admin user created successfully")
    client.close()

asyncio.run(create_admin())
EOFPYTHON
    
    deactivate
    log_success "Admin user created"
else
    log_success "Admin user exists"
fi

# Now start frontend
log_info "Starting frontend service..."
systemctl start webhook-gateway-frontend.service

log_success "Systemd services created and started"

#####################################################################
# PART 10: Setup Cloudflare Tunnel
#####################################################################

if [[ "$INSTALL_CLOUDFLARED" =~ ^[Yy]$ ]]; then
    log_info "Configuring Cloudflare Tunnel..."

    echo ""
    echo "=========================================="
    echo "  Cloudflare Tunnel Configuration"
    echo "=========================================="
    echo ""
    echo "Your tunnel URL: $TUNNEL_URL"
    echo ""
    echo "Please complete the following steps in your Cloudflare Dashboard:"
    echo ""
    echo "1. Go to Zero Trust > Access > Tunnels"
    echo "2. Create or select your tunnel"
    echo "3. Add a Public Hostname with these settings:"
    echo "   - Public Hostname: Your tunnel URL (${TUNNEL_URL})"
    echo "   - Service Type: HTTP"
    echo "   - URL: http://localhost:3000"
    echo "   - TLS Verification: Full (Strict)"
    echo ""
    echo "4. For API requests, add another hostname rule:"
    echo "   - Path: /api/*"
    echo "   - Service: http://localhost:8001"
    echo ""
    read -p "Press Enter after configuring the tunnel in Cloudflare Dashboard..."
else
    echo ""
    echo "=========================================="
    echo "  Cloudflare Tunnel Configuration"
    echo "=========================================="
    echo ""
    echo "Cloudflared is running on another host."
    echo ""
    echo "Make sure your Cloudflare Tunnel routes traffic to:"
    echo "   Main App:  $TUNNEL_URL → http://THIS_SERVER_IP:3000"
    echo "   API:       $TUNNEL_URL/api → http://THIS_SERVER_IP:8001"
    echo ""
    echo "Where THIS_SERVER_IP is the IP address of this server."
    echo ""
    read -p "Press Enter to continue..."
fi

#####################################################################
# PART 11: Verify Installation
#####################################################################

log_info "Verifying installation..."

# Wait for services to start
sleep 5

# Check MongoDB
if systemctl is-active --quiet mongod; then
    log_success "MongoDB is running"
else
    log_error "MongoDB is not running"
fi

# Check Backend
if systemctl is-active --quiet webhook-gateway-backend; then
    log_success "Backend service is running"
else
    log_error "Backend service is not running"
fi

# Check Frontend
if systemctl is-active --quiet webhook-gateway-frontend; then
    log_success "Frontend service is running"
else
    log_error "Frontend service is not running"
fi

# Test backend health
if curl -f http://localhost:8001/api/health &> /dev/null; then
    log_success "Backend API is responding"
else
    log_warning "Backend API is not responding yet (may take a moment to start)"
fi

# Test tunnel connection
log_info "Testing Cloudflare Tunnel connection..."
if curl -f "$TUNNEL_URL/api/health" &> /dev/null; then
    log_success "Cloudflare Tunnel is working!"
else
    log_warning "Cloudflare Tunnel connection failed. Please verify your tunnel configuration."
fi

# Test admin login
log_info "Testing admin login..."
LOGIN_RESPONSE=$(curl -s -X POST "$TUNNEL_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}')

if echo "$LOGIN_RESPONSE" | grep -q "token"; then
    log_success "Admin login is working!"
else
    log_warning "Admin login test failed. You may need to wait a moment for services to fully start."
    log_info "Try logging in manually at: $TUNNEL_URL"
fi

#####################################################################
# PART 12: Display Final Information
#####################################################################

echo ""
echo "=========================================="
echo "  ✅ Installation Complete!"
echo "=========================================="
echo ""
echo "📍 Installation Directory: $INSTALL_DIR"
echo ""
echo "🌐 Access URLs:"
echo "   Local:      http://localhost:3000"
echo "   Cloudflare: $TUNNEL_URL"
echo ""
echo "🔐 Default Login Credentials:"
echo "   Username: admin"
echo "   Password: admin123"
echo "   ⚠️  You will be prompted to change password on first login"
echo ""
echo "🛠️  Manage Services:"
echo "   Backend:  sudo systemctl {start|stop|restart|status} webhook-gateway-backend"
echo "   Frontend: sudo systemctl {start|stop|restart|status} webhook-gateway-frontend"
echo "   MongoDB:  sudo systemctl {start|stop|restart|status} mongod"
echo ""
echo "📋 View Logs:"
echo "   Backend:  sudo journalctl -u webhook-gateway-backend -f"
echo "   Frontend: sudo journalctl -u webhook-gateway-frontend -f"
echo ""
echo "📖 Next Steps:"
echo "   1. Access the application: $TUNNEL_URL"
echo "   2. Login with default credentials (admin/admin123)"
echo "   3. Change your password"
echo "   4. Go to Settings → API Keys"
echo "   5. Add your SendGrid API key"
echo "   6. Create webhook endpoints"
echo ""
echo "📁 Configuration Files:"
echo "   Backend:  $INSTALL_DIR/backend/.env"
echo "   Frontend: $INSTALL_DIR/frontend/.env"
echo ""
echo "🔒 Security Recommendations:"
echo "   - Change the default admin password immediately"
echo "   - Keep your system updated: sudo apt-get update && sudo apt-get upgrade"
echo "   - Enable firewall: sudo ufw enable"
echo "   - Restrict MongoDB access if needed"
echo ""
echo "🐛 Troubleshooting Login Issues:"
echo "   If admin/admin123 doesn't work, try:"
echo "   1. Wait 30 seconds for services to fully start"
echo "   2. Check backend logs: sudo journalctl -u webhook-gateway-backend -n 50"
echo "   3. Verify admin user exists: mongosh $DB_NAME --eval 'db.users.find({username:\"admin\"})'"
echo "   4. Reset admin user: mongosh $DB_NAME --eval 'db.users.deleteMany({})' && sudo systemctl restart webhook-gateway-backend"
echo ""
echo "=========================================="
echo ""

log_success "Webhook Gateway Hub is ready to use!"

exit 0
