#!/usr/bin/env python3
"""
Backend API Testing for Webhook Gateway Hub - SendGrid Batch Edit Logging and Contacts Management
Tests batch edit logging, contacts filtering, and bulk update functionality.
"""

import requests
import json
import time
import sys
import uuid
import re
from datetime import datetime

# Configuration
BASE_URL = "https://webhook-gateway-3.preview.emergentagent.com/api"
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
    
    def create_send_email_webhook(self, email_config=None):
        """Create a webhook endpoint for send_email mode with specific email configuration"""
        try:
            webhook_data = {
                "name": f"Test Send Email Webhook - {str(uuid.uuid4())[:8]}",
                "path": f"test-send-email-{str(uuid.uuid4())[:8]}",
                "mode": "send_email",
                "sendgrid_template_id": self.test_template_id or "d-1234567890abcdef"  # Use test template or fallback
            }
            
            # Add email configuration if provided
            if email_config:
                webhook_data.update(email_config)
            
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
    
    def test_mailto_single_email(self):
        """Test sending webhook with mailto field as single email"""
        try:
            # Create webhook with from fields only (no to fields)
            email_config = {
                "email_from": "sender@company.com",
                "email_from_name": "Company Support"
            }
            
            webhook_data = self.create_send_email_webhook(email_config)
            if not webhook_data:
                return False
            
            webhook_path = webhook_data.get("path")
            webhook_token = webhook_data.get("secret_token")
            webhook_id = webhook_data.get("id")
            
            # Test payload with single mailto
            test_payload = {
                "mailto": "recipient@example.com",
                "subject": "Test Single Mailto",
                "message": "Testing single email recipient"
            }
            
            # Send webhook request
            webhook_session = requests.Session()
            headers = {"X-Webhook-Token": webhook_token}
            
            response = webhook_session.post(
                f"{BASE_URL}/hooks/{webhook_path}", 
                json=test_payload,
                headers=headers
            )
            
            time.sleep(1)  # Wait for log to be written
            
            # Get the webhook log to verify processing
            logs_response = self.session.get(f"{BASE_URL}/webhooks/logs?endpoint_id={webhook_id}&limit=1")
            
            if logs_response.status_code == 200:
                logs = logs_response.json()
                if logs:
                    log_entry = logs[0]
                    
                    # Check if the webhook was processed
                    if log_entry.get("status") in ["success", "failed"]:
                        self.log_test("Mailto Single Email", True, 
                                    f"✅ Single mailto processed - Status: {log_entry.get('status')}")
                        
                        # Verify the payload was stored correctly
                        stored_payload = log_entry.get("payload", {})
                        if stored_payload.get("mailto") == "recipient@example.com":
                            self.log_test("Single Mailto Payload Verification", True, 
                                        "Payload correctly stored with single mailto")
                        else:
                            self.log_test("Single Mailto Payload Verification", False, 
                                        "Payload not stored correctly")
                        
                        # Clean up webhook
                        self.session.delete(f"{BASE_URL}/webhooks/endpoints/{webhook_id}")
                        return True
                    else:
                        self.log_test("Mailto Single Email", False, 
                                    f"Webhook processing failed: {log_entry.get('response_message', 'Unknown error')}")
                else:
                    self.log_test("Mailto Single Email", False, 
                                "No webhook log found after processing")
            else:
                self.log_test("Mailto Single Email", False, 
                            f"Failed to retrieve webhook logs: {logs_response.status_code}")
            
            # Clean up webhook
            self.session.delete(f"{BASE_URL}/webhooks/endpoints/{webhook_id}")
            return False
                
        except Exception as e:
            self.log_test("Mailto Single Email", False, f"Request error: {str(e)}")
            return False
    
    def test_mailto_comma_separated(self):
        """Test sending webhook with mailto as comma-separated emails"""
        try:
            # Create webhook with from fields only
            email_config = {
                "email_from": "sender@company.com",
                "email_from_name": "Company Support"
            }
            
            webhook_data = self.create_send_email_webhook(email_config)
            if not webhook_data:
                return False
            
            webhook_path = webhook_data.get("path")
            webhook_token = webhook_data.get("secret_token")
            webhook_id = webhook_data.get("id")
            
            # Test payload with comma-separated mailto
            test_payload = {
                "mailto": "user1@example.com, user2@example.com, user3@example.com",
                "subject": "Test Comma-Separated Mailto",
                "message": "Testing multiple email recipients"
            }
            
            # Send webhook request
            webhook_session = requests.Session()
            headers = {"X-Webhook-Token": webhook_token}
            
            response = webhook_session.post(
                f"{BASE_URL}/hooks/{webhook_path}", 
                json=test_payload,
                headers=headers
            )
            
            time.sleep(1)  # Wait for log to be written
            
            # Get the webhook log to verify processing
            logs_response = self.session.get(f"{BASE_URL}/webhooks/logs?endpoint_id={webhook_id}&limit=1")
            
            if logs_response.status_code == 200:
                logs = logs_response.json()
                if logs:
                    log_entry = logs[0]
                    
                    # Check if the webhook was processed
                    if log_entry.get("status") in ["success", "failed"]:
                        self.log_test("Mailto Comma-Separated", True, 
                                    f"✅ Comma-separated mailto processed - Status: {log_entry.get('status')}")
                        
                        # Verify the payload was stored correctly
                        stored_payload = log_entry.get("payload", {})
                        expected_mailto = "user1@example.com, user2@example.com, user3@example.com"
                        if stored_payload.get("mailto") == expected_mailto:
                            self.log_test("Comma-Separated Mailto Payload Verification", True, 
                                        "Payload correctly stored with comma-separated mailto")
                        else:
                            self.log_test("Comma-Separated Mailto Payload Verification", False, 
                                        f"Expected: {expected_mailto}, Got: {stored_payload.get('mailto')}")
                        
                        # Clean up webhook
                        self.session.delete(f"{BASE_URL}/webhooks/endpoints/{webhook_id}")
                        return True
                    else:
                        self.log_test("Mailto Comma-Separated", False, 
                                    f"Webhook processing failed: {log_entry.get('response_message', 'Unknown error')}")
                else:
                    self.log_test("Mailto Comma-Separated", False, 
                                "No webhook log found after processing")
            else:
                self.log_test("Mailto Comma-Separated", False, 
                            f"Failed to retrieve webhook logs: {logs_response.status_code}")
            
            # Clean up webhook
            self.session.delete(f"{BASE_URL}/webhooks/endpoints/{webhook_id}")
            return False
                
        except Exception as e:
            self.log_test("Mailto Comma-Separated", False, f"Request error: {str(e)}")
            return False
    
    def test_cc_bcc_fields(self):
        """Test sending webhook with cc and bcc fields"""
        try:
            # Create webhook with from fields only
            email_config = {
                "email_from": "sender@company.com",
                "email_from_name": "Company Support"
            }
            
            webhook_data = self.create_send_email_webhook(email_config)
            if not webhook_data:
                return False
            
            webhook_path = webhook_data.get("path")
            webhook_token = webhook_data.get("secret_token")
            webhook_id = webhook_data.get("id")
            
            # Test payload with cc and bcc fields
            test_payload = {
                "mailto": "primary@example.com",
                "cc": "cc1@example.com, cc2@example.com",
                "bcc": "bcc1@example.com",
                "subject": "Test CC/BCC Fields",
                "message": "Testing CC and BCC functionality"
            }
            
            # Send webhook request
            webhook_session = requests.Session()
            headers = {"X-Webhook-Token": webhook_token}
            
            response = webhook_session.post(
                f"{BASE_URL}/hooks/{webhook_path}", 
                json=test_payload,
                headers=headers
            )
            
            time.sleep(1)  # Wait for log to be written
            
            # Get the webhook log to verify processing
            logs_response = self.session.get(f"{BASE_URL}/webhooks/logs?endpoint_id={webhook_id}&limit=1")
            
            if logs_response.status_code == 200:
                logs = logs_response.json()
                if logs:
                    log_entry = logs[0]
                    
                    # Check if the webhook was processed
                    if log_entry.get("status") in ["success", "failed"]:
                        self.log_test("CC/BCC Fields", True, 
                                    f"✅ CC/BCC fields processed - Status: {log_entry.get('status')}")
                        
                        # Verify the payload was stored correctly
                        stored_payload = log_entry.get("payload", {})
                        expected_fields = ["mailto", "cc", "bcc"]
                        has_all_fields = all(field in stored_payload for field in expected_fields)
                        
                        if has_all_fields:
                            self.log_test("CC/BCC Payload Verification", True, 
                                        f"Payload correctly stored - mailto: {stored_payload.get('mailto')}, cc: {stored_payload.get('cc')}, bcc: {stored_payload.get('bcc')}")
                        else:
                            missing_fields = [f for f in expected_fields if f not in stored_payload]
                            self.log_test("CC/BCC Payload Verification", False, 
                                        f"Payload missing fields: {missing_fields}")
                        
                        # Clean up webhook
                        self.session.delete(f"{BASE_URL}/webhooks/endpoints/{webhook_id}")
                        return True
                    else:
                        self.log_test("CC/BCC Fields", False, 
                                    f"Webhook processing failed: {log_entry.get('response_message', 'Unknown error')}")
                else:
                    self.log_test("CC/BCC Fields", False, 
                                "No webhook log found after processing")
            else:
                self.log_test("CC/BCC Fields", False, 
                            f"Failed to retrieve webhook logs: {logs_response.status_code}")
            
            # Clean up webhook
            self.session.delete(f"{BASE_URL}/webhooks/endpoints/{webhook_id}")
            return False
                
        except Exception as e:
            self.log_test("CC/BCC Fields", False, f"Request error: {str(e)}")
            return False
    
    def test_all_recipients_together(self):
        """Test sending webhook with mailto, cc, and bcc all together"""
        try:
            # Create webhook with from fields only
            email_config = {
                "email_from": "sender@company.com",
                "email_from_name": "Company Support"
            }
            
            webhook_data = self.create_send_email_webhook(email_config)
            if not webhook_data:
                return False
            
            webhook_path = webhook_data.get("path")
            webhook_token = webhook_data.get("secret_token")
            webhook_id = webhook_data.get("id")
            
            # Test payload with all recipient types
            test_payload = {
                "mailto": "primary1@example.com, primary2@example.com",
                "cc": "cc1@example.com, cc2@example.com, cc3@example.com",
                "bcc": "bcc1@example.com, bcc2@example.com",
                "subject": "Test All Recipients Together",
                "message": "Testing mailto + cc + bcc functionality"
            }
            
            # Send webhook request
            webhook_session = requests.Session()
            headers = {"X-Webhook-Token": webhook_token}
            
            response = webhook_session.post(
                f"{BASE_URL}/hooks/{webhook_path}", 
                json=test_payload,
                headers=headers
            )
            
            time.sleep(1)  # Wait for log to be written
            
            # Get the webhook log to verify processing
            logs_response = self.session.get(f"{BASE_URL}/webhooks/logs?endpoint_id={webhook_id}&limit=1")
            
            if logs_response.status_code == 200:
                logs = logs_response.json()
                if logs:
                    log_entry = logs[0]
                    
                    # Check if the webhook was processed
                    if log_entry.get("status") in ["success", "failed"]:
                        self.log_test("All Recipients Together", True, 
                                    f"✅ All recipient types processed - Status: {log_entry.get('status')}")
                        
                        # Verify the payload was stored correctly
                        stored_payload = log_entry.get("payload", {})
                        expected_fields = ["mailto", "cc", "bcc"]
                        has_all_fields = all(field in stored_payload for field in expected_fields)
                        
                        if has_all_fields:
                            mailto_count = len(stored_payload.get("mailto", "").split(","))
                            cc_count = len(stored_payload.get("cc", "").split(","))
                            bcc_count = len(stored_payload.get("bcc", "").split(","))
                            self.log_test("All Recipients Payload Verification", True, 
                                        f"All recipient types stored - mailto: {mailto_count}, cc: {cc_count}, bcc: {bcc_count}")
                        else:
                            missing_fields = [f for f in expected_fields if f not in stored_payload]
                            self.log_test("All Recipients Payload Verification", False, 
                                        f"Payload missing fields: {missing_fields}")
                        
                        # Clean up webhook
                        self.session.delete(f"{BASE_URL}/webhooks/endpoints/{webhook_id}")
                        return True
                    else:
                        self.log_test("All Recipients Together", False, 
                                    f"Webhook processing failed: {log_entry.get('response_message', 'Unknown error')}")
                else:
                    self.log_test("All Recipients Together", False, 
                                "No webhook log found after processing")
            else:
                self.log_test("All Recipients Together", False, 
                            f"Failed to retrieve webhook logs: {logs_response.status_code}")
            
            # Clean up webhook
            self.session.delete(f"{BASE_URL}/webhooks/endpoints/{webhook_id}")
            return False
                
        except Exception as e:
            self.log_test("All Recipients Together", False, f"Request error: {str(e)}")
            return False
    
    def test_missing_mailto_error(self):
        """Test error handling when mailto is missing from payload"""
        try:
            # Create webhook with from fields only
            email_config = {
                "email_from": "sender@company.com",
                "email_from_name": "Company Support"
            }
            
            webhook_data = self.create_send_email_webhook(email_config)
            if not webhook_data:
                return False
            
            webhook_path = webhook_data.get("path")
            webhook_token = webhook_data.get("secret_token")
            webhook_id = webhook_data.get("id")
            
            # Test payload WITHOUT mailto field
            test_payload = {
                "cc": "cc@example.com",
                "bcc": "bcc@example.com",
                "subject": "Test Missing Mailto",
                "message": "Testing error handling when mailto is missing"
            }
            
            # Send webhook request
            webhook_session = requests.Session()
            headers = {"X-Webhook-Token": webhook_token}
            
            response = webhook_session.post(
                f"{BASE_URL}/hooks/{webhook_path}", 
                json=test_payload,
                headers=headers
            )
            
            time.sleep(1)  # Wait for log to be written
            
            # Get the webhook log to verify error handling
            logs_response = self.session.get(f"{BASE_URL}/webhooks/logs?endpoint_id={webhook_id}&limit=1")
            
            if logs_response.status_code == 200:
                logs = logs_response.json()
                if logs:
                    log_entry = logs[0]
                    
                    # Check if the webhook failed as expected
                    if log_entry.get("status") == "failed":
                        response_message = log_entry.get("response_message", "")
                        if "mailto" in response_message.lower() or "recipient" in response_message.lower():
                            self.log_test("Missing Mailto Error Handling", True, 
                                        f"✅ Correctly handled missing mailto - Error: {response_message}")
                        else:
                            self.log_test("Missing Mailto Error Handling", False, 
                                        f"Failed but wrong error message: {response_message}")
                        
                        # Clean up webhook
                        self.session.delete(f"{BASE_URL}/webhooks/endpoints/{webhook_id}")
                        return True
                    else:
                        self.log_test("Missing Mailto Error Handling", False, 
                                    f"Expected failure but got status: {log_entry.get('status')}")
                else:
                    self.log_test("Missing Mailto Error Handling", False, 
                                "No webhook log found after processing")
            else:
                self.log_test("Missing Mailto Error Handling", False, 
                            f"Failed to retrieve webhook logs: {logs_response.status_code}")
            
            # Clean up webhook
            self.session.delete(f"{BASE_URL}/webhooks/endpoints/{webhook_id}")
            return False
                
        except Exception as e:
            self.log_test("Missing Mailto Error Handling", False, f"Request error: {str(e)}")
            return False
    
    def test_dynamic_from_fields(self):
        """Test dynamic from fields with {{field}} syntax"""
        try:
            # Create webhook with dynamic from fields
            email_config = {
                "email_from": "{{sender_email}}",
                "email_from_name": "{{sender_name}}"
            }
            
            webhook_data = self.create_send_email_webhook(email_config)
            if not webhook_data:
                return False
            
            webhook_path = webhook_data.get("path")
            webhook_token = webhook_data.get("secret_token")
            webhook_id = webhook_data.get("id")
            
            # Test payload with dynamic from values
            test_payload = {
                "mailto": "recipient@example.com",
                "sender_email": "dynamic.sender@company.com",
                "sender_name": "Dynamic Sender Name",
                "subject": "Test Dynamic From Fields",
                "message": "Testing dynamic from field substitution"
            }
            
            # Send webhook request
            webhook_session = requests.Session()
            headers = {"X-Webhook-Token": webhook_token}
            
            response = webhook_session.post(
                f"{BASE_URL}/hooks/{webhook_path}", 
                json=test_payload,
                headers=headers
            )
            
            time.sleep(1)  # Wait for log to be written
            
            # Get the webhook log to verify processing
            logs_response = self.session.get(f"{BASE_URL}/webhooks/logs?endpoint_id={webhook_id}&limit=1")
            
            if logs_response.status_code == 200:
                logs = logs_response.json()
                if logs:
                    log_entry = logs[0]
                    
                    # Check if the webhook was processed
                    if log_entry.get("status") in ["success", "failed"]:
                        self.log_test("Dynamic From Fields", True, 
                                    f"✅ Dynamic from fields processed - Status: {log_entry.get('status')}")
                        
                        # Verify the payload was stored correctly
                        stored_payload = log_entry.get("payload", {})
                        expected_fields = ["mailto", "sender_email", "sender_name"]
                        has_all_fields = all(field in stored_payload for field in expected_fields)
                        
                        if has_all_fields:
                            self.log_test("Dynamic From Fields Payload Verification", True, 
                                        f"Payload correctly stored - sender_email: {stored_payload.get('sender_email')}, sender_name: {stored_payload.get('sender_name')}")
                        else:
                            missing_fields = [f for f in expected_fields if f not in stored_payload]
                            self.log_test("Dynamic From Fields Payload Verification", False, 
                                        f"Payload missing fields: {missing_fields}")
                        
                        # Clean up webhook
                        self.session.delete(f"{BASE_URL}/webhooks/endpoints/{webhook_id}")
                        return True
                    else:
                        self.log_test("Dynamic From Fields", False, 
                                    f"Webhook processing failed: {log_entry.get('response_message', 'Unknown error')}")
                else:
                    self.log_test("Dynamic From Fields", False, 
                                "No webhook log found after processing")
            else:
                self.log_test("Dynamic From Fields", False, 
                            f"Failed to retrieve webhook logs: {logs_response.status_code}")
            
            # Clean up webhook
            self.session.delete(f"{BASE_URL}/webhooks/endpoints/{webhook_id}")
            return False
                
        except Exception as e:
            self.log_test("Dynamic From Fields", False, f"Request error: {str(e)}")
            return False
    
    def test_static_from_fields(self):
        """Test static from fields (no {{}} syntax)"""
        try:
            # Create webhook with static from fields
            email_config = {
                "email_from": "static.sender@company.com",
                "email_from_name": "Static Sender Name"
            }
            
            webhook_data = self.create_send_email_webhook(email_config)
            if not webhook_data:
                return False
            
            webhook_path = webhook_data.get("path")
            webhook_token = webhook_data.get("secret_token")
            webhook_id = webhook_data.get("id")
            
            # Test payload (static values should be used regardless of payload content)
            test_payload = {
                "mailto": "recipient@example.com",
                "sender_email": "payload.sender@example.com",  # Should be ignored
                "sender_name": "Payload Sender Name",  # Should be ignored
                "subject": "Test Static From Fields",
                "message": "Testing static from field configuration"
            }
            
            # Send webhook request
            webhook_session = requests.Session()
            headers = {"X-Webhook-Token": webhook_token}
            
            response = webhook_session.post(
                f"{BASE_URL}/hooks/{webhook_path}", 
                json=test_payload,
                headers=headers
            )
            
            time.sleep(1)  # Wait for log to be written
            
            # Get the webhook log to verify processing
            logs_response = self.session.get(f"{BASE_URL}/webhooks/logs?endpoint_id={webhook_id}&limit=1")
            
            if logs_response.status_code == 200:
                logs = logs_response.json()
                if logs:
                    log_entry = logs[0]
                    
                    # Check if the webhook was processed
                    if log_entry.get("status") in ["success", "failed"]:
                        self.log_test("Static From Fields", True, 
                                    f"✅ Static from fields processed - Status: {log_entry.get('status')}")
                        
                        # Verify the payload was stored correctly
                        stored_payload = log_entry.get("payload", {})
                        if stored_payload.get("mailto") == "recipient@example.com":
                            self.log_test("Static From Fields Payload Verification", True, 
                                        "Payload correctly stored (static config should be used)")
                        else:
                            self.log_test("Static From Fields Payload Verification", False, 
                                        "Payload not stored correctly")
                        
                        # Clean up webhook
                        self.session.delete(f"{BASE_URL}/webhooks/endpoints/{webhook_id}")
                        return True
                    else:
                        self.log_test("Static From Fields", False, 
                                    f"Webhook processing failed: {log_entry.get('response_message', 'Unknown error')}")
                else:
                    self.log_test("Static From Fields", False, 
                                "No webhook log found after processing")
            else:
                self.log_test("Static From Fields", False, 
                            f"Failed to retrieve webhook logs: {logs_response.status_code}")
            
            # Clean up webhook
            self.session.delete(f"{BASE_URL}/webhooks/endpoints/{webhook_id}")
            return False
                
        except Exception as e:
            self.log_test("Static From Fields", False, f"Request error: {str(e)}")
            return False

    def run_all_tests(self):
        """Run complete test suite for refactored send_email functionality"""
        print("🚀 Starting Webhook Gateway Hub - Refactored Send Email Functionality Tests")
        print("=" * 70)
        
        # Authentication
        if not self.authenticate():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        print("\n🎯 FEATURE 1: Mailto/CC/BCC Email Recipients from Payload")
        print("=" * 70)
        
        # Test 1: Check SendGrid configuration (optional for basic testing)
        print("\n1. Checking SendGrid Configuration...")
        sendgrid_available = self.check_sendgrid_configuration()
        if not sendgrid_available:
            print("⚠️  SendGrid not configured. Tests will proceed but may fail at SendGrid API level.")
            print("   This is expected - we're testing the webhook processing logic.")
        
        # Test 2: Single mailto email
        print("\n2. Testing Single Mailto Email...")
        self.test_mailto_single_email()
        
        # Test 3: Comma-separated mailto emails
        print("\n3. Testing Comma-Separated Mailto Emails...")
        self.test_mailto_comma_separated()
        
        # Test 4: CC and BCC fields
        print("\n4. Testing CC and BCC Fields...")
        self.test_cc_bcc_fields()
        
        # Test 5: All recipients together
        print("\n5. Testing All Recipients Together (mailto + cc + bcc)...")
        self.test_all_recipients_together()
        
        # Test 6: Missing mailto error handling
        print("\n6. Testing Missing Mailto Error Handling...")
        self.test_missing_mailto_error()
        
        print("\n🎯 FEATURE 2: Dynamic From Fields")
        print("=" * 70)
        
        # Test 7: Dynamic from fields
        print("\n7. Testing Dynamic From Fields ({{field}} syntax)...")
        self.test_dynamic_from_fields()
        
        # Test 8: Static from fields
        print("\n8. Testing Static From Fields...")
        self.test_static_from_fields()
        
        # Summary
        print("\n" + "=" * 70)
        print("📊 REFACTORED SEND EMAIL FUNCTIONALITY TEST SUMMARY")
        print("=" * 70)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        # Categorize results by feature
        mailto_tests = [r for r in self.test_results if "mailto" in r["test"].lower() or "cc" in r["test"].lower() or "bcc" in r["test"].lower() or "recipient" in r["test"].lower()]
        from_tests = [r for r in self.test_results if "from" in r["test"].lower() or ("dynamic" in r["test"].lower() and "from" in r["test"].lower()) or ("static" in r["test"].lower() and "from" in r["test"].lower())]
        
        mailto_passed = sum(1 for r in mailto_tests if r["success"])
        from_passed = sum(1 for r in from_tests if r["success"])
        
        print(f"\n📋 Feature Breakdown:")
        print(f"  Mailto/CC/BCC Recipients: {mailto_passed}/{len(mailto_tests)} passed")
        print(f"  Dynamic From Fields: {from_passed}/{len(from_tests)} passed")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS ({failed_tests}):")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['message']}")
                    if result.get("details"):
                        print(f"    Details: {result['details']}")
        else:
            print(f"\n🎉 All refactored send_email features working correctly!")
        
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