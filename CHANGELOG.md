# Changelog

All notable changes to Webhook Gateway Hub will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-10-30

### 🎉 Initial Production Release

This is the first production-ready release of Webhook Gateway Hub, a self-hosted webhook management platform with SendGrid integration.

### ✨ Added

#### Core Features
- **User Authentication System**
  - Role-based access control (Admin/Standard users)
  - JWT token-based authentication with 24-hour expiration
  - Secure password hashing with bcrypt
  - Force password change on first login

- **Webhook Management**
  - Create custom webhook endpoints with unique paths
  - Auto-generated secret tokens (UUID v4) for validation
  - Field mapping configuration for JSON payloads
  - Full webhook URL display with copy functionality
  - Secret token positioned prominently for easy access
  - Regenerate tokens on demand

- **SendGrid Integration**
  - Add contacts to SendGrid mailing lists
  - Send emails using SendGrid templates
  - View and manage SendGrid contact lists
  - View and manage SendGrid email templates
  - Search and filter lists and templates
  - Create new SendGrid lists directly from the app

- **Dashboard & Analytics**
  - Real-time webhook statistics
  - Success/failure rate tracking
  - Recent activity feed
  - Total endpoints and requests counter

- **Request Logging**
  - Comprehensive webhook request logs
  - Timestamp, payload, status tracking
  - Filter logs by endpoint
  - CSV export functionality
  - Clickable log entries for detailed inspection
  - Full payload and response viewing

- **Settings & API Key Management**
  - Encrypted storage for API keys (AES-256)
  - Support for SendGrid, GitHub, Google Drive, Dropbox
  - Verify connection functionality
  - Edit and delete API keys
  - Audit trail for key operations

- **Backup System**
  - Manual backup creation (ZIP format)
  - Automated backup scheduler with daily/weekly options
  - Retention policy management (keep last N backups)
  - Backup history viewer
  - Local storage with automatic cleanup

- **User Management (Admin)**
  - Create and manage users
  - Assign roles (Admin/Standard)
  - Delete users
  - User session tracking

#### UI/UX Features
- **Dark Mode** 🌙
  - Toggle dark/light theme in Profile page
  - Persistent preference in localStorage
  - Proper contrast and color scheme
  - Dark mode support for all components (cards, badges, code blocks)

- **Profile Page**
  - User information display
  - Role and last login information
  - Dark mode toggle
  - Clean, modern design

- **GitHub Auto-Update** 🔄
  - Configure GitHub repository URL directly in Settings
  - View current version/commit
  - Check for latest releases
  - One-click pull and deploy from GitHub
  - Automatic dependency installation
  - Service restart management

- **Modern, Responsive Design**
  - Glass-morphism effects
  - Gradient accents
  - Smooth animations and transitions
  - Mobile-friendly layout
  - Collapsible sidebar navigation
  - Beautiful color scheme with pastels

### 🛠️ Technical Details

#### Backend
- **Framework**: FastAPI (Python)
- **Database**: MongoDB 7.0 with Motor (async driver)
- **Authentication**: JWT with bcrypt password hashing
- **Encryption**: AES-256 for API keys and secrets
- **Security**: CORS protection, secure token validation
- **Deployment**: Supervisor for process management

#### Frontend
- **Framework**: React 19
- **Routing**: React Router v6
- **UI Library**: Shadcn/UI with Radix UI primitives
- **Styling**: Tailwind CSS with custom configurations
- **HTTP Client**: Axios with interceptors
- **Notifications**: Sonner for toast messages

#### Database Schema
- Users collection with encrypted passwords
- Webhook endpoints with secret tokens
- Request logs with full payload storage
- API keys with encrypted credentials
- Backup records with metadata
- Backup schedule configuration

### 🔒 Security Features
- Password hashing with bcrypt and salt
- JWT tokens with 24-hour expiration
- AES-256 encryption for API keys
- UUID v4 for webhook secret tokens
- CORS protection with configurable origins
- No plaintext secrets in database or logs
- Secure header validation (X-Webhook-Token)

### 📦 Installation
- Automated install script for Ubuntu 24.04 LTS
- Cloudflare Tunnel integration for secure exposure
- systemd service configuration
- Comprehensive installation documentation
- Quick update scripts for GitHub deployments

### 📚 Documentation
- README.md with complete usage guide
- INSTALL_GUIDE.md with detailed setup instructions
- QUICKSTART.md for rapid deployment
- CLOUDFLARE_FIX.md for tunnel configuration
- DEPLOYMENT.md for production guidance

### 🎯 API Endpoints
Complete REST API with endpoints for:
- Authentication (login, password change, user info)
- Webhook management (CRUD operations)
- Webhook receiving (public endpoints)
- Dashboard statistics
- Request logs with filtering
- SendGrid integration (lists, templates, contacts)
- Settings and API key management
- User management (admin only)
- Backup operations (manual and scheduled)
- GitHub configuration and deployment

### Known Issues
None at this time.

### Breaking Changes
None - this is the initial release.

---

## Release Notes

**Version**: 1.0.0  
**Release Date**: October 30, 2025  
**Status**: Production Ready  
**Repository**: https://github.com/wilson1442/Webhook-Hub

### Upgrade Instructions
This is the initial release. For fresh installations, see [INSTALL_GUIDE.md](INSTALL_GUIDE.md).

For future updates from GitHub:
1. Navigate to Settings → Updates tab
2. Enter your GitHub repository URL
3. Click "Pull & Deploy Latest Release"

Or use the update script:
```bash
bash update-from-github.sh
```

### Support
- **GitHub Issues**: https://github.com/wilson1442/Webhook-Hub/issues
- **Documentation**: See README.md and docs folder

---

**Built with ❤️ using FastAPI + React + MongoDB**
