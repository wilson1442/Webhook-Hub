# Update Instructions for Self-Hosted Installation

## Installation Path: `/opt/webhook-gateway`

Your Webhook Gateway Hub is installed at `/opt/webhook-gateway`. All update commands should be run from this directory.

---

## Quick Update (Recommended)

### Method 1: Using Update Script

```bash
# Navigate to installation directory
cd /opt/webhook-gateway

# Download latest update script (if needed)
sudo wget -O update-from-github.sh https://raw.githubusercontent.com/wilson1442/Webhook-Hub/main/update-from-github.sh
sudo chmod +x update-from-github.sh

# Run update
sudo bash update-from-github.sh
```

### Method 2: Manual Update

```bash
# Navigate to installation directory
cd /opt/webhook-gateway

# Stash local changes
git stash

# Pull latest changes
git fetch origin
git pull origin main

# Install backend dependencies
cd backend
pip install -r requirements.txt

# Install frontend dependencies
cd ../frontend
yarn install

# Restart services
sudo supervisorctl restart all
```

---

## Verify Installation Path

If you're not sure where your installation is located:

```bash
# Download and run the path checker
wget https://raw.githubusercontent.com/wilson1442/Webhook-Hub/main/check-installation.sh
chmod +x check-installation.sh
bash check-installation.sh
```

---

## Common Issues

### Issue: Update Script Can't Find Installation

**Solution**: The scripts now automatically check `/opt/webhook-gateway` first. If it's still not found, they'll prompt you for the path.

```bash
cd /opt/webhook-gateway
sudo bash update-from-github.sh
```

### Issue: Permission Denied

**Solution**: Use sudo for update commands

```bash
sudo bash update-from-github.sh
```

### Issue: Git Not Initialized

**Solution**: Initialize git repository

```bash
cd /opt/webhook-gateway
git init
git remote add origin https://github.com/wilson1442/Webhook-Hub.git
git fetch origin
git checkout -b main origin/main
```

---

## Update Process

When you run the update script, it will:

1. ✅ Detect installation at `/opt/webhook-gateway`
2. ✅ Create backup of current code
3. ✅ Stash any local changes
4. ✅ Pull latest version from GitHub
5. ✅ Install all dependencies
6. ✅ Restart services
7. ✅ Verify services are running

---

## After Update

1. **Check Version**
   - Login to your Webhook Hub
   - Look at bottom of sidebar - should show "v1.0.0"

2. **Verify New Features**
   - Dark mode toggle in Profile page
   - GitHub Auto-Update in Settings → Updates
   - Full webhook URLs on Webhooks page

3. **Test Core Functions**
   - Create a test webhook
   - Check dashboard statistics
   - Verify SendGrid integration

---

## Rollback (If Needed)

If something goes wrong, the update script creates a backup:

```bash
# Backups are stored in /tmp/webhook-backup-YYYYMMDD_HHMMSS
# Find your backup
ls -lt /tmp/webhook-backup-*

# Restore from backup
sudo cp -r /tmp/webhook-backup-YYYYMMDD_HHMMSS/* /opt/webhook-gateway/
sudo supervisorctl restart all
```

---

## Get Help

- **Check logs**: `sudo tail -f /var/log/supervisor/backend.err.log`
- **Service status**: `sudo supervisorctl status`
- **GitHub Issues**: https://github.com/wilson1442/Webhook-Hub/issues

---

## Future Updates

For future updates from GitHub, you can use the built-in auto-update:

1. Go to **Settings → Updates** in your Webhook Hub
2. Enter: `https://github.com/wilson1442/Webhook-Hub`
3. Click **Save**
4. Click **Pull & Deploy Latest Release**

This will automatically update your installation at `/opt/webhook-gateway`!
