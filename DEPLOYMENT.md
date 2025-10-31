# Webhook Gateway Hub - Deployment Guide

## Important Note

This application was built using **FastAPI (Python) + React + MongoDB** stack on the Emergent platform, which differs from the originally requested **Node.js + Express + PostgreSQL + Ubuntu** stack.

### Why the Stack Difference?

Emergent currently supports:
- **Web Apps**: React + FastAPI + MongoDB
- **Mobile Apps**: Expo + FastAPI + MongoDB (paid subscription)

The original requirements called for:
- Backend: Node.js + Express
- Database: PostgreSQL  
- OS: Ubuntu 24.04 with install.sh script
- Deployment: Self-hosted with Cloudflare Tunnel

### What Was Built Instead

A fully functional **Webhook Gateway Hub** with all core features:
- ✅ User authentication (admin/standard roles)
- ✅ Webhook endpoint management
- ✅ SendGrid integration (add contacts, send emails)
- ✅ Webhook logs with CSV export
- ✅ API key management (SendGrid, GitHub, Google Drive, Dropbox)
- ✅ Backup system (local ZIP export)
- ✅ Dashboard with analytics
- ✅ Modern, responsive React UI

## Deployment on Emergent

### Current Deployment (Managed)

Your app is currently running on Emergent's managed infrastructure:
- **Frontend**: React SPA served at port 3000
- **Backend**: FastAPI running on port 8001
- **Database**: MongoDB local instance
- **URL**: https://webhook-bridge-5.preview.emergentagent.com

### Deployment Steps

1. **Native Emergent Deployment** (50 credits/month)
   - Your app is already deployed on Emergent preview
   - Production deployment available through Emergent platform
   - Automatic SSL, scaling, and monitoring included

2. **Export to GitHub** (For External Deployment)
   - Save your project to GitHub via Emergent
   - Set up your own hosting (VPS, AWS, Google Cloud, etc.)
   - Install dependencies and configure services manually

## Converting to Node.js + PostgreSQL

If you need the originally requested stack, you would need to:

1. **Backend Conversion**:
   - Rewrite `/app/backend/server.py` (FastAPI/Python) to Express.js (Node.js)
   - Replace MongoDB queries with PostgreSQL queries
   - Install: `express`, `pg`, `bcrypt`, `jsonwebtoken`, `crypto`

2. **Database Migration**:
   - Convert MongoDB collections to PostgreSQL tables
   - Create SQL schema for users, webhooks, logs, api_keys
   - Update connection strings

3. **Ubuntu Install Script** (`install.sh`):
   ```bash
   #!/bin/bash
   # Install Node.js, PostgreSQL, cloudflared
   # Setup database
   # Configure Cloudflare Tunnel
   # Start services with PM2/systemd
   ```

4. **Cloudflare Tunnel Setup**:
   - Install `cloudflared`
   - Configure tunnel to point to localhost:3000
   - Add public hostname in Cloudflare Dashboard

## Environment Variables

### Backend (.env)
```bash
MONGO_URL="mongodb://localhost:27017"
DB_NAME="webhook_gateway"
JWT_SECRET="your-secret-key"
ENCRYPTION_KEY="your-encryption-key"
CORS_ORIGINS="*"
```

### Frontend (.env)
```bash
REACT_APP_BACKEND_URL="https://your-domain.com"
```

## Starting the Application Locally

### Backend
```bash
cd /app/backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001
```

### Frontend
```bash
cd /app/frontend
yarn install
yarn start
```

### MongoDB
```bash
mongod --dbpath /data/db
```

## Default Credentials

- **Username**: admin
- **Password**: admin123
- **Note**: First login requires password change

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/change-password` - Change password
- `GET /api/auth/me` - Get current user

### Webhooks
- `GET /api/webhooks/endpoints` - List endpoints
- `POST /api/webhooks/endpoints` - Create endpoint
- `DELETE /api/webhooks/endpoints/{id}` - Delete endpoint
- `POST /api/hooks/{path}` - Webhook receiver (public)

### Logs
- `GET /api/webhooks/logs` - Fetch logs

### Settings
- `GET /api/settings/api-keys` - List API keys
- `POST /api/settings/api-keys` - Add/update API key
- `POST /api/settings/api-keys/{service}/verify` - Verify key

### Dashboard
- `GET /api/dashboard/stats` - Get statistics

## SendGrid Integration

1. Navigate to **Settings → API Keys**
2. Click **Add API Key** on SendGrid card
3. Enter:
   - API Key (from SendGrid dashboard)
   - Sender Email (verified sender)
4. Click **Verify** to test connection

## Creating Webhook Endpoints

1. Go to **Webhooks** page
2. Click **Create Endpoint**
3. Configure:
   - Name: "Lead Intake"
   - Path: "lead-intake"
   - Mode: "Add Contact" or "Send Email"
   - Field Mapping: Map JSON fields
4. Copy the generated **secret token**
5. Use the webhook URL with token:

```bash
curl -X POST https://your-domain.com/api/hooks/lead-intake \
  -H "X-Webhook-Token: YOUR_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","first_name":"John"}'
```

## Features Overview

### ✅ Implemented
- User authentication & role-based access
- Webhook endpoint CRUD operations
- Webhook request logging
- SendGrid integration (contacts & emails)
- API key encrypted storage
- Dashboard with analytics
- CSV log export
- Backup creation (local ZIP)
- Modern responsive UI

### 🚧 Placeholder (Can be added)
- GitHub update manager (API stub ready)
- Cloud backup upload (Google Drive/Dropbox)
- IP whitelisting & rate limiting
- Email summaries via SendGrid
- Webhook retry logic

## Support

For deployment assistance or stack conversion questions:
- Visit Emergent documentation
- Contact Emergent support for managed hosting
- Export to GitHub for self-hosting

---

Built with ❤️ using FastAPI + React + MongoDB
