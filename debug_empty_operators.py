#!/usr/bin/env python3
"""
Debug Empty Operators
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

def test_empty_operators():
    session = authenticate()
    if not session:
        return
    
    # Get lists first
    lists_response = session.get(f"{BASE_URL}/sendgrid/lists")
    
    if lists_response.status_code == 200:
        lists_data = lists_response.json()
        lists = lists_data.get("lists", [])
        
        if lists:
            test_list = lists[0]
            list_id = test_list.get("id")
            
            print(f"✅ Using list ID: {list_id}")
            
            # Test empty operators
            print(f"\n📋 Testing Empty Operators")
            filters = "phone_number=notEmpty:&city=empty:"
            response = session.get(f"{BASE_URL}/sendgrid/lists/{list_id}/contacts?filters={filters}")
            print(f"Status: {response.status_code}")
            print(f"URL: {BASE_URL}/sendgrid/lists/{list_id}/contacts?filters={filters}")
            if response.status_code == 200:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2)}")
            else:
                print(f"Error: {response.text}")
            
            # Test individual empty operators
            print(f"\n📋 Testing notEmpty operator alone")
            filters = "phone_number=notEmpty:"
            response = session.get(f"{BASE_URL}/sendgrid/lists/{list_id}/contacts?filters={filters}")
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"Response: Found {data.get('count', 0)} contacts")
            else:
                print(f"Error: {response.text}")
            
            print(f"\n📋 Testing empty operator alone")
            filters = "city=empty:"
            response = session.get(f"{BASE_URL}/sendgrid/lists/{list_id}/contacts?filters={filters}")
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"Response: Found {data.get('count', 0)} contacts")
            else:
                print(f"Error: {response.text}")

if __name__ == "__main__":
    test_empty_operators()