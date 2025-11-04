#!/usr/bin/env python3
"""
Debug SendGrid Fields
"""

import requests
import json

# Configuration
BASE_URL = "https://webhook-gateway-3.preview.emergentagent.com/api"
USERNAME = "admin"
PASSWORD = "admin123"

def authenticate():
    """Login and get authentication token"""
    session = requests.Session()
    
    login_data = {
        "username": USERNAME,
        "password": PASSWORD
    }
    
    response = session.post(f"{BASE_URL}/auth/login", json=login_data)
    
    if response.status_code == 200:
        data = response.json()
        auth_token = data.get("token")
        session.headers.update({"Authorization": f"Bearer {auth_token}"})
        print(f"✅ Authenticated as {USERNAME}")
        return session
    else:
        print(f"❌ Authentication failed: {response.status_code}")
        return None

def check_sendgrid_fields():
    session = authenticate()
    if not session:
        return
    
    # Get SendGrid fields
    print("\n🔍 Getting SendGrid field definitions...")
    response = session.get(f"{BASE_URL}/sendgrid/fields")
    
    if response.status_code == 200:
        data = response.json()
        fields = data.get("fields", [])
        reserved = data.get("reserved", [])
        custom = data.get("custom", [])
        
        print(f"✅ Found {len(fields)} total fields ({len(reserved)} reserved, {len(custom)} custom)")
        
        print(f"\n📋 Reserved Fields:")
        for field in reserved:
            print(f"  - {field.get('field_id')}: {field.get('field_name')} ({field.get('field_type')})")
        
        print(f"\n📋 Custom Fields (first 10):")
        for field in custom[:10]:
            print(f"  - {field.get('field_id')}: {field.get('field_name')} ({field.get('field_type')})")
        
        # Test with a known reserved field
        print(f"\n🧪 Testing with reserved field 'first_name'...")
        lists_response = session.get(f"{BASE_URL}/sendgrid/lists")
        if lists_response.status_code == 200:
            lists_data = lists_response.json()
            lists = lists_data.get("lists", [])
            if lists:
                list_id = lists[0].get("id")
                
                # Test with first_name (should work)
                filters = "first_name=notEmpty:"
                response = session.get(f"{BASE_URL}/sendgrid/lists/{list_id}/contacts?filters={filters}")
                print(f"first_name notEmpty - Status: {response.status_code}")
                if response.status_code == 200:
                    data = response.json()
                    print(f"  Found {data.get('count', 0)} contacts")
                else:
                    print(f"  Error: {response.text}")
    else:
        print(f"❌ Failed to get fields: {response.status_code}")

if __name__ == "__main__":
    check_sendgrid_fields()