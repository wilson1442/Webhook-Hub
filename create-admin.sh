#!/bin/bash

#####################################################################
# Create Admin User - Webhook Gateway Hub
# Use this script if admin login is not working
#####################################################################

set -e

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=========================================="
echo "  Create/Reset Admin User"
echo "=========================================="
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root (use sudo)${NC}"
   exit 1
fi

# Get installation directory
read -p "Installation directory [/opt/webhook-gateway]: " INSTALL_DIR
INSTALL_DIR=${INSTALL_DIR:-/opt/webhook-gateway}

if [ ! -d "$INSTALL_DIR/backend" ]; then
    echo -e "${RED}Backend directory not found at: $INSTALL_DIR/backend${NC}"
    exit 1
fi

# Load environment
cd "$INSTALL_DIR/backend"

if [ ! -f .env ]; then
    echo -e "${RED}.env file not found at: $INSTALL_DIR/backend/.env${NC}"
    exit 1
fi

# Source the .env file
export $(grep -v '^#' .env | xargs)

echo -e "${BLUE}MongoDB URL: $MONGO_URL${NC}"
echo -e "${BLUE}Database Name: $DB_NAME${NC}"
echo ""

# Test MongoDB connection
echo -e "${YELLOW}Testing MongoDB connection...${NC}"
if ! mongosh "$MONGO_URL/$DB_NAME" --eval "db.adminCommand('ping')" &> /dev/null; then
    echo -e "${RED}Cannot connect to MongoDB!${NC}"
    echo "Please check if MongoDB is running: sudo systemctl status mongod"
    exit 1
fi
echo -e "${GREEN}✓ MongoDB connection OK${NC}"

echo ""
echo -e "${YELLOW}Deleting existing admin user...${NC}"
DELETED=$(mongosh "$DB_NAME" --quiet --eval 'db.users.deleteMany({username: "admin"}).deletedCount')
echo "Deleted $DELETED user(s)"

echo ""
echo -e "${YELLOW}Creating new admin user...${NC}"

# Activate virtual environment
if [ ! -d "venv" ]; then
    echo -e "${RED}Virtual environment not found!${NC}"
    echo "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -q motor bcrypt python-dotenv
else
    source venv/bin/activate
fi

python3 << 'EOFPYTHON'
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
import uuid
from datetime import datetime, timezone
import os
import sys

async def create_admin():
    try:
        mongo_url = os.environ.get('MONGO_URL')
        db_name = os.environ.get('DB_NAME')
        
        print(f"Connecting to: {mongo_url}")
        print(f"Database: {db_name}")
        
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        # Test connection
        await db.command('ping')
        print("✓ Database connection successful")
        
        # Check for existing admin
        existing = await db.users.find_one({"username": "admin"})
        if existing:
            print("⚠ Admin user still exists, deleting...")
            await db.users.delete_many({"username": "admin"})
        
        # Create admin user
        password = "admin123"
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        admin_user = {
            "id": str(uuid.uuid4()),
            "username": "admin",
            "password_hash": password_hash,
            "role": "admin",
            "force_password_change": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login": None
        }
        
        result = await db.users.insert_one(admin_user)
        print(f"✓ Admin user created with ID: {result.inserted_id}")
        
        # Verify it was created
        verify = await db.users.find_one({"username": "admin"})
        if verify:
            print("✓ Admin user verified in database")
            print(f"  - Username: {verify['username']}")
            print(f"  - Role: {verify['role']}")
            print(f"  - ID: {verify['id']}")
        else:
            print("✗ ERROR: Could not verify admin user!")
            sys.exit(1)
        
        client.close()
        
    except Exception as e:
        print(f"✗ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

asyncio.run(create_admin())
EOFPYTHON

RESULT=$?

deactivate

if [ $RESULT -eq 0 ]; then
    echo ""
    echo -e "${GREEN}=========================================="
    echo "  ✓ Admin User Created Successfully"
    echo "==========================================${NC}"
    echo ""
    echo "Login credentials:"
    echo "  Username: admin"
    echo "  Password: admin123"
    echo ""
    echo -e "${YELLOW}⚠️  You will be prompted to change password on first login${NC}"
    echo ""
    
    # Restart backend service
    echo -e "${YELLOW}Restarting backend service...${NC}"
    systemctl restart webhook-gateway-backend
    echo -e "${GREEN}✓ Backend restarted${NC}"
    
    echo ""
    echo "Waiting 5 seconds for backend to start..."
    sleep 5
    
    # Test the login
    echo ""
    echo -e "${YELLOW}Testing login API...${NC}"
    LOGIN_TEST=$(curl -s -X POST http://localhost:8001/api/auth/login \
        -H "Content-Type: application/json" \
        -d '{"username":"admin","password":"admin123"}')
    
    if echo "$LOGIN_TEST" | grep -q "token"; then
        echo -e "${GREEN}✓ Login test SUCCESSFUL!${NC}"
        echo "You can now login to your application."
    else
        echo -e "${RED}✗ Login test FAILED${NC}"
        echo "Response: $LOGIN_TEST"
        echo ""
        echo "Please check backend logs:"
        echo "  sudo journalctl -u webhook-gateway-backend -n 50"
    fi
else
    echo ""
    echo -e "${RED}Admin user creation failed!${NC}"
    exit 1
fi

exit 0
