#!/bin/bash

echo "=========================================="
echo "  Complete Frontend-Backend Debug"
echo "=========================================="
echo ""

read -p "Installation directory [/opt/webhook-gateway]: " INSTALL_DIR
INSTALL_DIR=${INSTALL_DIR:-/opt/webhook-gateway}

echo "1. Checking frontend .env file..."
cat "$INSTALL_DIR/frontend/.env"
echo ""

echo "2. Checking if frontend build exists and when it was created..."
if [ -d "$INSTALL_DIR/frontend/build" ]; then
    ls -lah "$INSTALL_DIR/frontend/build" | head -10
    echo ""
    echo "Build directory last modified:"
    stat "$INSTALL_DIR/frontend/build" | grep Modify
else
    echo "❌ Build directory doesn't exist!"
fi
echo ""

echo "3. Checking frontend service status..."
systemctl status webhook-gateway-frontend --no-pager | head -15
echo ""

echo "4. Testing backend API directly (should work)..."
curl -s -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | python3 -m json.tool
echo ""

echo "5. Testing backend through Cloudflare tunnel..."
curl -s -X POST https://webhook.santarelli.io/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | python3 -m json.tool
echo ""

echo "6. Checking CORS headers from backend..."
curl -s -I -X OPTIONS https://webhook.santarelli.io/api/auth/login \
  -H "Origin: https://webhook.santarelli.io" \
  -H "Access-Control-Request-Method: POST" | grep -i "access-control"
echo ""

echo "7. Testing if frontend page loads..."
curl -s -I https://webhook.santarelli.io | head -20
echo ""

echo "=========================================="
echo "  Please also check in your browser:"
echo "=========================================="
echo "1. Open https://webhook.santarelli.io"
echo "2. Press F12 to open Developer Tools"
echo "3. Go to Console tab"
echo "4. Try to login"
echo "5. Look for any RED error messages"
echo ""
echo "Share any error messages you see!"
