#!/usr/bin/env python3
"""
Debug SendGrid Contacts Filtering
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

def test_filtering():
    session = authenticate()
    if not session:
        return
    
    # Get lists first
    print("\n🔍 Getting SendGrid lists...")
    lists_response = session.get(f"{BASE_URL}/sendgrid/lists")
    
    if lists_response.status_code == 200:
        lists_data = lists_response.json()
        lists = lists_data.get("lists", [])
        
        if lists:
            test_list = lists[0]
            list_id = test_list.get("id")
            list_name = test_list.get("name", "Unknown")
            contact_count = test_list.get("contact_count", 0)
            
            print(f"✅ Using list: {list_name} (ID: {list_id}) with {contact_count} contacts")
            
            # Test 1: No filters
            print(f"\n📋 Test 1: No filters")
            response = session.get(f"{BASE_URL}/sendgrid/lists/{list_id}/contacts")
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2)}")
            else:
                print(f"Error: {response.text}")
            
            # Test 2: Simple filter
            print(f"\n📋 Test 2: Simple equals filter")
            filters = "first_name=equals:John"
            response = session.get(f"{BASE_URL}/sendgrid/lists/{list_id}/contacts?filters={filters}")
            print(f"Status: {response.status_code}")
            print(f"URL: {BASE_URL}/sendgrid/lists/{list_id}/contacts?filters={filters}")
            if response.status_code == 200:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2)}")
            else:
                print(f"Error: {response.text}")
            
            # Test 3: Multiple filters (this is failing)
            print(f"\n📋 Test 3: Multiple filters (failing)")
            filters = "first_name=contains:test&last_name=startsWith:Smith"
            response = session.get(f"{BASE_URL}/sendgrid/lists/{list_id}/contacts?filters={filters}")
            print(f"Status: {response.status_code}")
            print(f"URL: {BASE_URL}/sendgrid/lists/{list_id}/contacts?filters={filters}")
            if response.status_code == 200:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2)}")
            else:
                print(f"Error: {response.text}")
            
            # Test 4: Invalid list ID
            print(f"\n📋 Test 4: Invalid list ID")
            invalid_list_id = "invalid-list-id-12345"
            response = session.get(f"{BASE_URL}/sendgrid/lists/{invalid_list_id}/contacts")
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2)}")
            else:
                print(f"Error: {response.text}")
        else:
            print("❌ No SendGrid lists found")
    else:
        print(f"❌ Failed to get lists: {lists_response.status_code}")

if __name__ == "__main__":
    test_filtering()