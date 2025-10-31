# Cloudflare Tunnel Configuration Fix Guide

## Problem Identified

Your Cloudflare Tunnel is serving the React frontend (port 3000) for ALL requests, including API calls to `/api/*`. This is why login fails - the frontend never reaches the backend.

## Solution: Create TWO Separate Public Hostnames

Instead of using path-based routing on a single hostname, you need to create TWO separate public hostname entries.

### Step 1: Delete Existing Configuration

1. Go to **Cloudflare Dashboard** → **Zero Trust** → **Access** → **Tunnels**
2. Click on your tunnel
3. Go to **Public Hostname** tab
4. **Delete** the existing `webhook.santarelli.io` entry

### Step 2: Create API Route (FIRST - Order Matters!)

Click **Add a public hostname**

**Public hostname #1 (API):**
```
Public hostname
  Subdomain: webhook
  Domain: santarelli.io
  Path: /api

Service
  Type: HTTP
  URL: 192.168.10.56:8001

Advanced settings (optional)
  HTTP Host Header: (leave default)
  No TLS Verify: (unchecked)
```

Click **Save hostname**

### Step 3: Create Frontend Route (SECOND)

Click **Add a public hostname** again

**Public hostname #2 (Frontend):**
```
Public hostname
  Subdomain: webhook
  Domain: santarelli.io
  Path: (LEAVE EMPTY - no path)

Service
  Type: HTTP
  URL: 192.168.10.56:3000

Advanced settings (optional)
  HTTP Host Header: (leave default)
  No TLS Verify: (unchecked)
```

Click **Save hostname**

### Step 4: Verify Order

After creating both, you should see:

```
Public Hostnames:
1. webhook.santarelli.io/api  →  192.168.10.56:8001
2. webhook.santarelli.io      →  192.168.10.56:3000
```

**CRITICAL**: The `/api` route MUST be listed FIRST (above the main route).

If it's not, use the drag handles to reorder them.

### Step 5: Test

Wait 30 seconds for changes to propagate, then test:

```bash
# Test API health (should return JSON)
curl https://webhook.santarelli.io/api/health

# Test API login (should return JSON with token)
curl -X POST https://webhook.santarelli.io/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Test frontend (should return HTML)
curl https://webhook.santarelli.io
```

### Step 6: Try Login

1. Go to https://webhook.santarelli.io
2. Login with: **admin** / **admin123**
3. It should work!

## Alternative: Use Subdomain Instead of Path

If path-based routing still doesn't work, use separate subdomains:

**Option B - Separate Subdomains:**

Public hostname #1:
```
Subdomain: webhook-api
Domain: santarelli.io
Path: (empty)
Service: http://192.168.10.56:8001
```

Public hostname #2:
```
Subdomain: webhook
Domain: santarelli.io
Path: (empty)
Service: http://192.168.10.56:3000
```

Then update your frontend .env:
```bash
cd /opt/webhook-gateway/frontend
nano .env
# Change to:
REACT_APP_BACKEND_URL="https://webhook-api.santarelli.io"

# Rebuild
yarn build
systemctl restart webhook-gateway-frontend
```

## Why This Happens

Cloudflare Tunnel's path-based routing can be tricky. When you have a single hostname with a path like `/api`, Cloudflare sometimes doesn't match it correctly and falls through to the default route.

Creating separate hostname entries (even with the same subdomain + different paths) ensures more reliable routing.

## Need Help?

If you're still having issues after trying both methods, please share:
1. Screenshot of your Public Hostnames configuration
2. Output of: `curl https://webhook.santarelli.io/api/health`
