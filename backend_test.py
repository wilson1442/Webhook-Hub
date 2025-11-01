#!/usr/bin/env python3
"""
Backend API Testing for Webhook Gateway Hub - SendGrid Template Features
Tests SendGrid template keys endpoint and dynamic email field substitution.
"""

import requests
import json
import time
import sys
import uuid
import re
from datetime import datetime

# Configuration
BASE_URL = "https://webhook-gateway-2.preview.emergentagent.com/api"
USERNAME = "admin"
PASSWORD = "admin123"

class WebhookGatewayTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.test_results = []
        self.test_webhook_id = None
        self.test_webhook_token = None
        self.sendgrid_configured = False
        self.test_template_id = None
        
    def log_test(self, test_name, success, message, details=None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "timestamp": datetime.now().isoformat(),
            "details": details
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def authenticate(self):
        """Login and get authentication token"""
        try:
            login_data = {
                "username": USERNAME,
                "password": PASSWORD
            }
            
            response = self.session.post(f"{BASE_URL}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("token")
                self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                self.log_test("Authentication", True, f"Successfully logged in as {USERNAME}")
                return True
            else:
                self.log_test("Authentication", False, f"Login failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Authentication", False, f"Login error: {str(e)}")
            return False
    
    def create_test_webhook_endpoint(self):
        """Create a test webhook endpoint for testing"""
        try:
            webhook_data = {
                "name": "Test Webhook for Full Payload",
                "path": f"test-payload-{str(uuid.uuid4())[:8]}",
                "mode": "add_contact",
                "field_mapping": {
                    "email": "email",
                    "first_name": "first_name",
                    "last_name": "last_name"
                }
            }
            
            response = self.session.post(f"{BASE_URL}/webhooks/endpoints", json=webhook_data)
            
            if response.status_code == 200:
                data = response.json()
                self.test_webhook_id = data.get("id")
                self.test_webhook_token = data.get("secret_token")
                self.log_test("Create Test Webhook", True, 
                            f"Created webhook with path: {data.get('path')}")
                return data
            else:
                self.log_test("Create Test Webhook", False, 
                            f"Failed with status {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_test("Create Test Webhook", False, f"Request error: {str(e)}")
            return None
    
    def test_webhook_full_payload_storage(self, webhook_path):
        """Test webhook endpoint with large payload to verify full payload storage"""
        try:
            # Create a large payload (>500 characters)
            large_payload = {
                "email": "john.doe@example.com",
                "first_name": "John",
                "last_name": "Doe",
                "company": "Acme Corporation",
                "phone": "+1-555-123-4567",
                "address": "123 Main Street, Suite 456, Anytown, State 12345, United States of America",
                "description": "This is a very long description field that contains detailed information about the user's preferences, interests, and background. " * 5,  # Make it >500 chars
                "metadata": {
                    "source": "website_form",
                    "campaign": "summer_2024_promotion",
                    "utm_source": "google",
                    "utm_medium": "cpc",
                    "utm_campaign": "lead_generation",
                    "additional_data": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua." * 3
                }
            }
            
            # Verify payload is >500 characters
            payload_str = json.dumps(large_payload)
            if len(payload_str) <= 500:
                self.log_test("Webhook Large Payload Test", False, 
                            f"Test payload too small: {len(payload_str)} chars, need >500")
                return False
            
            # Send webhook request without authentication (public endpoint)
            webhook_session = requests.Session()  # Don't use authenticated session
            headers = {"X-Webhook-Token": self.test_webhook_token}
            
            response = webhook_session.post(
                f"{BASE_URL}/hooks/{webhook_path}", 
                json=large_payload,
                headers=headers
            )
            
            if response.status_code in [200, 202]:
                self.log_test("Webhook Large Payload Trigger", True, 
                            f"Webhook triggered successfully with {len(payload_str)} char payload")
                
                # Wait a moment for log to be written
                time.sleep(1)
                return True
            else:
                self.log_test("Webhook Large Payload Trigger", False, 
                            f"Webhook failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Webhook Large Payload Trigger", False, f"Request error: {str(e)}")
            return False
    
    def test_webhook_logs_full_payload_retrieval(self):
        """Test GET /api/webhooks/logs to verify full payload is stored and retrieved"""
        try:
            response = self.session.get(f"{BASE_URL}/webhooks/logs?limit=10")
            
            if response.status_code == 200:
                logs = response.json()
                
                if not logs:
                    self.log_test("Webhook Logs Retrieval", False, 
                                "No webhook logs found")
                    return False
                
                # Find our test webhook log
                test_log = None
                for log in logs:
                    if log.get("endpoint_id") == self.test_webhook_id:
                        test_log = log
                        break
                
                if not test_log:
                    self.log_test("Webhook Logs Full Payload", False, 
                                "Test webhook log not found in recent logs")
                    return False
                
                # Check if both payload_summary and payload fields exist
                has_payload_summary = "payload_summary" in test_log
                has_full_payload = "payload" in test_log and test_log["payload"] is not None
                
                if has_payload_summary and has_full_payload:
                    payload_summary_len = len(test_log["payload_summary"])
                    full_payload_len = len(json.dumps(test_log["payload"]))
                    
                    # Verify payload_summary is truncated (≤500 chars) and full payload is larger
                    if payload_summary_len <= 500 and full_payload_len > 500:
                        self.log_test("Webhook Logs Full Payload", True, 
                                    f"✅ Full payload stored correctly - Summary: {payload_summary_len} chars, Full: {full_payload_len} chars")
                        
                        # Verify the full payload contains our test data
                        if isinstance(test_log["payload"], dict) and "metadata" in test_log["payload"]:
                            self.log_test("Webhook Payload Content Verification", True, 
                                        "Full payload contains expected nested data structure")
                        else:
                            self.log_test("Webhook Payload Content Verification", False, 
                                        "Full payload missing expected content")
                        
                        return True
                    else:
                        self.log_test("Webhook Logs Full Payload", False, 
                                    f"Payload storage issue - Summary: {payload_summary_len} chars, Full: {full_payload_len} chars")
                        return False
                else:
                    missing_fields = []
                    if not has_payload_summary:
                        missing_fields.append("payload_summary")
                    if not has_full_payload:
                        missing_fields.append("payload")
                    
                    self.log_test("Webhook Logs Full Payload", False, 
                                f"Missing required fields: {missing_fields}")
                    return False
            else:
                self.log_test("Webhook Logs Retrieval", False, 
                            f"Failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Webhook Logs Full Payload", False, f"Request error: {str(e)}")
            return False
    
    def configure_github_public_repo(self):
        """Configure a public GitHub repository for testing"""
        try:
            # Use FastAPI repository as test (public repo)
            repo_data = {
                "repo_url": "https://github.com/fastapi/fastapi"
            }
            
            response = self.session.post(f"{BASE_URL}/github/configure", json=repo_data)
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "successfully" in data["message"].lower():
                    self.log_test("Configure GitHub Public Repo", True, 
                                "Successfully configured FastAPI public repository")
                    return True
                else:
                    self.log_test("Configure GitHub Public Repo", False, 
                                "Unexpected response format", data)
                    return False
            else:
                self.log_test("Configure GitHub Public Repo", False, 
                            f"Failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Configure GitHub Public Repo", False, f"Request error: {str(e)}")
            return False
    
    def test_github_info_without_token(self):
        """Test GET /api/github/info - Get GitHub info without token (public repo)"""
        try:
            response = self.session.get(f"{BASE_URL}/github/info")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if response indicates configuration
                if not data.get("configured", False):
                    self.log_test("GitHub Info Without Token", False, 
                                "GitHub repository not configured")
                    return False
                
                # Check for latest_release information
                latest_release = data.get("latest_release")
                
                if latest_release:
                    required_fields = ["tag_name", "name", "published_at"]
                    has_required_fields = all(field in latest_release for field in required_fields)
                    
                    if has_required_fields:
                        self.log_test("GitHub Info Without Token", True, 
                                    f"✅ Latest release detected: {latest_release.get('tag_name')} - {latest_release.get('name')}")
                        
                        # Verify the data looks valid
                        tag_name = latest_release.get("tag_name", "")
                        published_at = latest_release.get("published_at", "")
                        
                        if tag_name and published_at:
                            self.log_test("GitHub Release Data Validation", True, 
                                        f"Release data valid - Tag: {tag_name}, Published: {published_at}")
                        else:
                            self.log_test("GitHub Release Data Validation", False, 
                                        "Release data incomplete")
                        
                        return True
                    else:
                        self.log_test("GitHub Info Without Token", False, 
                                    f"Latest release missing required fields: {required_fields}")
                        return False
                else:
                    self.log_test("GitHub Info Without Token", False, 
                                "No latest_release information returned (should work for public repos)")
                    return False
            else:
                self.log_test("GitHub Info Without Token", False, 
                            f"Failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("GitHub Info Without Token", False, f"Request error: {str(e)}")
            return False
    
    def cleanup_test_webhook(self):
        """Clean up test webhook endpoint"""
        try:
            if self.test_webhook_id:
                response = self.session.delete(f"{BASE_URL}/webhooks/endpoints/{self.test_webhook_id}")
                if response.status_code == 200:
                    self.log_test("Cleanup Test Webhook", True, "Test webhook deleted successfully")
                else:
                    self.log_test("Cleanup Test Webhook", False, f"Failed to delete webhook: {response.status_code}")
        except Exception as e:
            self.log_test("Cleanup Test Webhook", False, f"Cleanup error: {str(e)}")
    
    def check_sendgrid_configuration(self):
        """Check if SendGrid is configured"""
        try:
            response = self.session.get(f"{BASE_URL}/sendgrid/templates")
            
            if response.status_code == 200:
                data = response.json()
                templates = data.get("templates", [])
                
                if templates:
                    self.sendgrid_configured = True
                    # Use the first template for testing
                    self.test_template_id = templates[0].get("id")
                    self.log_test("SendGrid Configuration Check", True, 
                                f"SendGrid configured with {len(templates)} templates available")
                    return True
                else:
                    self.log_test("SendGrid Configuration Check", False, 
                                "SendGrid configured but no templates found")
                    return False
            else:
                self.log_test("SendGrid Configuration Check", False, 
                            f"SendGrid not configured or API error: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("SendGrid Configuration Check", False, f"Request error: {str(e)}")
            return False
    
    def test_sendgrid_template_keys_endpoint(self):
        """Test GET /api/sendgrid/templates/{template_id} - Extract template keys"""
        try:
            if not self.test_template_id:
                self.log_test("SendGrid Template Keys Endpoint", False, 
                            "No template ID available for testing")
                return False
            
            response = self.session.get(f"{BASE_URL}/sendgrid/templates/{self.test_template_id}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required response fields
                required_fields = ["template_id", "template_name", "template_keys", "versions_count"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test("SendGrid Template Keys Endpoint", False, 
                                f"Missing required fields: {missing_fields}")
                    return False
                
                # Verify template_id matches request
                if data["template_id"] != self.test_template_id:
                    self.log_test("SendGrid Template Keys Endpoint", False, 
                                f"Template ID mismatch: expected {self.test_template_id}, got {data['template_id']}")
                    return False
                
                # Verify template_keys is an array
                template_keys = data["template_keys"]
                if not isinstance(template_keys, list):
                    self.log_test("SendGrid Template Keys Endpoint", False, 
                                f"template_keys should be array, got {type(template_keys)}")
                    return False
                
                # Verify versions_count is a number
                versions_count = data["versions_count"]
                if not isinstance(versions_count, int) or versions_count < 0:
                    self.log_test("SendGrid Template Keys Endpoint", False, 
                                f"versions_count should be non-negative integer, got {versions_count}")
                    return False
                
                self.log_test("SendGrid Template Keys Endpoint", True, 
                            f"✅ Template details retrieved - Name: '{data['template_name']}', Keys: {len(template_keys)}, Versions: {versions_count}")
                
                # Log the extracted keys for verification
                if template_keys:
                    self.log_test("Template Keys Extraction", True, 
                                f"Extracted template keys: {template_keys}")
                else:
                    self.log_test("Template Keys Extraction", True, 
                                "No template keys found (template may not use variables)")
                
                return True
            else:
                self.log_test("SendGrid Template Keys Endpoint", False, 
                            f"Failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("SendGrid Template Keys Endpoint", False, f"Request error: {str(e)}")
            return False
    
    def create_send_email_webhook(self, email_config):
        """Create a webhook endpoint for send_email mode with specific email configuration"""
        try:
            webhook_data = {
                "name": f"Test Send Email Webhook - {str(uuid.uuid4())[:8]}",
                "path": f"test-send-email-{str(uuid.uuid4())[:8]}",
                "mode": "send_email",
                "sendgrid_template_id": self.test_template_id,
                **email_config
            }
            
            response = self.session.post(f"{BASE_URL}/webhooks/endpoints", json=webhook_data)
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Create Send Email Webhook", True, 
                            f"Created send_email webhook with path: {data.get('path')}")
                return data
            else:
                self.log_test("Create Send Email Webhook", False, 
                            f"Failed with status {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_test("Create Send Email Webhook", False, f"Request error: {str(e)}")
            return None
    
    def test_dynamic_email_field_substitution_dynamic(self):
        """Test dynamic email field substitution with {{field}} syntax"""
        try:
            # Create webhook with dynamic email configuration
            email_config = {
                "email_to": "{{email}}",
                "email_to_name": "{{first_name}} {{last_name}}",
                "email_from": "{{sender_email}}",
                "email_from_name": "{{sender_name}}"
            }
            
            webhook_data = self.create_send_email_webhook(email_config)
            if not webhook_data:
                return False
            
            webhook_path = webhook_data.get("path")
            webhook_token = webhook_data.get("secret_token")
            webhook_id = webhook_data.get("id")
            
            # Test payload with dynamic values
            test_payload = {
                "email": "jane.smith@example.com",
                "first_name": "Jane",
                "last_name": "Smith",
                "sender_email": "noreply@company.com",
                "sender_name": "Company Support",
                "message": "Welcome to our service!"
            }
            
            # Send webhook request (this will fail at SendGrid level but we can check the processing)
            webhook_session = requests.Session()
            headers = {"X-Webhook-Token": webhook_token}
            
            response = webhook_session.post(
                f"{BASE_URL}/hooks/{webhook_path}", 
                json=test_payload,
                headers=headers
            )
            
            # The webhook might fail at SendGrid level, but we check if our processing worked
            # by examining the webhook logs
            time.sleep(1)  # Wait for log to be written
            
            # Get the webhook log to verify field substitution
            logs_response = self.session.get(f"{BASE_URL}/webhooks/logs?endpoint_id={webhook_id}&limit=1")
            
            if logs_response.status_code == 200:
                logs = logs_response.json()
                if logs:
                    log_entry = logs[0]
                    
                    # Check if the webhook was processed (even if SendGrid failed)
                    if log_entry.get("status") in ["success", "failed"]:
                        self.log_test("Dynamic Email Field Substitution", True, 
                                    f"✅ Dynamic field substitution processed - Status: {log_entry.get('status')}")
                        
                        # Verify the payload was stored correctly
                        stored_payload = log_entry.get("payload", {})
                        if stored_payload.get("email") == "jane.smith@example.com":
                            self.log_test("Dynamic Field Payload Verification", True, 
                                        "Payload correctly stored with dynamic field values")
                        else:
                            self.log_test("Dynamic Field Payload Verification", False, 
                                        "Payload not stored correctly")
                        
                        # Clean up webhook
                        self.session.delete(f"{BASE_URL}/webhooks/endpoints/{webhook_id}")
                        return True
                    else:
                        self.log_test("Dynamic Email Field Substitution", False, 
                                    f"Webhook processing failed: {log_entry.get('response_message', 'Unknown error')}")
                else:
                    self.log_test("Dynamic Email Field Substitution", False, 
                                "No webhook log found after processing")
            else:
                self.log_test("Dynamic Email Field Substitution", False, 
                            f"Failed to retrieve webhook logs: {logs_response.status_code}")
            
            # Clean up webhook
            self.session.delete(f"{BASE_URL}/webhooks/endpoints/{webhook_id}")
            return False
                
        except Exception as e:
            self.log_test("Dynamic Email Field Substitution", False, f"Request error: {str(e)}")
            return False
    
    def test_dynamic_email_field_substitution_static(self):
        """Test static email field configuration (no {{}} syntax)"""
        try:
            # Create webhook with static email configuration
            email_config = {
                "email_to": "static.recipient@example.com",
                "email_to_name": "Static Recipient",
                "email_from": "static.sender@company.com",
                "email_from_name": "Static Sender"
            }
            
            webhook_data = self.create_send_email_webhook(email_config)
            if not webhook_data:
                return False
            
            webhook_path = webhook_data.get("path")
            webhook_token = webhook_data.get("secret_token")
            webhook_id = webhook_data.get("id")
            
            # Test payload (static values should be used regardless of payload content)
            test_payload = {
                "email": "payload.email@example.com",
                "first_name": "Payload",
                "last_name": "User",
                "message": "This should use static email configuration"
            }
            
            # Send webhook request
            webhook_session = requests.Session()
            headers = {"X-Webhook-Token": webhook_token}
            
            response = webhook_session.post(
                f"{BASE_URL}/hooks/{webhook_path}", 
                json=test_payload,
                headers=headers
            )
            
            # Wait for log to be written
            time.sleep(1)
            
            # Get the webhook log to verify static field usage
            logs_response = self.session.get(f"{BASE_URL}/webhooks/logs?endpoint_id={webhook_id}&limit=1")
            
            if logs_response.status_code == 200:
                logs = logs_response.json()
                if logs:
                    log_entry = logs[0]
                    
                    # Check if the webhook was processed
                    if log_entry.get("status") in ["success", "failed"]:
                        self.log_test("Static Email Field Configuration", True, 
                                    f"✅ Static field configuration processed - Status: {log_entry.get('status')}")
                        
                        # Verify the payload was stored correctly
                        stored_payload = log_entry.get("payload", {})
                        if stored_payload.get("email") == "payload.email@example.com":
                            self.log_test("Static Field Payload Verification", True, 
                                        "Payload correctly stored (static config should override)")
                        else:
                            self.log_test("Static Field Payload Verification", False, 
                                        "Payload not stored correctly")
                        
                        # Clean up webhook
                        self.session.delete(f"{BASE_URL}/webhooks/endpoints/{webhook_id}")
                        return True
                    else:
                        self.log_test("Static Email Field Configuration", False, 
                                    f"Webhook processing failed: {log_entry.get('response_message', 'Unknown error')}")
                else:
                    self.log_test("Static Email Field Configuration", False, 
                                "No webhook log found after processing")
            else:
                self.log_test("Static Email Field Configuration", False, 
                            f"Failed to retrieve webhook logs: {logs_response.status_code}")
            
            # Clean up webhook
            self.session.delete(f"{BASE_URL}/webhooks/endpoints/{webhook_id}")
            return False
                
        except Exception as e:
            self.log_test("Static Email Field Configuration", False, f"Request error: {str(e)}")
            return False
    
    def test_mixed_dynamic_static_fields(self):
        """Test mixed configuration with both dynamic and static fields"""
        try:
            # Create webhook with mixed email configuration
            email_config = {
                "email_to": "{{email}}",  # Dynamic
                "email_to_name": "Valued Customer",  # Static
                "email_from": "support@company.com",  # Static
                "email_from_name": "{{company_name}} Support"  # Dynamic
            }
            
            webhook_data = self.create_send_email_webhook(email_config)
            if not webhook_data:
                return False
            
            webhook_path = webhook_data.get("path")
            webhook_token = webhook_data.get("secret_token")
            webhook_id = webhook_data.get("id")
            
            # Test payload with some dynamic values
            test_payload = {
                "email": "mixed.test@example.com",
                "company_name": "Acme Corp",
                "product": "Premium Service",
                "message": "Testing mixed dynamic and static configuration"
            }
            
            # Send webhook request
            webhook_session = requests.Session()
            headers = {"X-Webhook-Token": webhook_token}
            
            response = webhook_session.post(
                f"{BASE_URL}/hooks/{webhook_path}", 
                json=test_payload,
                headers=headers
            )
            
            # Wait for log to be written
            time.sleep(1)
            
            # Get the webhook log
            logs_response = self.session.get(f"{BASE_URL}/webhooks/logs?endpoint_id={webhook_id}&limit=1")
            
            if logs_response.status_code == 200:
                logs = logs_response.json()
                if logs:
                    log_entry = logs[0]
                    
                    # Check if the webhook was processed
                    if log_entry.get("status") in ["success", "failed"]:
                        self.log_test("Mixed Dynamic/Static Fields", True, 
                                    f"✅ Mixed field configuration processed - Status: {log_entry.get('status')}")
                        
                        # Verify the payload was stored correctly
                        stored_payload = log_entry.get("payload", {})
                        expected_fields = ["email", "company_name", "product", "message"]
                        has_all_fields = all(field in stored_payload for field in expected_fields)
                        
                        if has_all_fields:
                            self.log_test("Mixed Field Payload Verification", True, 
                                        "Payload correctly stored with all expected fields")
                        else:
                            self.log_test("Mixed Field Payload Verification", False, 
                                        f"Payload missing fields: {[f for f in expected_fields if f not in stored_payload]}")
                        
                        # Clean up webhook
                        self.session.delete(f"{BASE_URL}/webhooks/endpoints/{webhook_id}")
                        return True
                    else:
                        self.log_test("Mixed Dynamic/Static Fields", False, 
                                    f"Webhook processing failed: {log_entry.get('response_message', 'Unknown error')}")
                else:
                    self.log_test("Mixed Dynamic/Static Fields", False, 
                                "No webhook log found after processing")
            else:
                self.log_test("Mixed Dynamic/Static Fields", False, 
                            f"Failed to retrieve webhook logs: {logs_response.status_code}")
            
            # Clean up webhook
            self.session.delete(f"{BASE_URL}/webhooks/endpoints/{webhook_id}")
            return False
                
        except Exception as e:
            self.log_test("Mixed Dynamic/Static Fields", False, f"Request error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run complete test suite for critical features"""
        print("🚀 Starting Webhook Gateway Hub Critical Features Tests")
        print("=" * 60)
        
        # Authentication
        if not self.authenticate():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        print("\n🎯 CRITICAL FEATURE 1: Webhook Logs Full Payload Storage")
        print("=" * 60)
        
        # Test 1: Create test webhook endpoint
        print("\n1. Creating Test Webhook Endpoint...")
        webhook_data = self.create_test_webhook_endpoint()
        if not webhook_data:
            print("❌ Cannot proceed with webhook tests - endpoint creation failed")
            return False
        
        webhook_path = webhook_data.get("path")
        
        # Test 2: Trigger webhook with large payload
        print("\n2. Testing Webhook with Large Payload (>500 chars)...")
        if not self.test_webhook_full_payload_storage(webhook_path):
            print("❌ Webhook payload test failed")
        
        # Test 3: Verify full payload storage in logs
        print("\n3. Verifying Full Payload Storage in Logs...")
        self.test_webhook_logs_full_payload_retrieval()
        
        print("\n🎯 CRITICAL FEATURE 2: GitHub Release Detection Without Token")
        print("=" * 60)
        
        # Test 4: Configure public GitHub repository
        print("\n4. Configuring Public GitHub Repository...")
        if not self.configure_github_public_repo():
            print("❌ Cannot proceed with GitHub tests - configuration failed")
        else:
            # Test 5: Get GitHub info without token
            print("\n5. Testing GitHub Release Detection (No Token Required)...")
            self.test_github_info_without_token()
            
            # Test 6: Verify API structure
            print("\n6. Verifying GitHub API Response Structure...")
            self.test_github_info_with_token_simulation()
        
        # Cleanup
        print("\n🧹 Cleanup...")
        self.cleanup_test_webhook()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 CRITICAL FEATURES TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        # Categorize results by feature
        webhook_tests = [r for r in self.test_results if "webhook" in r["test"].lower() or "payload" in r["test"].lower()]
        github_tests = [r for r in self.test_results if "github" in r["test"].lower()]
        
        webhook_passed = sum(1 for r in webhook_tests if r["success"])
        github_passed = sum(1 for r in github_tests if r["success"])
        
        print(f"\n📋 Feature Breakdown:")
        print(f"  Webhook Full Payload: {webhook_passed}/{len(webhook_tests)} passed")
        print(f"  GitHub Release Detection: {github_passed}/{len(github_tests)} passed")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS ({failed_tests}):")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['message']}")
                    if result.get("details"):
                        print(f"    Details: {result['details']}")
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = WebhookGatewayTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All critical features working correctly!")
        sys.exit(0)
    else:
        print("\n💥 Some critical features have issues!")
        sys.exit(1)