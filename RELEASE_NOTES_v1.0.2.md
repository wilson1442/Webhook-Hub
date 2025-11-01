# Webhook Gateway Hub v1.0.2 - Release Notes

## 🎉 What's New in v1.0.2

This release focuses on improved log management, better UI visibility, and enhanced send_email mode handling.

---

## ✨ New Features

### Log Management Enhancements

#### Delete Individual Log Entries
- **Quick Delete**: Each log entry now has its own delete button for instant removal
- **Confirmation Dialog**: Safety confirmation before deleting to prevent accidental deletions
- **Seamless Update**: Logs list automatically refreshes after deletion

#### Delete All Failed Logs
- **Bulk Cleanup**: New "Delete All Failed" button removes all failed log entries at once
- **Saves Time**: Quickly clean up failed webhook attempts without affecting successful logs
- **Admin Only**: Protected action requiring admin permissions

#### Release Notes Page
- **Version History**: Dedicated page showing all versions and their changes
- **Categorized Changes**: Features, improvements, and bug fixes clearly organized
- **Visual Indicators**: Color-coded version badges (Major, Minor, Patch)
- **Easy Navigation**: Accessible from the main navigation menu

---

## 🎨 UI/UX Improvements

### Test Page Visibility
- **Darker Font Colors**: curl commands and email request previews now use brighter green text
- **Better Contrast**: Improved readability against dark backgrounds
- **Consistent Styling**: All code blocks now use the same high-contrast color scheme

### Log Actions Layout
- **Side-by-Side Buttons**: Retry and Delete buttons displayed together for failed logs
- **Clear Visual Hierarchy**: Delete button styled in red for clear identification
- **Improved Spacing**: Better button layout for cleaner interface

---

## 🔧 Improvements

### Send Email Mode Enhancements

#### Fixed mailto/cc/bcc Handling
- **Correct Field Names**: SendGrid field now properly shows "mailto" instead of "email" for send_email mode
- **Mode-Specific Fields**: email field for add_contact mode, mailto for send_email mode
- **Automatic Conversion**: When switching modes, fields automatically convert between email ↔ mailto

#### Payload Field Defaults
- **mailto as Default**: Send email webhooks now default to "mailto" as the payload field
- **Consistent Mapping**: Field mapping shows mailto → mailto (not mailto → email)
- **Test Page Accuracy**: Sample payloads correctly generate "mailto" field for recipients

#### Backwards Compatibility
- **Old Webhook Support**: Existing webhooks with "email" field still work correctly
- **Automatic Filtering**: Test page skips old "email" fields when generating send_email payloads
- **Seamless Migration**: Edit old webhooks to automatically update to new mailto structure

---

## 🐛 Bug Fixes

- Fixed duplicate "email" and "mailto" fields appearing in test page payloads
- Resolved confusion with field mapping showing wrong field names
- Corrected payload generation to match backend expectations
- Fixed test page not properly reading field mappings from selected webhooks

---

## 📝 Technical Details

### Backend Changes
- Added `DELETE /api/webhooks/logs/{log_id}` endpoint for single log deletion
- Added `DELETE /api/webhooks/logs/failed/all` endpoint for bulk failed log deletion
- Enhanced field handling in `process_send_email` function

### Frontend Changes
- New ReleaseNotes.js page component with version history
- Updated Logs.js with delete functionality and buttons
- Improved TestWebhooks.js font colors for better visibility
- Enhanced Webhooks.js mode switching logic for email/mailto fields

### Version Updates
- Updated VERSION file to 1.0.2
- Updated Layout.js sidebar version display
- Updated CHANGELOG.md with comprehensive release notes

---

## 🚀 Upgrade Instructions

The upgrade from v1.0.1 to v1.0.2 is seamless:

1. **Pull Latest Code**: Update from repository
2. **Restart Services**: `sudo supervisorctl restart all`
3. **No Database Changes**: No migrations required
4. **Backwards Compatible**: All existing webhooks continue to work

---

## 📚 Documentation

- **Release Notes**: Now accessible via sidebar menu
- **CHANGELOG.md**: Updated with all v1.0.2 changes
- **Field Mapping**: Enhanced inline help for mailto/cc/bcc fields

---

## 🙏 Thank You

Thank you for using Webhook Gateway Hub! This release includes improvements based on user feedback and testing.

For questions or support, please refer to the documentation or open an issue.

---

**Release Date**: 2025-01-XX  
**Version**: 1.0.2  
**Previous Version**: 1.0.1
