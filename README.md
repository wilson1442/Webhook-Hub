# 🚀 Webhook Gateway Hub

**Version 1.0.0** - Production Ready

A self-hosted webhook management platform with SendGrid integration, built with modern web technologies.

![Version](https://img.shields.io/badge/Version-1.0.0-blue)
![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![Stack](https://img.shields.io/badge/Stack-FastAPI%20%2B%20React%20%2B%20MongoDB-blue)

## 📋 Overview

Webhook Gateway Hub is a powerful platform that allows you to create, manage, and monitor webhook endpoints with seamless SendGrid integration. Perfect for businesses that need to handle incoming webhooks and forward data to email marketing campaigns.

## 🎯 Quick Installation

### Ubuntu 24.04 LTS (Automated)

```bash
# Step 1: Clone the repository
git clone https://github.com/wilson1442/Webhook-Hub.git
cd Webhook-Hub

# Step 2: Make install script executable
chmod +x install.sh

# Step 3: Run the installer (must be run from Webhook-Hub directory)
sudo ./install.sh
```

The installer will:
- ✅ Install all dependencies (Python, Node.js, MongoDB, Cloudflared)
- ✅ Configure the application
- ✅ Set up systemd services
- ✅ Guide you through Cloudflare Tunnel setup

**Installation time:** ~10-15 minutes

**Important**: The install script must be run from inside the `Webhook-Hub` directory.

### Access Your Application

After installation completes:
- **URL**: Your Cloudflare Tunnel URL (e.g., https://gateway.yourdomain.com)
- **Default Login**: `admin` / `admin123`
- **Important**: You'll be prompted to change password on first login

📖 **Detailed Installation Guide**: See [INSTALL_GUIDE.md](INSTALL_GUIDE.md)  
⚡ **Quick Reference**: See [QUICKSTART.md](QUICKSTART.md)

## ✨ Key Features

### v1.0.0 Highlights
- 🎨 **Dark Mode**: Beautiful dark theme with proper contrast and colors
- 🔄 **GitHub Auto-Update**: Built-in update system - pull and deploy directly from GitHub
- 📊 **Enhanced UI**: Improved webhook display with full URLs and better layout
- 💾 **Automated Backups**: Scheduled backup system with retention policies

### Core Features
- 🔐 **User Authentication**: Role-based access (Admin/Standard) with JWT
- 🪝 **Webhook Management**: Create custom endpoints with secret tokens
- 📧 **SendGrid Integration**: Add contacts to lists or send template emails
- 📊 **Dashboard**: Real-time analytics and activity monitoring
- 📝 **Request Logging**: Comprehensive logs with CSV export and detailed views
- ⚙️ **API Key Management**: Encrypted storage for integration credentials
- 💾 **Backup System**: Manual and automated backups with local retention
- 👥 **User Management**: Admin panel for managing system users
- 🔍 **Search & Filter**: Search lists, templates, and filter logs
- 🎨 **Modern UI**: Beautiful, responsive design with glass-morphism effects and dark mode

## 🛠️ Tech Stack

**Backend**: FastAPI, MongoDB, Motor, JWT, bcrypt, Cryptography  
**Frontend**: React 19, React Router, Shadcn/UI, Tailwind CSS, Axios  
**Database**: MongoDB 7.0  
**Deployment**: Ubuntu 24.04 + Cloudflare Tunnel

## 📖 Usage Guide

### Creating Your First Webhook

1. **Login** with admin credentials
2. Navigate to **Webhooks** page
3. Click **Create Endpoint**
4. Fill in details:
   - **Name**: "Lead Intake"
   - **Path**: "lead-intake" (becomes `/api/hooks/lead-intake`)
   - **Mode**: "Add Contact to List"
   - **Field Mapping**: Map your JSON fields
5. **Copy the secret token** - you'll need this!

### Configuring SendGrid

1. Get your SendGrid API key from [SendGrid Dashboard](https://app.sendgrid.com)
2. Navigate to **Settings → API Keys**
3. Click **Add API Key** on SendGrid card
4. Enter:
   - **API Key**: Your SendGrid key
   - **Sender Email**: Your verified sender email
5. Click **Verify** to test connection
6. SendGrid lists and templates will now be available

### Calling a Webhook

```bash
curl -X POST https://your-domain.com/api/hooks/lead-intake \
  -H "X-Webhook-Token: YOUR_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe"
  }'
```

### Viewing Logs

1. Navigate to **Logs** page
2. Filter by endpoint (optional)
3. Click any log entry to see full details
4. Click **Export CSV** to download logs

### Managing Users

1. Navigate to **Users** page (Admin only)
2. Click **Create User**
3. Set username, password, and role
4. User can login with assigned permissions

## 🔒 Security Features

- **Password Hashing**: bcrypt with salt
- **JWT Tokens**: 24-hour expiration
- **Encrypted Storage**: AES-256 for API keys
- **Secret Tokens**: UUID v4 for webhook validation
- **CORS Protection**: Configurable origins
- **No Plaintext Secrets**: All sensitive data encrypted at rest

## 📡 API Endpoints

### Authentication
```
POST   /api/auth/login              # User login
POST   /api/auth/change-password    # Change password
GET    /api/auth/me                 # Get current user
```

### Webhooks
```
GET    /api/webhooks/endpoints      # List all endpoints
POST   /api/webhooks/endpoints      # Create endpoint
PUT    /api/webhooks/endpoints/{id} # Update endpoint
DELETE /api/webhooks/endpoints/{id} # Delete endpoint
POST   /api/webhooks/endpoints/{id}/regenerate-token  # New token
POST   /api/hooks/{path}            # Public webhook receiver
```

### Logs
```
GET    /api/webhooks/logs           # Fetch logs (with filters)
```

### Dashboard
```
GET    /api/dashboard/stats         # Get statistics
```

### Settings
```
GET    /api/settings/api-keys              # List API keys
POST   /api/settings/api-keys              # Create/update key
DELETE /api/settings/api-keys/{service}    # Delete key
POST   /api/settings/api-keys/{service}/verify  # Verify key
```

### Users (Admin Only)
```
GET    /api/users                   # List users
POST   /api/users                   # Create user
DELETE /api/users/{id}              # Delete user
```

### SendGrid Integration
```
GET    /api/sendgrid/lists          # Get SendGrid lists
POST   /api/sendgrid/lists/create   # Create new list
GET    /api/sendgrid/templates      # Get SendGrid templates
```

### Backups
```
GET    /api/backups                 # List backups
POST   /api/backups/create          # Create backup
GET    /api/backups/settings        # Get backup schedule settings
POST   /api/backups/settings        # Update backup schedule
POST   /api/backups/run-now         # Trigger manual backup
GET    /api/backups/scheduled       # Get scheduled backup history
```

### GitHub Auto-Update (v1.0.0)
```
POST   /api/github/configure        # Configure GitHub repository URL
GET    /api/github/info             # Get repository info and current version
POST   /api/github/deploy           # Pull and deploy latest release
```

## 🎨 Design

- **Modern UI**: Clean, professional design with glass-morphism effects
- **Color Scheme**: Light pastel blues and greens with gradient accents
- **Typography**: Space Grotesk (headings) + Inter (body)
- **Responsive**: Mobile-friendly with collapsible sidebar
- **Animations**: Smooth transitions and hover effects
- **Dark Accents**: Strategic use of dark buttons for emphasis

## 🔄 Webhook Flow

```
1. External Service → POST /api/hooks/{path}
                    ↓
2. Validate Secret Token (X-Webhook-Token header)
                    ↓
3. Parse JSON Payload
                    ↓
4. Apply Field Mapping
                    ↓
5. Call SendGrid API (Add Contact or Send Email)
                    ↓
6. Log Request (success/failed/unauthorized)
                    ↓
7. Return Response
```

## 📦 Installation Options

### Option 1: Automated Install (Recommended)

```bash
# Clone to /opt/webhook-gateway (recommended location)
sudo git clone https://github.com/wilson1442/Webhook-Hub.git /opt/webhook-gateway
cd /opt/webhook-gateway
sudo ./install.sh
```

The installer will set up everything in `/opt/webhook-gateway`.

See [QUICKSTART.md](QUICKSTART.md) for details.

### Option 2: Manual Install

See [INSTALL_GUIDE.md](INSTALL_GUIDE.md) for step-by-step manual installation.

### Option 3: Development Setup

```bash
# Clone repository
git clone https://github.com/wilson1442/Webhook-Hub.git /opt/webhook-gateway
cd /opt/webhook-gateway

# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Configure .env file
uvicorn server:app --reload

# Frontend
cd ../frontend
yarn install
# Configure .env file
yarn start
```

**Note**: Production installations default to `/opt/webhook-gateway`. Development can be anywhere.

## 🛠️ Service Management

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

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check logs
tail -f /var/log/supervisor/backend.err.log

# Verify MongoDB is running
mongosh --eval "db.adminCommand('ping')"
```

### Frontend can't connect
```bash
# Check REACT_APP_BACKEND_URL in .env
cat /opt/webhook-gateway/frontend/.env

# Test API directly
curl https://your-domain.com/api/health
```

### SendGrid not working
1. Verify API key in Settings
2. Click "Verify Connection"
3. Check sender email is verified in SendGrid
4. Review webhook logs for error messages

## 📝 System Requirements

### Minimum Requirements
- Ubuntu 24.04 LTS
- 2GB RAM
- 20GB disk space
- Root or sudo access

### Required Accounts
- Cloudflare Account (Free tier works)
- SendGrid Account (Optional, for email features)

## 🤝 Contributing

This is a self-hosted solution for businesses. For bugs or feature requests, please open an issue on GitHub.

## 📄 License

All rights reserved.

## 🎯 Roadmap

- [ ] Webhook retry logic with exponential backoff
- [ ] IP whitelisting & advanced rate limiting
- [ ] Email summaries via SendGrid
- [ ] Cloud backup uploads (Google Drive/Dropbox)
- [ ] Advanced analytics and reporting
- [ ] Multi-language support
- [ ] Webhook testing interface
- [ ] Template variables for dynamic content

## 📞 Support

- **GitHub Issues**: [https://github.com/wilson1442/Webhook-Hub/issues](https://github.com/wilson1442/Webhook-Hub/issues)
- **Documentation**: See `/docs` folder
- **Installation Help**: See [INSTALL_GUIDE.md](INSTALL_GUIDE.md)

---

**Built with ❤️ using FastAPI + React + MongoDB**

**Repository**: [https://github.com/wilson1442/Webhook-Hub](https://github.com/wilson1442/Webhook-Hub)  
**Live Demo**: https://webhook-bridge-5.preview.emergentagent.com  
**Default Login**: admin / admin123 (change on first login)
