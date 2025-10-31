from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Request, status, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from cryptography.fernet import Fernet
import base64
import hashlib
import requests
import json
import zipfile
import io
from backup_scheduler import BackupScheduler

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

# Encryption key for API keys
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY', Fernet.generate_key().decode())
cipher = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)

# Create the main app
app = FastAPI(
    title="Webhook Gateway Hub",
    description="Self-hosted webhook management platform with SendGrid integration",
    version="1.0.1"
)
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Initialize backup scheduler
backup_scheduler = None

# Helper function to get real client IP from headers (for Cloudflare/proxy)
def get_real_ip(request: Request) -> str:
    """Extract real client IP from request headers (Cloudflare, proxy, etc.)"""
    # Try Cloudflare headers first
    cf_connecting_ip = request.headers.get("CF-Connecting-IP")
    if cf_connecting_ip:
        return cf_connecting_ip
    
    # Try X-Forwarded-For (comma-separated list, first is real client)
    x_forwarded_for = request.headers.get("X-Forwarded-For")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    
    # Try X-Real-IP
    x_real_ip = request.headers.get("X-Real-IP")
    if x_real_ip:
        return x_real_ip
    
    # Fallback to direct client host
    return request.client.host if request.client else "unknown"

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    role: str = "standard"  # admin or standard
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None
    force_password_change: bool = False

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "standard"

class UserLogin(BaseModel):
    username: str
    password: str

class PasswordChange(BaseModel):
    old_password: str
    new_password: str

class WebhookEndpoint(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    path: str  # e.g., "lead-intake"
    secret_token: str = Field(default_factory=lambda: str(uuid.uuid4()))
    mode: str  # "add_contact" or "send_email"
    field_mapping: Dict[str, str] = {}  # Maps incoming JSON fields to SendGrid fields
    sendgrid_list_id: Optional[str] = None
    sendgrid_template_id: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    enabled: bool = True

class WebhookEndpointCreate(BaseModel):
    name: str
    path: str
    mode: str
    field_mapping: Dict[str, str] = {}
    sendgrid_list_id: Optional[str] = None
    sendgrid_template_id: Optional[str] = None

class WebhookLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    endpoint_id: str
    endpoint_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    payload_summary: str
    payload: Optional[Dict[str, Any]] = None  # Full payload for detail view
    status: str  # success, failed, unauthorized
    response_message: str = ""
    source_ip: Optional[str] = None

class APIKey(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    service_name: str  # sendgrid, github, google_drive, dropbox
    credentials: Dict[str, str] = {}  # Encrypted in DB
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class APIKeyCreate(BaseModel):
    service_name: str
    credentials: Dict[str, str]

# Helper Functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, username: str, role: str) -> str:
    payload = {
        'user_id': user_id,
        'username': username,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str) -> Dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def encrypt_data(data: str) -> str:
    return cipher.encrypt(data.encode()).decode()

def decrypt_data(encrypted: str) -> str:
    return cipher.decrypt(encrypted.encode()).decode()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = verify_token(token)
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def get_admin_user(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# Initialize default admin user
@app.on_event("startup")
async def startup_event():
    global backup_scheduler
    
    # Create default admin if not exists
    admin = await db.users.find_one({"username": "admin"})
    if not admin:
        admin_user = User(
            username="admin",
            role="admin",
            force_password_change=True
        )
        admin_dict = admin_user.model_dump()
        admin_dict['password_hash'] = hash_password("admin123")
        admin_dict['created_at'] = admin_dict['created_at'].isoformat()
        await db.users.insert_one(admin_dict)
        logging.info("Default admin user created: admin/admin123")
    
    # Initialize and start backup scheduler
    backup_scheduler = BackupScheduler(mongo_url, os.environ['DB_NAME'])
    await backup_scheduler.initialize()
    
    # Load existing schedule if any
    settings = await db.backup_settings.find_one({"_id": "backup_config"})
    if settings:
        await backup_scheduler.update_schedule(
            settings.get("frequency", "daily"),
            settings.get("retention", 7)
        )
    
    backup_scheduler.start()
    logging.info("Backup scheduler started")

# Auth Routes
@api_router.post("/auth/login")
async def login(user_data: UserLogin):
    user = await db.users.find_one({"username": user_data.username}, {"_id": 0})
    if not user or not verify_password(user_data.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Update last login
    await db.users.update_one(
        {"id": user['id']},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    token = create_token(user['id'], user['username'], user['role'])
    
    return {
        "token": token,
        "user": {
            "id": user['id'],
            "username": user['username'],
            "role": user['role'],
            "force_password_change": user.get('force_password_change', False)
        }
    }

@api_router.post("/auth/change-password")
async def change_password(pwd_data: PasswordChange, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    
    if not verify_password(pwd_data.old_password, user['password_hash']):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    new_hash = hash_password(pwd_data.new_password)
    await db.users.update_one(
        {"id": current_user['id']},
        {"$set": {"password_hash": new_hash, "force_password_change": False}}
    )
    
    return {"message": "Password changed successfully"}

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user['id'],
        "username": current_user['username'],
        "role": current_user['role'],
        "force_password_change": current_user.get('force_password_change', False)
    }

# User Management Routes
@api_router.get("/users", response_model=List[User])
async def get_users(current_user: dict = Depends(get_admin_user)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    for user in users:
        if isinstance(user.get('created_at'), str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
        if user.get('last_login') and isinstance(user['last_login'], str):
            user['last_login'] = datetime.fromisoformat(user['last_login'])
    return users

@api_router.post("/users", response_model=User)
async def create_user(user_data: UserCreate, current_user: dict = Depends(get_admin_user)):
    # Check if username exists
    existing = await db.users.find_one({"username": user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user = User(username=user_data.username, role=user_data.role)
    user_dict = user.model_dump()
    user_dict['password_hash'] = hash_password(user_data.password)
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    return user

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_admin_user)):
    if user_id == current_user['id']:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted successfully"}

# Webhook Endpoints Management
@api_router.get("/webhooks/endpoints", response_model=List[WebhookEndpoint])
async def get_webhook_endpoints(current_user: dict = Depends(get_current_user)):
    endpoints = await db.webhook_endpoints.find({}, {"_id": 0}).to_list(1000)
    for endpoint in endpoints:
        if isinstance(endpoint.get('created_at'), str):
            endpoint['created_at'] = datetime.fromisoformat(endpoint['created_at'])
    return endpoints

@api_router.post("/webhooks/endpoints", response_model=WebhookEndpoint)
async def create_webhook_endpoint(endpoint_data: WebhookEndpointCreate, current_user: dict = Depends(get_current_user)):
    # Check if path already exists
    existing = await db.webhook_endpoints.find_one({"path": endpoint_data.path})
    if existing:
        raise HTTPException(status_code=400, detail="Webhook path already exists")
    
    endpoint = WebhookEndpoint(
        **endpoint_data.model_dump(),
        created_by=current_user['username']
    )
    endpoint_dict = endpoint.model_dump()
    endpoint_dict['created_at'] = endpoint_dict['created_at'].isoformat()
    
    await db.webhook_endpoints.insert_one(endpoint_dict)
    return endpoint

@api_router.put("/webhooks/endpoints/{endpoint_id}")
async def update_webhook_endpoint(endpoint_id: str, endpoint_data: WebhookEndpointCreate, current_user: dict = Depends(get_current_user)):
    result = await db.webhook_endpoints.update_one(
        {"id": endpoint_id},
        {"$set": endpoint_data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    return {"message": "Endpoint updated successfully"}

@api_router.delete("/webhooks/endpoints/{endpoint_id}")
async def delete_webhook_endpoint(endpoint_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.webhook_endpoints.delete_one({"id": endpoint_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    return {"message": "Endpoint deleted successfully"}

@api_router.post("/webhooks/endpoints/{endpoint_id}/regenerate-token")
async def regenerate_token(endpoint_id: str, current_user: dict = Depends(get_current_user)):
    new_token = str(uuid.uuid4())
    result = await db.webhook_endpoints.update_one(
        {"id": endpoint_id},
        {"$set": {"secret_token": new_token}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    return {"secret_token": new_token}

# Webhook Handler (Public endpoint)
@api_router.post("/hooks/{path}")
async def handle_webhook(path: str, request: Request, x_webhook_token: Optional[str] = Header(None)):
    # Get real client IP
    real_ip = get_real_ip(request)
    
    # Find endpoint
    endpoint = await db.webhook_endpoints.find_one({"path": path, "enabled": True}, {"_id": 0})
    if not endpoint:
        await log_webhook(path, "Endpoint not found", "failed", real_ip, {})
        raise HTTPException(status_code=404, detail="Webhook endpoint not found")
    
    # Verify token
    if x_webhook_token != endpoint['secret_token']:
        await log_webhook(endpoint['id'], endpoint['name'], "unauthorized", real_ip, {})
        raise HTTPException(status_code=401, detail="Invalid webhook token")
    
    # Parse payload
    try:
        payload = await request.json()
    except:
        await log_webhook(endpoint['id'], endpoint['name'], "failed", real_ip, {}, "Invalid JSON payload")
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    
    # Process based on mode
    try:
        if endpoint['mode'] == 'add_contact':
            result = await process_add_contact(endpoint, payload)
        elif endpoint['mode'] == 'send_email':
            result = await process_send_email(endpoint, payload)
        else:
            result = {"status": "failed", "message": "Invalid mode"}
        
        await log_webhook(
            endpoint['id'],
            endpoint['name'],
            result['status'],
            real_ip,
            payload,
            result.get('message', '')
        )
        
        # Ensure result is JSON serializable
        return {
            "status": result.get('status', 'unknown'),
            "message": result.get('message', 'No message'),
            "detail": result.get('detail', '')
        }
    except Exception as e:
        error_message = str(e) if str(e) else "Unknown error occurred"
        logger.error(f"Webhook processing error: {error_message}", exc_info=True)
        await log_webhook(endpoint['id'], endpoint['name'], "failed", real_ip, payload, error_message)
        raise HTTPException(status_code=500, detail=error_message)

async def process_add_contact(endpoint: dict, payload: dict) -> dict:
    # Get SendGrid API key
    api_key_doc = await db.api_keys.find_one({"service_name": "sendgrid"}, {"_id": 0})
    if not api_key_doc:
        return {"status": "failed", "message": "SendGrid API key not configured"}
    
    api_key = decrypt_data(api_key_doc['credentials']['api_key'])
    # Clean the API key
    api_key = api_key.encode('ascii', 'ignore').decode('ascii').strip()
    
    # Map fields
    email = payload.get(endpoint['field_mapping'].get('email', 'email'))
    if not email:
        return {"status": "failed", "message": "Email field not found in payload"}
    
    # Add to SendGrid list
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    contact_data = {"contacts": [{"email": email}]}
    
    # Dynamically map all fields from field_mapping
    # New format: {"sendgrid_field": {"payload_field": "...", "is_custom": true/false}}
    # Old format: {"sendgrid_field": "payload_field"} (for backward compatibility)
    logger.info(f"Field mapping: {endpoint.get('field_mapping', {})}")
    logger.info(f"Payload: {payload}")
    
    for sendgrid_field, config in endpoint.get('field_mapping', {}).items():
        if sendgrid_field == 'email':
            continue  # Already handled
        
        # Handle both old and new format
        if isinstance(config, str):
            # Old format: {"first_name": "firstname"}
            payload_field = config
            is_custom = False
        else:
            # New format: {"first_name": {"payload_field": "firstname", "is_custom": false}}
            payload_field = config.get('payload_field', '')
            is_custom = config.get('is_custom', False)
        
        # Get value from payload using the mapped field name
        field_value = payload.get(payload_field)
        logger.info(f"Checking field: {sendgrid_field} -> {payload_field}, is_custom: {is_custom}, value: {field_value}")
        
        if field_value:
            if is_custom:
                # Custom SendGrid field - add to custom_fields object
                if 'custom_fields' not in contact_data['contacts'][0]:
                    contact_data['contacts'][0]['custom_fields'] = {}
                contact_data['contacts'][0]['custom_fields'][sendgrid_field] = field_value
                logger.info(f"Added custom field: {sendgrid_field} = {field_value}")
            else:
                # Standard SendGrid field
                contact_data['contacts'][0][sendgrid_field] = field_value
                logger.info(f"Added standard field: {sendgrid_field} = {field_value}")
    
    # Add list_ids if specified
    if endpoint.get('sendgrid_list_id'):
        contact_data['list_ids'] = [endpoint['sendgrid_list_id']]
    
    # Log the data being sent to SendGrid for debugging
    logger.info(f"SendGrid contact data: {json.dumps(contact_data)}")
    
    response = requests.put(
        "https://api.sendgrid.com/v3/marketing/contacts",
        headers=headers,
        json=contact_data
    )
    
    # Log the response
    logger.info(f"SendGrid response status: {response.status_code}, body: {response.text}")
    
    if response.status_code in [200, 202]:
        list_msg = f" to list {endpoint.get('sendgrid_list_id')}" if endpoint.get('sendgrid_list_id') else ""
        response_data = response.json() if response.text else {}
        job_id = response_data.get('job_id', 'N/A')
        return {"status": "success", "message": f"Contact added successfully{list_msg} (Job ID: {job_id})"}
    else:
        error_detail = response.text if response.text else f"HTTP {response.status_code}"
        logger.error(f"SendGrid API error: {error_detail}")
        return {"status": "failed", "message": f"SendGrid API error: {error_detail}"}

async def process_send_email(endpoint: dict, payload: dict) -> dict:
    api_key_doc = await db.api_keys.find_one({"service_name": "sendgrid"}, {"_id": 0})
    if not api_key_doc:
        return {"status": "failed", "message": "SendGrid API key not configured"}
    
    api_key = decrypt_data(api_key_doc['credentials']['api_key'])
    sender_email = api_key_doc['credentials'].get('sender_email', 'noreply@example.com')
    
    email = payload.get(endpoint['field_mapping'].get('email', 'email'))
    if not email:
        return {"status": "failed", "message": "Email field not found in payload"}
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    email_data = {
        "personalizations": [{
            "to": [{"email": email}],
            "dynamic_template_data": payload
        }],
        "from": {"email": sender_email},
        "template_id": endpoint.get('sendgrid_template_id', '')
    }
    
    response = requests.post(
        "https://api.sendgrid.com/v3/mail/send",
        headers=headers,
        json=email_data
    )
    
    if response.status_code == 202:
        return {"status": "success", "message": "Email sent successfully"}
    else:
        return {"status": "failed", "message": f"SendGrid API error: {response.text}"}

async def log_webhook(endpoint_id: str, endpoint_name: str, status: str, source_ip: str, payload: dict, response_msg: str = ""):
    log = WebhookLog(
        endpoint_id=endpoint_id,
        endpoint_name=endpoint_name,
        status=status,
        source_ip=source_ip,
        payload_summary=json.dumps(payload)[:500],
        payload=payload,  # Store full payload for detail view
        response_message=response_msg
    )
    log_dict = log.model_dump()
    log_dict['timestamp'] = log_dict['timestamp'].isoformat()
    await db.webhook_logs.insert_one(log_dict)

# Webhook Logs
@api_router.get("/webhooks/logs")
async def get_webhook_logs(limit: int = 100, endpoint_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if endpoint_id:
        query['endpoint_id'] = endpoint_id
    
    logs = await db.webhook_logs.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    for log in logs:
        if isinstance(log.get('timestamp'), str):
            log['timestamp'] = datetime.fromisoformat(log['timestamp'])
    return logs

@api_router.delete("/webhooks/logs")
async def clear_webhook_logs(current_user: dict = Depends(get_current_user)):
    """Clear all webhook logs"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        result = await db.webhook_logs.delete_many({})
        return {
            "message": f"Successfully deleted {result.deleted_count} log entries",
            "deleted_count": result.deleted_count
        }
    except Exception as e:
        logger.error(f"Failed to clear logs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/webhooks/logs/{log_id}/retry")
async def retry_webhook(log_id: str, current_user: dict = Depends(get_current_user)):
    """Retry a failed webhook request"""
    try:
        # Get the original log
        log = await db.webhook_logs.find_one({"id": log_id}, {"_id": 0})
        if not log:
            raise HTTPException(status_code=404, detail="Log not found")
        
        # Get the endpoint
        endpoint = await db.webhook_endpoints.find_one({"id": log["endpoint_id"]}, {"_id": 0})
        if not endpoint:
            raise HTTPException(status_code=404, detail="Endpoint not found or deleted")
        
        # Get the original payload
        payload = log.get("payload", {})
        if isinstance(payload, str):
            import json
            payload = json.loads(payload)
        
        # Process based on mode
        if endpoint['mode'] == 'add_contact':
            result = await process_add_contact(endpoint, payload)
        elif endpoint['mode'] == 'send_email':
            result = await process_send_email(endpoint, payload)
        else:
            result = {"status": "failed", "message": "Invalid mode"}
        
        # Log the retry
        await log_webhook(
            endpoint['id'],
            endpoint['name'],
            result['status'],
            "retry",  # Mark as retry
            payload,
            f"Retry of {log_id}: {result.get('message', '')}"
        )
        
        return {
            "success": True,
            "message": f"Webhook retried successfully. Status: {result['status']}",
            "result": result
        }
    except Exception as e:
        logger.error(f"Failed to retry webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Dashboard Stats
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    total_endpoints = await db.webhook_endpoints.count_documents({})
    total_logs = await db.webhook_logs.count_documents({})
    success_logs = await db.webhook_logs.count_documents({"status": "success"})
    failed_logs = await db.webhook_logs.count_documents({"status": "failed"})
    
    # Recent activity
    recent_logs = await db.webhook_logs.find({}, {"_id": 0}).sort("timestamp", -1).limit(10).to_list(10)
    for log in recent_logs:
        if isinstance(log.get('timestamp'), str):
            log['timestamp'] = datetime.fromisoformat(log['timestamp'])
    
    return {
        "total_endpoints": total_endpoints,
        "total_requests": total_logs,
        "success_rate": round((success_logs / total_logs * 100) if total_logs > 0 else 0, 2),
        "failed_requests": failed_logs,
        "recent_activity": recent_logs
    }

# API Keys Management
@api_router.get("/settings/api-keys")
async def get_api_keys(current_user: dict = Depends(get_admin_user)):
    keys = await db.api_keys.find({}, {"_id": 0}).to_list(100)
    # Decrypt and mask credentials
    for key in keys:
        decrypted = {}
        for k, v in key['credentials'].items():
            try:
                decrypted_val = decrypt_data(v) if k in ['api_key', 'token', 'secret'] else v
                # Mask sensitive values
                if k in ['api_key', 'token', 'secret'] and decrypted_val:
                    decrypted[k] = decrypted_val[:8] + '...' + decrypted_val[-4:] if len(decrypted_val) > 12 else '***'
                else:
                    decrypted[k] = v
            except:
                decrypted[k] = '***'
        key['credentials'] = decrypted
        if isinstance(key.get('created_at'), str):
            key['created_at'] = datetime.fromisoformat(key['created_at'])
        if isinstance(key.get('updated_at'), str):
            key['updated_at'] = datetime.fromisoformat(key['updated_at'])
    return keys

@api_router.post("/settings/api-keys")
async def create_api_key(key_data: APIKeyCreate, current_user: dict = Depends(get_admin_user)):
    # Check if service already exists
    existing = await db.api_keys.find_one({"service_name": key_data.service_name})
    
    # Encrypt sensitive fields and clean them
    encrypted_creds = {}
    for k, v in key_data.credentials.items():
        if k in ['api_key', 'token', 'secret', 'refresh_token', 'access_token']:
            # Remove Unicode characters and whitespace
            cleaned_value = v.encode('ascii', 'ignore').decode('ascii').strip()
            encrypted_creds[k] = encrypt_data(cleaned_value)
        else:
            encrypted_creds[k] = v.strip()
    
    if existing:
        # Update existing
        await db.api_keys.update_one(
            {"service_name": key_data.service_name},
            {"$set": {"credentials": encrypted_creds, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"message": "API key updated successfully"}
    else:
        # Create new
        api_key = APIKey(service_name=key_data.service_name, credentials=encrypted_creds)
        api_key_dict = api_key.model_dump()
        api_key_dict['created_at'] = api_key_dict['created_at'].isoformat()
        api_key_dict['updated_at'] = api_key_dict['updated_at'].isoformat()
        await db.api_keys.insert_one(api_key_dict)
        return {"message": "API key created successfully"}

@api_router.delete("/settings/api-keys/{service_name}")
async def delete_api_key(service_name: str, current_user: dict = Depends(get_admin_user)):
    result = await db.api_keys.delete_one({"service_name": service_name})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="API key not found")
    return {"message": "API key deleted successfully"}

@api_router.post("/settings/api-keys/{service_name}/verify")
async def verify_api_key(service_name: str, current_user: dict = Depends(get_admin_user)):
    key_doc = await db.api_keys.find_one({"service_name": service_name}, {"_id": 0})
    if not key_doc:
        raise HTTPException(status_code=404, detail="API key not found")
    
    try:
        if service_name == "sendgrid":
            api_key = decrypt_data(key_doc['credentials']['api_key'])
            # Clean the API key: remove Unicode and whitespace
            api_key = api_key.encode('ascii', 'ignore').decode('ascii').strip()
            
            headers = {"Authorization": f"Bearer {api_key}"}
            response = requests.get("https://api.sendgrid.com/v3/scopes", headers=headers, timeout=10)
            
            if response.status_code == 200:
                return {"status": "success", "message": "SendGrid API key is valid"}
            elif response.status_code == 401:
                return {"status": "failed", "message": "Invalid SendGrid API key - authentication failed"}
            else:
                return {"status": "failed", "message": f"SendGrid API error. Status: {response.status_code}"}
    except Exception as e:
        logging.error(f"Verify API key error: {str(e)}")
        return {"status": "failed", "message": f"Verification error: {str(e)}"}
    
    return {"status": "success", "message": "Verification not implemented for this service"}

# SendGrid Integration
@api_router.get("/sendgrid/lists")
async def get_sendgrid_lists(current_user: dict = Depends(get_current_user)):
    key_doc = await db.api_keys.find_one({"service_name": "sendgrid"}, {"_id": 0})
    if not key_doc:
        return {"lists": []}
    
    api_key = decrypt_data(key_doc['credentials']['api_key'])
    headers = {"Authorization": f"Bearer {api_key}"}
    response = requests.get("https://api.sendgrid.com/v3/marketing/lists", headers=headers)
    
    if response.status_code == 200:
        return {"lists": response.json().get('result', [])}
    return {"lists": []}

@api_router.post("/sendgrid/lists/create")
async def create_sendgrid_list(list_data: dict, current_user: dict = Depends(get_current_user)):
    key_doc = await db.api_keys.find_one({"service_name": "sendgrid"}, {"_id": 0})
    if not key_doc:
        raise HTTPException(status_code=400, detail="SendGrid API key not configured")
    
    api_key = decrypt_data(key_doc['credentials']['api_key'])
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    response = requests.post(
        "https://api.sendgrid.com/v3/marketing/lists",
        headers=headers,
        json={"name": list_data.get("name")}
    )
    
    if response.status_code in [200, 201]:
        return response.json()
    else:
        raise HTTPException(status_code=400, detail=f"SendGrid API error: {response.text}")

@api_router.get("/sendgrid/templates")
async def get_sendgrid_templates(current_user: dict = Depends(get_current_user)):
    key_doc = await db.api_keys.find_one({"service_name": "sendgrid"}, {"_id": 0})
    if not key_doc:
        return {"templates": []}
    
    api_key = decrypt_data(key_doc['credentials']['api_key'])
    # Clean the API key
    api_key = api_key.encode('ascii', 'ignore').decode('ascii').strip()
    
    headers = {"Authorization": f"Bearer {api_key}"}
    
    # Try both legacy and dynamic templates endpoints
    templates = []
    
    # Get dynamic templates (newer)
    try:
        response = requests.get("https://api.sendgrid.com/v3/templates?generations=dynamic", headers=headers, timeout=10)
        if response.status_code == 200:
            dynamic_templates = response.json().get('templates', [])
            templates.extend(dynamic_templates)
    except Exception as e:
        logging.error(f"Error fetching dynamic templates: {e}")
    
    # Get legacy templates
    try:
        response = requests.get("https://api.sendgrid.com/v3/templates?generations=legacy", headers=headers, timeout=10)
        if response.status_code == 200:
            legacy_templates = response.json().get('templates', [])
            templates.extend(legacy_templates)
    except Exception as e:
        logging.error(f"Error fetching legacy templates: {e}")
    
    return {"templates": templates}

# Backup Management
@api_router.post("/backups/create")
async def create_backup(current_user: dict = Depends(get_admin_user)):
    backup_data = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "users": await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000),
        "webhook_endpoints": await db.webhook_endpoints.find({}, {"_id": 0}).to_list(1000),
        "webhook_logs": await db.webhook_logs.find({}, {"_id": 0}).sort("timestamp", -1).limit(1000).to_list(1000),
    }
    
    # Create ZIP file in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr('backup.json', json.dumps(backup_data, indent=2, default=str))
    
    zip_buffer.seek(0)
    backup_id = str(uuid.uuid4())
    
    # Save backup info
    await db.backups.insert_one({
        "id": backup_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user['username'],
        "size_bytes": len(zip_buffer.getvalue())
    })
    
    return {
        "backup_id": backup_id,
        "message": "Backup created successfully",
        "size_bytes": len(zip_buffer.getvalue())
    }

@api_router.get("/backups")
async def list_backups(current_user: dict = Depends(get_admin_user)):
    backups = await db.backups.find({}, {" _id": 0}).sort("created_at", -1).to_list(100)
    return backups

# Backup Scheduler Management
@api_router.get("/backups/settings")
async def get_backup_settings(current_user: dict = Depends(get_admin_user)):
    settings = await db.backup_settings.find_one({"_id": "backup_config"}, {"_id": 0})
    if not settings:
        return {"frequency": "daily", "retention": 7, "enabled": False}
    return settings

@api_router.post("/backups/settings")
async def update_backup_settings(
    settings: dict,
    current_user: dict = Depends(get_admin_user)
):
    frequency = settings.get("frequency", "daily")
    retention = settings.get("retention", 7)
    
    if frequency not in ["daily", "weekly"]:
        raise HTTPException(status_code=400, detail="Frequency must be 'daily' or 'weekly'")
    
    if retention < 1 or retention > 365:
        raise HTTPException(status_code=400, detail="Retention must be between 1 and 365")
    
    # Update scheduler
    await backup_scheduler.update_schedule(frequency, retention)
    
    return {"message": "Backup schedule updated successfully"}

@api_router.get("/backups/scheduled")
async def list_scheduled_backups(current_user: dict = Depends(get_admin_user)):
    backups = await db.scheduled_backups.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"backups": backups}

@api_router.post("/backups/run-now")
async def run_backup_now(current_user: dict = Depends(get_admin_user)):
    await backup_scheduler.create_backup()
    return {"message": "Backup started successfully"}

@api_router.get("/backups/download/{filename}")
async def download_backup(filename: str, current_user: dict = Depends(get_admin_user)):
    """Download a backup file"""
    try:
        from fastapi.responses import FileResponse
        backup_path = f"/opt/webhook-gateway/backups/{filename}"
        
        # Try alternate path if not found
        if not os.path.exists(backup_path):
            backup_path = f"/app/backups/{filename}"
        
        if not os.path.exists(backup_path):
            raise HTTPException(status_code=404, detail="Backup file not found")
        
        return FileResponse(
            path=backup_path,
            filename=filename,
            media_type="application/zip"
        )
    except Exception as e:
        logger.error(f"Failed to download backup: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/backups/restore/{filename}")
async def restore_backup(filename: str, current_user: dict = Depends(get_admin_user)):
    """Restore from a backup file"""
    try:
        backup_path = f"/opt/webhook-gateway/backups/{filename}"
        
        # Try alternate path if not found
        if not os.path.exists(backup_path):
            backup_path = f"/app/backups/{filename}"
        
        if not os.path.exists(backup_path):
            raise HTTPException(status_code=404, detail="Backup file not found")
        
        # Determine installation path
        install_path = "/opt/webhook-gateway"
        if not os.path.exists(os.path.join(install_path, "backend")):
            install_path = "/app"
        
        # Create restore script
        restore_script = f"""#!/bin/bash
set -e

echo "Starting restore from {filename}..."

# Extract backup to temp directory
TEMP_DIR=$(/bin/mktemp -d)
/usr/bin/unzip -q "{backup_path}" -d "$TEMP_DIR"

# Stop services first
if /usr/bin/command -v systemctl &> /dev/null; then
    /bin/systemctl stop webhook-gateway-backend 2>/dev/null || true
    /bin/systemctl stop webhook-gateway-frontend 2>/dev/null || true
fi

# Restore MongoDB if backup contains it
if [ -f "$TEMP_DIR/mongodb_backup.json" ]; then
    echo "Restoring MongoDB..."
    /usr/bin/mongorestore --drop --db webhook_gateway "$TEMP_DIR/mongodb_backup.json" 2>/dev/null || true
fi

# Restart services
if /usr/bin/command -v systemctl &> /dev/null; then
    /bin/systemctl start webhook-gateway-backend 2>/dev/null || true
    /bin/systemctl start webhook-gateway-frontend 2>/dev/null || true
fi

# Clean up
/bin/rm -rf "$TEMP_DIR"

echo "Restore completed successfully!"
"""
        
        # Write and execute script
        import tempfile
        import subprocess
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.sh') as f:
            f.write(restore_script)
            script_path = f.name
        
        os.chmod(script_path, 0o755)
        
        # Execute restore
        result = subprocess.run(
            ["/bin/bash", script_path],
            capture_output=True,
            text=True,
            timeout=120
        )
        
        if result.returncode == 0:
            return {"message": "Backup restored successfully. Services restarted."}
        else:
            raise HTTPException(status_code=500, detail=f"Restore failed: {result.stderr}")
        
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Restore operation timed out")
    except Exception as e:
        logger.error(f"Failed to restore backup: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# GitHub management endpoints
@api_router.post("/github/configure")
async def configure_github(
    repo_url: str = Body(..., embed=True),
    current_user: dict = Depends(get_current_user)
):
    """Configure GitHub repository URL"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Validate URL format
        if not repo_url.strip():
            raise HTTPException(status_code=400, detail="Repository URL is required")
        
        # Check if GitHub credentials already exist
        existing = await db.api_keys.find_one({"service_name": "github"})
        
        if existing:
            # Update existing
            await db.api_keys.update_one(
                {"service_name": "github"},
                {"$set": {
                    "credentials.repo_url": repo_url,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        else:
            # Create new
            await db.api_keys.insert_one({
                "service_name": "github",
                "credentials": {
                    "repo_url": repo_url,
                    "token": ""
                },
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            })
        
        return {"message": "GitHub repository configured successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to configure GitHub: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/github/info")
async def get_github_info(current_user: dict = Depends(get_current_user)):
    """Get GitHub repository information and latest release"""
    try:
        # Get GitHub credentials
        github_key = await db.api_keys.find_one({"service_name": "github"})
        
        if not github_key:
            return {"configured": False}
        
        credentials = github_key["credentials"]
        repo_url = credentials.get("repo_url", "")
        token = decrypt_data(credentials.get("token", "")) if credentials.get("token") else ""
        
        if not repo_url:
            return {"configured": False}
        
        # Extract owner/repo from URL
        # Example: https://github.com/owner/repo or github.com/owner/repo
        parts = repo_url.replace("https://", "").replace("http://", "").split("/")
        if len(parts) >= 3 and "github.com" in parts[0]:
            owner = parts[1]
            repo = parts[2].replace(".git", "")
        else:
            return {"configured": False, "error": "Invalid repository URL format"}
        
        # Get current commit (if .git exists)
        current_commit = "Unknown"
        current_version = "Unknown"
        try:
            import subprocess
            # Try multiple possible installation paths
            for path in ["/opt/webhook-gateway", "/app", os.getcwd()]:
                if os.path.exists(os.path.join(path, ".git")):
                    result = subprocess.run(
                        ["/usr/bin/git", "rev-parse", "--short", "HEAD"],
                        cwd=path,
                        capture_output=True,
                        text=True,
                        timeout=5
                    )
                    if result.returncode == 0:
                        current_commit = result.stdout.strip()
                    
                    # Also get the version from VERSION file
                    version_file = os.path.join(path, "VERSION")
                    if os.path.exists(version_file):
                        with open(version_file, 'r') as f:
                            current_version = f.read().strip()
                    
                    # Get last commit date
                    date_result = subprocess.run(
                        ["/usr/bin/git", "log", "-1", "--format=%cd", "--date=short"],
                        cwd=path,
                        capture_output=True,
                        text=True,
                        timeout=5
                    )
                    if date_result.returncode == 0:
                        commit_date = date_result.stdout.strip()
                        current_version = f"{current_version} ({commit_date})"
                    
                    break
        except Exception:
            pass
        
        # Get latest release from GitHub (works without token for public repos)
        latest_release = None
        try:
            import requests
            headers = {}
            if token:
                headers["Authorization"] = f"token {token}"
            
            response = requests.get(
                f"https://api.github.com/repos/{owner}/{repo}/releases/latest",
                headers=headers,
                timeout=10
            )
            if response.status_code == 200:
                release_data = response.json()
                latest_release = {
                    "tag_name": release_data.get("tag_name"),
                    "name": release_data.get("name"),
                    "published_at": release_data.get("published_at")
                }
        except Exception:
            pass
        
        return {
            "configured": True,
            "repo_url": repo_url,
            "owner": owner,
            "repo": repo,
            "current_commit": current_commit,
            "current_version": current_version,
            "latest_release": latest_release
        }
        
    except Exception as e:
        logger.error(f"Failed to get GitHub info: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/github/pull")
async def pull_from_github(current_user: dict = Depends(get_current_user)):
    """Pull latest code from GitHub without deploying"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Get GitHub credentials
        github_key = await db.api_keys.find_one({"service_name": "github"})
        
        if not github_key:
            raise HTTPException(status_code=400, detail="GitHub repository not configured. Please enter your repository URL first.")
        
        credentials = github_key["credentials"]
        repo_url = credentials.get("repo_url", "")
        
        if not repo_url:
            raise HTTPException(status_code=400, detail="Repository URL not configured")
        
        # Determine installation path
        install_path = "/opt/webhook-gateway"
        if not os.path.exists(os.path.join(install_path, "backend")):
            install_path = "/app"
        
        # Create log directory
        log_dir = os.path.join(install_path, "logs")
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(log_dir, f"pull_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.log")
        
        # Create pull script
        pull_script = f"""#!/bin/bash
set -e

# Create log file and redirect output
LOG_FILE="{log_file}"
exec > "$LOG_FILE" 2>&1

echo "=========================================="
echo "Pull Started: $(/bin/date)"
echo "=========================================="
echo "Repository: {repo_url}"
echo "Installation Path: {install_path}"
echo "Download Location: {install_path}"
echo ""

cd {install_path}

echo "Step 1: Backing up environment files..."
/bin/cp backend/.env /tmp/backend-env-backup 2>/dev/null || true
/bin/cp frontend/.env /tmp/frontend-env-backup 2>/dev/null || true
echo "✓ Environment files backed up to /tmp"
echo ""

echo "Step 2: Fetching latest code from GitHub..."
echo "Download destination: {install_path}"
# Remove and reinitialize git to avoid conflicts
/bin/rm -rf .git
/usr/bin/git init
/usr/bin/git remote add origin {repo_url}
/usr/bin/git fetch origin main
/usr/bin/git reset --hard origin/main
/usr/bin/git checkout -B main origin/main
COMMIT=$(/usr/bin/git rev-parse --short HEAD)
COMMIT_DATE=$(/usr/bin/git log -1 --format=%cd --date=short)
echo "✓ Code downloaded to: {install_path}"
echo "✓ Now on commit: $COMMIT (date: $COMMIT_DATE)"
echo ""

echo "Step 3: Restoring environment files..."
/bin/cp /tmp/backend-env-backup backend/.env 2>/dev/null || true
/bin/cp /tmp/frontend-env-backup frontend/.env 2>/dev/null || true
echo "✓ Environment files restored"
echo ""

echo "=========================================="
echo "Pull Completed: $(/bin/date)"
echo "Downloaded to: {install_path}"
echo "Version: 1.0.0 (commit: $COMMIT)"
echo "Commit Date: $COMMIT_DATE"
echo "=========================================="
echo "Ready to deploy!"
"""
        
        # Save pull log record to database
        pull_log = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user": current_user.get("username"),
            "repository": repo_url,
            "type": "pull",
            "status": "started",
            "log_file": log_file
        }
        await db.deployment_logs.insert_one(pull_log)
        
        # Write and execute script
        import tempfile
        import subprocess
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.sh') as f:
            f.write(pull_script)
            script_path = f.name
        
        os.chmod(script_path, 0o755)
        
        # Execute pull synchronously so we can return result
        result = subprocess.run(
            ["/bin/bash", script_path],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        # Update log status
        if result.returncode == 0:
            await db.deployment_logs.update_one(
                {"log_file": log_file},
                {"$set": {"status": "completed"}}
            )
            return {
                "success": True,
                "message": "Successfully pulled latest code from GitHub!",
                "log_file": log_file,
                "ready_to_deploy": True
            }
        else:
            await db.deployment_logs.update_one(
                {"log_file": log_file},
                {"$set": {"status": "failed"}}
            )
            raise HTTPException(
                status_code=500, 
                detail=f"Pull failed: {result.stderr}"
            )
        
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Pull operation timed out")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Pull failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/github/deploy")
async def deploy_from_github(current_user: dict = Depends(get_current_user)):
    """Deploy already-pulled code (install dependencies and restart services)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Determine installation path
        install_path = "/opt/webhook-gateway"
        if not os.path.exists(os.path.join(install_path, "backend")):
            install_path = "/app"
        
        # Create log directory
        log_dir = os.path.join(install_path, "logs")
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(log_dir, f"deploy_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.log")
        
        # Create deployment script
        deploy_script = f"""#!/bin/bash
set -e

# Create log file and redirect output
LOG_FILE="{log_file}"
exec > "$LOG_FILE" 2>&1

echo "=========================================="
echo "Deployment Started: $(/bin/date)"
echo "=========================================="
echo "Installation Path: {install_path}"
echo ""

cd {install_path}

# Get version info before
OLD_COMMIT=$(/usr/bin/git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo "Version before deploy: $OLD_COMMIT"
echo ""

echo "Step 1: Installing backend dependencies..."
cd {install_path}/backend
if [ -d "venv" ]; then
    . venv/bin/activate
    /usr/bin/pip install -r requirements.txt --quiet
    deactivate
else
    /usr/bin/pip install -r requirements.txt --break-system-packages --quiet
fi
echo "✓ Backend dependencies installed"
echo ""

echo "Step 2: Installing frontend dependencies..."
cd {install_path}/frontend
/usr/bin/yarn install --silent
echo "✓ Frontend dependencies installed"
echo ""

echo "Step 3: Restarting services..."
RESTARTED=false

# Find what's running on the ports
BACKEND_PID=$(/usr/bin/lsof -ti:8001 2>/dev/null || echo "")
FRONTEND_PID=$(/usr/bin/lsof -ti:3000 2>/dev/null || echo "")

echo "Found processes - Backend: $BACKEND_PID, Frontend: $FRONTEND_PID"

# Try systemctl first
if /usr/bin/command -v systemctl &> /dev/null; then
    if /bin/systemctl restart webhook-gateway-backend 2>/dev/null; then
        echo "✓ Backend restarted (systemd)"
        RESTARTED=true
    fi
    if /bin/systemctl restart webhook-gateway-frontend 2>/dev/null; then
        echo "✓ Frontend restarted (systemd)"
        RESTARTED=true
    fi
fi

# Try supervisorctl
if [ "$RESTARTED" = false ] && /usr/bin/command -v supervisorctl &> /dev/null; then
    if /usr/bin/supervisorctl restart all 2>/dev/null; then
        echo "✓ Services restarted (supervisorctl)"
        RESTARTED=true
    fi
fi

# Try pm2
if [ "$RESTARTED" = false ] && /usr/bin/command -v pm2 &> /dev/null; then
    if /usr/bin/pm2 restart all 2>/dev/null; then
        echo "✓ Services restarted (PM2)"
        RESTARTED=true
    fi
fi

# Manual kill and restart if nothing else worked
if [ "$RESTARTED" = false ]; then
    echo "⚠ No service manager found, manually restarting processes..."
    
    if [ -n "$BACKEND_PID" ]; then
        /bin/kill -9 $BACKEND_PID 2>/dev/null || true
        echo "Killed backend process $BACKEND_PID"
    fi
    
    if [ -n "$FRONTEND_PID" ]; then
        /bin/kill -9 $FRONTEND_PID 2>/dev/null || true
        echo "Killed frontend process $FRONTEND_PID"
    fi
    
    echo "⚠ Services stopped. Please start them manually:"
    echo "  Backend: cd {install_path}/backend && nohup uvicorn server:app --host 0.0.0.0 --port 8001 &"
    echo "  Frontend: cd {install_path}/frontend && nohup npm start &"
fi

# Get version after
NEW_COMMIT=$(/usr/bin/git rev-parse --short HEAD 2>/dev/null || echo "unknown")
NEW_VERSION=$(/bin/cat {install_path}/VERSION 2>/dev/null || echo "1.0.0")

echo ""
echo "=========================================="
echo "Deployment Completed: $(/bin/date)"
echo "Version: $NEW_VERSION (commit: $NEW_COMMIT)"
echo "Previous: $OLD_COMMIT → New: $NEW_COMMIT"
echo "=========================================="

# Mark as completed in database
/usr/bin/mongo webhook_gateway --eval "db.deployment_logs.updateOne({{log_file: '{log_file}'}}, {{\$set: {{status: 'completed'}}}});" 2>/dev/null || true
"""
        
        # Save deployment log record to database
        deploy_log = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user": current_user.get("username"),
            "type": "deploy",
            "status": "started",
            "log_file": log_file
        }
        await db.deployment_logs.insert_one(deploy_log)
        
        # Write and execute script
        import tempfile
        import subprocess
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.sh') as f:
            f.write(deploy_script)
            script_path = f.name
        
        os.chmod(script_path, 0o755)
        
        # Execute deployment
        subprocess.Popen(
            ["/bin/bash", script_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        return {
            "message": "Deployment started. Installing dependencies and restarting services...",
            "log_file": log_file
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Deployment failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/github/deployment-logs")
async def get_deployment_logs(current_user: dict = Depends(get_current_user)):
    """Get deployment log history"""
    try:
        logs = await db.deployment_logs.find().sort("timestamp", -1).limit(20).to_list(20)
        return {"logs": logs}
    except Exception as e:
        logger.error(f"Failed to get deployment logs: {str(e)}")
        return {"logs": []}

@api_router.get("/github/deployment-log/{log_file:path}")
async def get_deployment_log_content(log_file: str, current_user: dict = Depends(get_current_user)):
    """Get content of a specific deployment log file"""
    try:
        if os.path.exists(log_file):
            with open(log_file, 'r') as f:
                content = f.read()
            return {"content": content, "file": log_file}
        else:
            return {"content": "Log file not found", "file": log_file}
    except Exception as e:
        logger.error(f"Failed to read log file: {str(e)}")
        return {"content": f"Error reading log: {str(e)}", "file": log_file}

# Health check and version
@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@api_router.get("/version")
async def get_version():
    """Get application version information"""
    return {
        "version": "1.0.0",
        "name": "Webhook Gateway Hub",
        "release_date": "2025-10-30",
        "status": "production"
    }

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()