# 🚀 Webhook Gateway Hub - Quick Start

**Version 1.0.0** | Production Ready

## One-Command Installation

Deploy Webhook Gateway Hub on Ubuntu 24.04 LTS in minutes!

### Step 1: Clone Repository

```bash
# Clone to /opt/webhook-gateway (recommended production path)
sudo git clone https://github.com/wilson1442/Webhook-Hub.git /opt/webhook-gateway

# Navigate to directory
cd /opt/webhook-gateway
```

### Step 2: Run Installer

```bash
# Run installer (requires sudo)
sudo ./install.sh
```

**Note**: The application will be installed to `/opt/webhook-gateway` by default.

### Step 2: Follow Prompts

The installer will ask for:
- **Cloudflare Tunnel URL**: `https://gateway.yourdomain.com`
- **Installation Directory**: `/opt/webhook-gateway` (press Enter for default)
- **Database Name**: `webhook_gateway` (press Enter for default)

### Step 3: Configure Cloudflare

When prompted, configure your Cloudflare Tunnel:

1. Go to **Cloudflare Dashboard** → **Zero Trust** → **Tunnels**
2. Create or select tunnel
3. Add Public Hostname:
   - URL: `gateway.yourdomain.com`
   - Service: `HTTP` → `http://localhost:3000`
4. Add API route:
   - URL: `gateway.yourdomain.com/api`
   - Service: `HTTP` → `http://localhost:8001`

Press Enter to continue installation.

### Step 4: Access Application

Once installation completes:

🌐 **URL**: https://gateway.yourdomain.com  
🔐 **Login**: `admin` / `admin123`  
⚠️ **Important**: Change password on first login

## What Gets Installed

✅ **Python 3.11+** - Backend runtime  
✅ **Node.js 20.x** - Frontend build tools  
✅ **MongoDB 7.0** - Database  
✅ **Cloudflared** - Tunnel client  
✅ **FastAPI Backend** - Running on port 8001  
✅ **React Frontend** - Running on port 3000  
✅ **Systemd Services** - Auto-start on boot  

## Post-Installation

### Add SendGrid API Key

1. Login to your application
2. Go to **Settings** → **API Keys**
3. Click **Add API Key** on SendGrid card
4. Enter your SendGrid API Key and Sender Email
5. Click **Verify** to test

### Create Webhook Endpoint

1. Go to **Webhooks** page
2. Click **Create Endpoint**
3. Configure:
   - Name: "My Webhook"
   - Path: "my-webhook"
   - Mode: "Add Contact to List"
   - Select SendGrid List
4. Copy the secret token

### Test Your Webhook

```bash
curl -X POST https://gateway.yourdomain.com/api/hooks/my-webhook \
  -H "X-Webhook-Token: YOUR_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","first_name":"John"}'
```

## Manage Services

```bash
# Check status
sudo systemctl status webhook-gateway-backend
sudo systemctl status webhook-gateway-frontend

# Restart services
sudo systemctl restart webhook-gateway-backend
sudo systemctl restart webhook-gateway-frontend

# View logs
sudo journalctl -u webhook-gateway-backend -f
```

## Troubleshooting

### Installation Issues

If installation fails:

1. **Check Ubuntu version**:
   ```bash
   lsb_release -a
   ```
   Must be Ubuntu 24.04 LTS

2. **Ensure you're running as root**:
   ```bash
   sudo ./install.sh
   ```

3. **Check available disk space**:
   ```bash
   df -h
   ```
   Need at least 20GB free

### Service Not Starting

```bash
# Check error logs
sudo journalctl -u webhook-gateway-backend --no-pager -n 50

# Verify MongoDB is running
sudo systemctl status mongod

# Check if ports are available
sudo netstat -tlnp | grep -E '3000|8001|27017'
```

### Cloudflare Tunnel Issues

```bash
# Test local services first
curl http://localhost:3000
curl http://localhost:8001/api/health

# Verify Cloudflare tunnel configuration
# Make sure hostname and service URLs are correct
```

### Can't Login

If you can't login with `admin`/`admin123`:

```bash
# Option 1: Use the reset script
cd Webhook-Hub  # or your installation directory
sudo ./create-admin.sh

# Option 2: Manual reset
mongosh webhook_gateway --eval "db.users.deleteMany({})"
sudo systemctl restart webhook-gateway-backend

# Wait 10 seconds for backend to create admin user
sleep 10

# Try login again
```

### Cloudflared Not Needed

If you're running Cloudflare Tunnel on another host:
- Answer "n" when asked if you want to install cloudflared
- Configure your tunnel to route to this server's IP:
  - Main app: `http://YOUR_SERVER_IP:3000`
  - API: `http://YOUR_SERVER_IP:8001`

## Need Help?

📖 **Full Documentation**: See `INSTALL_GUIDE.md`  
📁 **Configuration**: `/opt/webhook-gateway/backend/.env`  
📊 **Logs**: `sudo journalctl -u webhook-gateway-backend -f`  

## Directory Structure

```
/opt/webhook-gateway/
├── backend/
│   ├── venv/           # Python virtual environment
│   ├── server.py       # FastAPI application
│   ├── .env            # Backend configuration
│   └── requirements.txt
├── frontend/
│   ├── build/          # Production build
│   ├── src/            # Source code
│   └── .env            # Frontend configuration
```

## Uninstall

```bash
# Stop services
sudo systemctl stop webhook-gateway-backend
sudo systemctl stop webhook-gateway-frontend

# Disable services
sudo systemctl disable webhook-gateway-backend
sudo systemctl disable webhook-gateway-frontend

# Remove service files
sudo rm /etc/systemd/system/webhook-gateway-*

# Remove application
sudo rm -rf /opt/webhook-gateway

# Remove MongoDB (optional)
sudo apt-get remove --purge mongodb-org
```

---

**🎉 You're all set!** Your Webhook Gateway Hub is ready to handle webhooks and integrate with SendGrid.
