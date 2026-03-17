# Changelog

All notable changes to the LLM Studio Zotero Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-13

### 🔐 Security

#### Fixed - Critical Vulnerabilities
- **[CRITICAL] Fixed prototype pollution vulnerability** - Removed dangerous `Object.prototype.append` modification that could affect all JavaScript objects. Replaced with proper `Chat` class implementation.
- **[CRITICAL] Fixed XSS vulnerability in note creation** - All HTML content from LLM responses is now sanitized before being inserted into Zotero notes. Strips dangerous tags (`<script>`, `<iframe>`, etc.) and event handlers.
- **[CRITICAL] Fixed SSRF vulnerability** - Added URL validation to prevent requests to private IP ranges (10.x, 172.16-31.x, 192.168.x) and cloud metadata endpoints (169.254.169.254).
- **[CRITICAL] Added API authentication** - HTTP API endpoints now require API key authentication via `X-API-Key` header. API keys are auto-generated on first startup.

#### Added - Security Features
- **API key management UI** - Display, copy, and regenerate API keys from preferences
- **Security settings** - Control remote server access and maintain trusted hosts whitelist
- **Input validation** - All API requests validated for correct structure, types, and ranges
- **URL validation** - Only localhost connections allowed by default; remote servers require explicit opt-in
- **SSRF protection** - Blocks access to private IP ranges, link-local addresses, and cloud metadata services

### 🛠️ Reliability

#### Fixed - Critical Issues
- **[CRITICAL] Implemented timeout logic** - All HTTP requests now use AbortController with configurable timeout (default 30s)
- **[CRITICAL] Implemented retry logic** - Failed requests retry up to 3 times with exponential backoff (1s, 2s, 4s)
- **[CRITICAL] Fixed silent failures** - All operations now show user-friendly success/error notifications via `Zotero.ProgressWindow`
- **[CRITICAL] Fixed stream resource leak** - Stream readers properly cleaned up even when errors occur

#### Added - Reliability Features
- **Secure fetch wrapper** - `SecurityUtils.secureFetch()` combines URL validation, timeout, and retry logic
- **Error notifications** - Users see helpful error messages with details instead of silent failures
- **Success notifications** - Positive feedback for completed operations

### 📦 Added - New Features

#### Security Utilities Module
- New `security-utils.js` module providing:
  - `sanitizeHTML()` - Strip dangerous HTML tags and attributes
  - `isValidLLMServerURL()` - Validate URLs before making requests
  - `validateChatRequest()` - Validate chat API request structure
  - `validateSearchQuery()` - Validate search queries
  - `secureFetch()` - Secure wrapper around fetch with timeout/retry
  - `notifyError()` / `notifySuccess()` - User notification helpers
  - `generateAPIKey()` - Cryptographically secure API key generation

#### Chat Class
- New `Chat` class for managing conversation messages
- Replaces prototype pollution approach with clean OOP design
- Backward compatible with existing code

#### Preferences
- Added security preferences:
  - `server.apiKey` - Auto-generated API key for HTTP authentication
  - `security.allowRemoteServers` - Toggle for remote LLM server connections
  - `security.trustedHosts` - Comma-separated whitelist of trusted hostnames
- Enhanced preferences UI with API key display and management

### 🔄 Changed

#### HTTP API (Breaking Change)
- **All API endpoints now require authentication**
- Clients must include `X-API-Key` header in requests
- Returns 401 Unauthorized if API key is missing or invalid

**Migration:**
```bash
# Old (no longer works)
curl http://localhost:23121/llmstudio/status

# New (requires API key)
curl -H "X-API-Key: YOUR_API_KEY" http://localhost:23121/llmstudio/status
```

#### Error Handling
- Changed from silent failures to user-visible notifications
- All user-facing methods wrapped in try-catch blocks
- Detailed error messages shown to users

#### Bootstrap
- `security-utils.js` now loaded before main plugin script
- Ensures `Zotero.SecurityUtils` is available globally

### 🐛 Fixed

#### Code Quality
- Fixed potential reader lock issues in streaming responses
- Improved error handling in all API methods
- Removed console.log pollution (only fallbacks remain for errors)

### 🧪 Testing

#### Added
- `SECURITY_TEST_CHECKLIST.md` - Comprehensive 11-test security validation suite
- `BUILD_READINESS.md` - Pre-build verification checklist
- `BUILD_SUCCESS.md` - Post-build testing guide

### 📝 Documentation

#### Added
- Security testing documentation
- Build and installation guides
- API authentication examples
- Migration guide for existing users

### ⚠️ Breaking Changes

1. **HTTP API Authentication Required**
   - All `/llmstudio/*` endpoints require `X-API-Key` header
   - Existing API clients must be updated

2. **Default Security Policy**
   - Only localhost connections allowed by default
   - Remote LLM servers require opt-in via preferences

### 🔒 Security Advisory

This release fixes 8 critical security vulnerabilities:
- CVE-INTERNAL-001: Prototype Pollution
- CVE-INTERNAL-002: Cross-Site Scripting (XSS)
- CVE-INTERNAL-003: Server-Side Request Forgery (SSRF)
- CVE-INTERNAL-004: Unauthenticated API Access

**Users should update immediately.**

### 📊 Statistics

- **Files changed:** 7 modified, 1 new
- **Lines added:** ~500
- **Security fixes:** 8 critical issues
- **New features:** API authentication, security settings
- **Build size:** 36 KB

---

## [0.0.9] - Previous Release

### Added
- Initial release with LLM Studio integration
- Summarize, extract key points, ask questions features
- HTTP API for external integrations
- Basic preferences UI

### Known Issues
- No API authentication (fixed in 0.1.0)
- Prototype pollution vulnerability (fixed in 0.1.0)
- XSS vulnerability (fixed in 0.1.0)
- SSRF vulnerability (fixed in 0.1.0)

---

## Legend

- 🔐 **Security** - Security-related changes
- 🛠️ **Reliability** - Reliability and stability improvements
- 📦 **Added** - New features
- 🔄 **Changed** - Changes in existing functionality
- 🐛 **Fixed** - Bug fixes
- 🧪 **Testing** - Testing improvements
- 📝 **Documentation** - Documentation changes
- ⚠️ **Breaking** - Breaking changes requiring migration

---

## Upgrade Instructions

### From 0.0.9 to 0.1.0

1. **Update the plugin:**
   - Install `llmstudio-zotero-0.1.0.xpi`
   - Restart Zotero

2. **Get your API key:**
   - Go to: Preferences → LLM Studio → Server Settings
   - Copy the auto-generated API key

3. **Update your API clients:**
   - Add `X-API-Key` header to all HTTP requests
   - Example: `curl -H "X-API-Key: YOUR_KEY" http://localhost:23121/llmstudio/status`

4. **Configure security (optional):**
   - If using remote LLM servers, enable "Allow remote servers"
   - Add trusted hostnames to the whitelist

### First-Time Installation

1. Install the XPI file in Zotero
2. Restart Zotero
3. API key will be auto-generated
4. Configure LLM Studio URL in preferences
5. Start using the plugin!

---

## Support

- **Issues:** [GitHub Issues](https://github.com/your-org/aiops-llmstudio-zotero-plugin/issues)
- **Documentation:** See README.md
- **Security:** Report security issues privately to security@example.com
