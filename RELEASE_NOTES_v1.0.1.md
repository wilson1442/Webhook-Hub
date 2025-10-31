# Webhook Gateway Hub - Version 1.0.1 Release Notes

**Release Date**: October 31, 2025  
**Version**: 1.0.1  
**Type**: Feature Enhancement & Bug Fix Release

---

## 🎉 What's New in 1.0.1

### Dynamic Field Mapping ✨

The biggest feature in this release is **unlimited custom field mapping** for webhook endpoints!

#### Key Features:
- **Add Unlimited Fields**: Use the "Add Field" button to map as many fields as you need
- **Clear Column Headers**: 
  - Left column: "SendGrid Field" (where data goes in SendGrid)
  - Right column: "Payload Field" (where data comes from in your webhook)
- **Smart Field Detection**: 
  - Standard SendGrid fields (first_name, last_name, phone_number, etc.) are automatically recognized
  - Custom fields are sent to SendGrid's custom fields API
- **Easy Management**: Remove any field with the X button (except required email field)
- **Visual Feedback**: See all your field mappings directly in the webhook card

#### Supported Standard SendGrid Fields:
- `first_name`, `last_name`
- `phone_number`, `whatsapp`, `line`, `facebook`
- `address_line_1`, `address_line_2`
- `city`, `state_province_region`, `postal_code`, `country`
- `unique_name`

#### Custom Fields:
Use any field name not in the standard list, and it will be automatically sent as a SendGrid custom field!

**Example Use Case:**
```
SendGrid Field → Payload Field
email          → email
first_name     → firstname
last_name      → lastname
phone_number   → phone
company        → company_name (custom field)
job_title      → title (custom field)
```

---

## 🔧 Improvements

### Full Payload Storage
- Webhook logs now store **complete payload data** (not just 500-character summary)
- View full payloads in log detail dialog with proper JSON formatting
- No more truncated data!

### Better Webhook Cards
- **Fixed**: Cards now properly start collapsed on page load
- Chevron icons correctly indicate state (down = collapsed, up = expanded)
- Clean, organized display

### GitHub Integration Enhancement
- **Token-Optional**: Check latest releases for public repos without authentication
- Works seamlessly whether you have a GitHub token or not

### Enhanced Debugging
- SendGrid API requests and responses are now logged
- Success messages include SendGrid Job ID for tracking
- Better error messages for troubleshooting

---

## 🐛 Bug Fixes

- Fixed webhook cards showing expanded on initial page load
- Fixed field mapping not supporting custom payload field names
- Fixed GitHub release detection requiring token for public repos
- Fixed payload truncation in logs (was limited to 500 chars)
- Fixed SendGrid contacts not being added when field names didn't match

---

## 🗑️ Cleanup

Removed obsolete diagnostic scripts that are no longer needed:
- `diagnose-login.sh`
- `fix-correct-url.sh`
- `fix-frontend-local.sh`
- `test-frontend-backend.sh`
- `test-network.sh`
- `test-tunnel-routing.sh`

---

## 📋 Upgrade Instructions

### From Version 1.0.0 to 1.0.1

**Option 1: GitHub Auto-Update (Recommended)**
1. Go to Settings → Updates tab
2. Ensure your GitHub repository URL is configured
3. Click "Step 1: Pull Latest Code"
4. Click "Step 2: Deploy & Restart Services"

**Option 2: Manual Update**
```bash
cd /opt/webhook-gateway  # or your installation directory
git pull origin main
pip install -r backend/requirements.txt
cd frontend && yarn install
sudo supervisorctl restart all
```

---

## 🎯 How to Use Dynamic Field Mapping

### Creating a New Webhook with Custom Fields:

1. **Navigate to Webhooks** and click "Create Endpoint"
2. **Set basic info**: Name, URL Path, Mode
3. **Configure field mapping**:
   - The email field is pre-configured (required)
   - Click "Add Field" to add more mappings
   - Left column: Enter SendGrid field name (e.g., `first_name`, `company`)
   - Right column: Enter your payload field name (e.g., `firstname`, `company_name`)
4. **Select SendGrid List** (if adding contacts)
5. **Click "Create Endpoint"**

### Editing Existing Webhooks:

1. Click the **Edit** button on any webhook card
2. You'll see your existing field mappings
3. Update the "Payload Field" column to match your actual payload structure
4. Click "Add Field" to add new mappings
5. Click "Update Endpoint" to save

### Example Scenario:

**Your webhook receives:**
```json
{
  "email": "john@example.com",
  "firstname": "John",
  "lastname": "Doe",
  "phone": "+1234567890",
  "company_name": "Acme Corp"
}
```

**Configure mappings as:**
- `email → email`
- `first_name → firstname`
- `last_name → lastname`
- `phone_number → phone`
- `company → company_name` (custom field)

---

## 💡 Pro Tips

1. **Standard vs Custom Fields**: Use standard SendGrid field names (with underscores) on the left for better compatibility
2. **Custom Fields**: Any field not in the standard list automatically becomes a custom field in SendGrid
3. **Field Validation**: Make sure your payload field names exactly match what you're sending in your webhooks
4. **Testing**: Use the Logs page to verify your payloads are being processed correctly

---

## 📊 Version Comparison

| Feature | v1.0.0 | v1.0.1 |
|---------|--------|--------|
| Field Mappings | 3 fixed fields | Unlimited dynamic fields |
| Payload Storage | 500 char summary | Full payload |
| GitHub Release Check | Token required | Token optional |
| Webhook Cards | Broken collapse | Fixed collapse |
| Custom SendGrid Fields | Not supported | Fully supported |

---

## 🔄 Breaking Changes

**None!** This is a backwards-compatible update. Your existing webhooks will continue to work exactly as before.

---

## 🐛 Known Issues

None at this time. If you encounter any issues, please report them via GitHub Issues.

---

## 📞 Support

- **Documentation**: See README.md and CHANGELOG.md
- **GitHub Repository**: https://github.com/wilson1442/Webhook-Hub
- **GitHub Issues**: https://github.com/wilson1442/Webhook-Hub/issues

---

## 🙏 Thank You

Thank you for using Webhook Gateway Hub! This release focuses on making the field mapping system more flexible and powerful to handle real-world webhook integration scenarios.

**Built with ❤️ using FastAPI + React + MongoDB**
