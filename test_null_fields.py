#!/usr/bin/env python3
"""
Test NULL fields with actual contact data
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

def test_null_fields():
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
            
            # First, get the actual contact to see which fields are empty/null
            response = session.get(f"{BASE_URL}/sendgrid/lists/{list_id}/contacts")
            if response.status_code == 200:
                data = response.json()
                contacts = data.get("contacts", [])
                if contacts:
                    contact = contacts[0]
                    print(f"\n📋 Sample contact data:")
                    for field, value in contact.items():
                        if field not in ["custom_fields", "_metadata", "list_ids", "segment_ids", "alternate_emails"]:
                            print(f"  {field}: '{value}' (empty: {value == ''})")
                    
                    # Find fields that are actually empty
                    empty_fields = []
                    for field, value in contact.items():
                        if field not in ["custom_fields", "_metadata", "list_ids", "segment_ids", "alternate_emails", "id", "email", "created_at", "updated_at"]:
                            if value == "" or value is None:
                                empty_fields.append(field)
                    
                    print(f"\n📋 Empty fields found: {empty_fields}")
                    
                    if empty_fields:
                        # Test with an actually empty field
                        test_field = empty_fields[0]
                        print(f"\n🧪 Testing empty operator with field '{test_field}' (which is empty)")
                        filters = f"{test_field}=empty:"
                        response = session.get(f"{BASE_URL}/sendgrid/lists/{list_id}/contacts?filters={filters}")
                        print(f"Status: {response.status_code}")
                        if response.status_code == 200:
                            data = response.json()
                            print(f"Found {data.get('count', 0)} contacts where {test_field} is empty")
                        else:
                            print(f"Error: {response.text}")
                        
                        print(f"\n🧪 Testing notEmpty operator with field '{test_field}' (which is empty)")
                        filters = f"{test_field}=notEmpty:"
                        response = session.get(f"{BASE_URL}/sendgrid/lists/{list_id}/contacts?filters={filters}")
                        print(f"Status: {response.status_code}")
                        if response.status_code == 200:
                            data = response.json()
                            print(f"Found {data.get('count', 0)} contacts where {test_field} is not empty")
                        else:
                            print(f"Error: {response.text}")
                    
                    # Test with a field that has a value
                    print(f"\n🧪 Testing notEmpty operator with 'first_name' (which has value)")
                    filters = "first_name=notEmpty:"
                    response = session.get(f"{BASE_URL}/sendgrid/lists/{list_id}/contacts?filters={filters}")
                    print(f"Status: {response.status_code}")
                    if response.status_code == 200:
                        data = response.json()
                        print(f"Found {data.get('count', 0)} contacts where first_name is not empty")
                    else:
                        print(f"Error: {response.text}")

if __name__ == "__main__":
    test_null_fields()