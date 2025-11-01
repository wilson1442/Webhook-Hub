#!/usr/bin/env python3
"""
Backend API Testing for Webhook Gateway Hub - Critical Features
Tests webhook logs full payload storage and GitHub release detection without token.
"""

import requests
import json
import time
import sys
import uuid
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
    
    def test_github_info_with_token_simulation(self):
        """Test that GitHub info still works when token is present (simulate by checking configured state)"""
        try:
            # This test verifies that the endpoint works regardless of token presence
            response = self.session.get(f"{BASE_URL}/github/info")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check basic response structure
                expected_fields = ["configured", "repo_url", "owner", "repo"]
                has_basic_fields = all(field in data for field in expected_fields if data.get("configured"))
                
                if data.get("configured") and has_basic_fields:
                    self.log_test("GitHub Info API Structure", True, 
                                f"API returns proper structure for configured repo")
                    return True
                elif not data.get("configured"):
                    self.log_test("GitHub Info API Structure", True, 
                                "API correctly indicates unconfigured state")
                    return True
                else:
                    self.log_test("GitHub Info API Structure", False, 
                                "API response missing expected fields")
                    return False
            else:
                self.log_test("GitHub Info API Structure", False, 
                            f"API failed with status {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("GitHub Info API Structure", False, f"Request error: {str(e)}")
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