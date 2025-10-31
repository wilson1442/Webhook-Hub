# Webhook Gateway Hub - Installation & Deployment Guide

**Version 1.0.0** | Production Ready

## Overview

This guide covers deploying the Webhook Gateway Hub v1.0.0 on Ubuntu 24.04 LTS with Cloudflare Tunnel.

**Tech Stack:**
- Backend: FastAPI (Python 3.11+)
- Frontend: React 19
- Database: MongoDB 7.0
- Reverse Proxy: Cloudflare Tunnel

## Prerequisites

### System Requirements
- Ubuntu 24.04 LTS (fresh installation recommended)
- Minimum 2GB RAM
- 20GB disk space
- Root or sudo access

### Required Accounts
1. **Cloudflare Account** (Free tier works)
   - Domain added to Cloudflare
   - Zero Trust dashboard access

2. **SendGrid Account** (Optional, for email features)
   - API key with Marketing permissions
   - Verified sender email

## Installation Methods

### Method 1: Automated Installation (Recommended)

**Step 1: Clone the Repository**
```bash
git clone https://github.com/wilson1442/Webhook-Hub.git
cd Webhook-Hub
```

**Step 2: Verify Directory Structure**
```bash
# You should see these directories:
ls -la
# Expected output:
#   backend/
#   frontend/
#   install.sh
#   README.md
```

**Step 3: Run the Installer**
```bash
# Make install script executable
chmod +x install.sh

# Run installer (must be in Webhook-Hub directory)
sudo ./install.sh
```

⚠️ **Important**: Always run `install.sh` from inside the `Webhook-Hub` directory. The script needs to find the `backend/` and `frontend/` folders.

**Step 4: Follow the prompts**
   - Enter Cloudflare Tunnel URL: `https://gateway.yourdomain.com`
   - Installation directory: `/opt/webhook-gateway` (default)
   - Database name: `webhook_gateway` (default)

4. **Configure Cloudflare Tunnel**
   
   The installer will pause and prompt you to configure your tunnel in Cloudflare Dashboard:
   
   **In Cloudflare Dashboard:**
   - Go to **Zero Trust** → **Access** → **Tunnels**
   - Create a new tunnel or select existing
   - Add Public Hostname:
     - **Subdomain**: gateway (or your choice)
     - **Domain**: yourdomain.com
     - **Path**: (leave empty)
     - **Service Type**: HTTP
     - **URL**: `http://localhost:3000`
   
   - Add another hostname for API:
     - **Subdomain**: gateway
     - **Domain**: yourdomain.com
     - **Path**: `/api`
     - **Service Type**: HTTP
     - **URL**: `http://localhost:8001`

5. **Complete installation**
   - Press Enter after configuring Cloudflare
   - Installer will verify all services

6. **Access your application**
   - URL: `https://gateway.yourdomain.com`
   - Login: `admin` / `admin123`
   - Change password on first login

### Method 2: Manual Installation

#### Step 1: Update System
```bash
sudo apt-get update
sudo apt-get upgrade -y
```

#### Step 2: Install Dependencies

**Install Node.js 20.x**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs
sudo npm install -g yarn pm2
```

**Install Python 3.11+**
```bash
sudo apt-get install -y python3 python3-pip python3-venv
```

**Install MongoDB 7.0**
```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
   sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

**Install Cloudflared**
```bash
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

#### Step 3: Setup Application

**Create installation directory**
```bash
sudo mkdir -p /opt/webhook-gateway
cd /opt/webhook-gateway
```

**Copy application files**
```bash
# Copy your backend and frontend directories here
sudo cp -r /path/to/source/backend .
sudo cp -r /path/to/source/frontend .
```

#### Step 4: Configure Backend

```bash
cd /opt/webhook-gateway/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
MONGO_URL="mongodb://localhost:27017"
DB_NAME="webhook_gateway"
CORS_ORIGINS="*"
JWT_SECRET="$(openssl rand -base64 32)"
ENCRYPTION_KEY="$(python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')"
EOF
```

#### Step 5: Configure Frontend

```bash
cd /opt/webhook-gateway/frontend

# Install dependencies
yarn install

# Create .env file
cat > .env << EOF
REACT_APP_BACKEND_URL="https://gateway.yourdomain.com"
REACT_APP_ENABLE_VISUAL_EDITS=false
ENABLE_HEALTH_CHECK=false
EOF

# Build production bundle
yarn build
```

#### Step 6: Create Systemd Services

**Backend Service**
```bash
sudo tee /etc/systemd/system/webhook-gateway-backend.service << EOF
[Unit]
Description=Webhook Gateway Backend
After=network.target mongod.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/webhook-gateway/backend
Environment="PATH=/opt/webhook-gateway/backend/venv/bin"
ExecStart=/opt/webhook-gateway/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always

[Install]
WantedBy=multi-user.target
EOF
```

**Frontend Service**
```bash
sudo npm install -g serve

sudo tee /etc/systemd/system/webhook-gateway-frontend.service << EOF
[Unit]
Description=Webhook Gateway Frontend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/webhook-gateway/frontend/build
ExecStart=/usr/bin/npx serve -s . -l 3000
Restart=always

[Install]
WantedBy=multi-user.target
EOF
```

**Start Services**
```bash
sudo systemctl daemon-reload
sudo systemctl enable webhook-gateway-backend
sudo systemctl enable webhook-gateway-frontend
sudo systemctl start webhook-gateway-backend
sudo systemctl start webhook-gateway-frontend
```

#### Step 7: Configure Cloudflare Tunnel

See "Cloudflare Tunnel Configuration" section below.

## Cloudflare Tunnel Configuration

### Create Tunnel (One-time Setup)

1. Login to Cloudflare Dashboard
2. Go to **Zero Trust** → **Access** → **Tunnels**
3. Click **Create a tunnel**
4. Choose **Cloudflared**
5. Name your tunnel: `webhook-gateway`
6. Click **Save tunnel**
7. Follow the installation instructions shown (or skip if already installed)

### Configure Public Hostname

**Main Application Route:**
- **Public hostname**: `gateway.yourdomain.com`
- **Service**: 
  - Type: `HTTP`
  - URL: `http://localhost:3000`
- **Additional settings**:
  - TLS: `Full (Strict)`
  - HTTP Host Header: (leave default)

**API Route:**
- **Public hostname**: `gateway.yourdomain.com`
- **Path**: `/api`
- **Service**:
  - Type: `HTTP`
  - URL: `http://localhost:8001`

### Verify Tunnel

```bash
# Test local services
curl http://localhost:3000
curl http://localhost:8001/api/health

# Test through tunnel
curl https://gateway.yourdomain.com/api/health
```

## Post-Installation Configuration

### 1. First Login

1. Navigate to `https://gateway.yourdomain.com`
2. Login with:
   - Username: `admin`
   - Password: `admin123`
3. You'll be prompted to change password immediately
4. Choose a strong password

### 2. Add SendGrid API Key

1. Login to SendGrid and get your API key
2. In Webhook Gateway Hub:
   - Go to **Settings** → **API Keys**
   - Click **Add API Key** on SendGrid card
   - Enter:
     - **API Key**: Your SendGrid API key
     - **Sender Email**: Your verified sender email
   - Click **Save API Key**
   - Click **Verify** to test connection

### 3. Create Your First Webhook

1. Go to **Webhooks** page
2. Click **Create Endpoint**
3. Fill in:
   - **Name**: "Lead Intake"
   - **Path**: "lead-intake"
   - **Mode**: "Add Contact to List"
   - **SendGrid List**: Select from dropdown
   - **Field Mapping**: Configure JSON field mapping
4. Click **Create Endpoint**
5. Copy the **Secret Token**

### 4. Test Your Webhook

```bash
curl -X POST https://gateway.yourdomain.com/api/hooks/lead-intake \
  -H "X-Webhook-Token: YOUR_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "first_name": "John",
    "last_name": "Doe"
  }'
```

Check the **Logs** page to see the request.

## Service Management

### Start/Stop Services

```bash
# Backend
sudo systemctl start webhook-gateway-backend
sudo systemctl stop webhook-gateway-backend
sudo systemctl restart webhook-gateway-backend

# Frontend
sudo systemctl start webhook-gateway-frontend
sudo systemctl stop webhook-gateway-frontend
sudo systemctl restart webhook-gateway-frontend

# MongoDB
sudo systemctl start mongod
sudo systemctl stop mongod
sudo systemctl restart mongod
```

### Check Service Status

```bash
sudo systemctl status webhook-gateway-backend
sudo systemctl status webhook-gateway-frontend
sudo systemctl status mongod
```

### View Logs

```bash
# Backend logs
sudo journalctl -u webhook-gateway-backend -f

# Frontend logs
sudo journalctl -u webhook-gateway-frontend -f

# MongoDB logs
sudo journalctl -u mongod -f
```

## Troubleshooting

### Services Won't Start

**Check logs:**
```bash
sudo journalctl -u webhook-gateway-backend --no-pager -n 50
```

**Common issues:**
- Python dependencies missing: Reinstall in venv
- MongoDB not running: `sudo systemctl start mongod`
- Port already in use: Check with `sudo netstat -tlnp`

### Cloudflare Tunnel Not Working

**Verify tunnel status:**
```bash
sudo cloudflared tunnel info
```

**Check tunnel configuration in Cloudflare Dashboard:**
- Ensure public hostname is correct
- Verify service URLs are `http://localhost:3000` and `http://localhost:8001`
- Check if tunnel is running

### Database Connection Issues

**Test MongoDB:**
```bash
mongosh --eval "db.adminCommand('ping')"
```

**Check MongoDB status:**
```bash
sudo systemctl status mongod
```

### API Key Verification Fails

**Common causes:**
- Invalid SendGrid API key
- API key doesn't have required permissions
- Network connectivity issues

**Solution:**
1. Verify key in SendGrid dashboard
2. Ensure API key has Marketing permissions
3. Test manually:
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.sendgrid.com/v3/scopes
```

## Security Recommendations

### 1. Firewall Configuration

```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow 22

# Allow HTTP/HTTPS (for Cloudflare Tunnel)
sudo ufw allow 80
sudo ufw allow 443

# Deny direct access to services (optional)
sudo ufw deny 3000
sudo ufw deny 8001
sudo ufw deny 27017
```

### 2. SSL/TLS

Cloudflare Tunnel provides automatic HTTPS. Ensure:
- TLS mode is set to "Full (Strict)"
- SSL certificates are valid
- HSTS is enabled in Cloudflare

### 3. MongoDB Security

```bash
# Enable authentication
mongosh admin --eval 'db.createUser({
  user: "webhook_admin",
  pwd: "STRONG_PASSWORD",
  roles: ["dbOwner"]
})'

# Update backend .env
MONGO_URL="mongodb://webhook_admin:STRONG_PASSWORD@localhost:27017"
```

### 4. Regular Updates

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Update Python packages
cd /opt/webhook-gateway/backend
source venv/bin/activate
pip install --upgrade -r requirements.txt

# Update Node packages
cd /opt/webhook-gateway/frontend
yarn upgrade
```

### 5. Backups

**Backup Script:**
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/webhook-gateway"

mkdir -p $BACKUP_DIR

# Backup MongoDB
mongodump --out=$BACKUP_DIR/mongodb_$DATE

# Backup configuration
cp -r /opt/webhook-gateway/backend/.env $BACKUP_DIR/backend_env_$DATE
cp -r /opt/webhook-gateway/frontend/.env $BACKUP_DIR/frontend_env_$DATE

# Create archive
tar -czf $BACKUP_DIR/backup_$DATE.tar.gz $BACKUP_DIR/mongodb_$DATE $BACKUP_DIR/*env_$DATE

# Clean up
rm -rf $BACKUP_DIR/mongodb_$DATE $BACKUP_DIR/*env_$DATE
```

## Updating the Application

### Update Backend Code

```bash
cd /opt/webhook-gateway/backend
sudo systemctl stop webhook-gateway-backend

# Pull new code or copy updated files
git pull  # if using git

# Update dependencies
source venv/bin/activate
pip install -r requirements.txt

sudo systemctl start webhook-gateway-backend
```

### Update Frontend Code

```bash
cd /opt/webhook-gateway/frontend
sudo systemctl stop webhook-gateway-frontend

# Pull new code
git pull  # if using git

# Rebuild
yarn install
yarn build

sudo systemctl start webhook-gateway-frontend
```

## Monitoring

### Setup Basic Monitoring

**Create monitoring script:**
```bash
sudo tee /usr/local/bin/webhook-monitor.sh << 'EOF'
#!/bin/bash

check_service() {
    if systemctl is-active --quiet $1; then
        echo "✓ $1 is running"
    else
        echo "✗ $1 is down - attempting restart"
        systemctl start $1
    fi
}

check_service webhook-gateway-backend
check_service webhook-gateway-frontend
check_service mongod
EOF

sudo chmod +x /usr/local/bin/webhook-monitor.sh
```

**Add to crontab (runs every 5 minutes):**
```bash
sudo crontab -e
# Add line:
*/5 * * * * /usr/local/bin/webhook-monitor.sh >> /var/log/webhook-monitor.log 2>&1
```

## Support

### Log Locations
- Backend: `/var/log/webhook-gateway/backend.log`
- Frontend: `/var/log/webhook-gateway/frontend.log`
- MongoDB: `/var/log/mongodb/mongod.log`
- System: `journalctl -xe`

### Useful Commands

```bash
# Check disk space
df -h

# Check memory usage
free -h

# Check CPU usage
top

# Check network connections
sudo netstat -tlnp

# Check MongoDB connections
mongosh --eval "db.serverStatus().connections"
```

---

**Installation Complete!** Your Webhook Gateway Hub should now be running at your Cloudflare Tunnel URL.
