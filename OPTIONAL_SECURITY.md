# Optional Security Features - User Guide

## Overview

All advanced security features are now **OPTIONAL** and **DISABLED BY DEFAULT** for ease of use in local-only setups.

This is perfect for users who only connect to LLM Studio on their local machine (localhost) and don't need enterprise-level security.

---

## 🔓 Default Configuration (Out of the Box)

### What's Enabled by Default
- ✅ **XSS Protection** - Prevents malicious HTML in LLM responses
- ✅ **Prototype Pollution Fix** - Safe JavaScript code
- ✅ **Timeout & Retry** - 30-second timeouts, 3 retry attempts
- ✅ **Error Notifications** - User-friendly error messages
- ✅ **Resource Cleanup** - No memory leaks

### What's Disabled by Default
- ❌ API Authentication (no API key required)
- ❌ SSRF Protection (all URLs allowed)
- ❌ Strict URL validation (no IP filtering)
- ❌ Remote server restrictions

**This means:**
- HTTP API works without authentication: `curl http://localhost:23121/llmstudio/status`
- Connect to any LLM server URL without restrictions
- No complicated setup - just install and use!

---

## 🔒 Optional Security Features

### 1. API Key Authentication (Optional)

**When to enable:**
- You're worried about other local apps accessing your Zotero data via the HTTP API
- You want an extra layer of security
- You're exposing the API over a network (advanced users)

**How to enable:**
1. Open **Zotero → Preferences → LLM Studio**
2. Check: ☑️ **"Require API key authentication for HTTP endpoints"**
3. Copy the auto-generated API key
4. Add the key to your API requests:
   ```bash
   curl -H "X-API-Key: YOUR_KEY" http://localhost:23121/llmstudio/status
   ```

**Default:** ❌ Disabled (no authentication required)

---

### 2. Strict URL Validation (SSRF Protection)

**When to enable:**
- You're connecting to remote LLM servers over the internet
- You're concerned about Server-Side Request Forgery (SSRF) attacks
- You want to block connections to private IP addresses

**What it does:**
- Blocks connections to private IP ranges (192.168.x.x, 10.x.x.x, etc.)
- Blocks cloud metadata endpoints (169.254.169.254)
- Blocks dangerous protocols (file://, ftp://)

**How to enable:**
1. Open **Zotero → Preferences → LLM Studio → Advanced Security**
2. Check: ☑️ **"Enable strict URL validation (SSRF protection)"**

**Default:** ❌ Disabled (all HTTP/HTTPS URLs allowed)

---

### 3. Remote Server Controls

**When to enable:**
- You want to use remote LLM services (OpenAI, Anthropic, etc.)
- You're using a cloud-hosted LLM Studio instance
- Requires: Strict URL validation must be enabled first

**How to enable:**
1. Enable strict URL validation (see above)
2. Check: ☑️ **"Allow remote LLM servers"**
3. Add trusted hostnames to the whitelist (comma-separated):
   ```
   api.openai.com, api.anthropic.com, my-llm-server.com
   ```

**Default:** ❌ Disabled (localhost only when strict validation is on)

---

## 📊 Security Levels Explained

### Level 0: Default (Recommended for Local Use)
**Settings:**
- ❌ API Authentication: OFF
- ❌ Strict Validation: OFF
- ❌ Remote Servers: OFF

**Use case:** Local LLM Studio on localhost
**API usage:** No authentication needed
**URL restrictions:** None (all HTTP/HTTPS allowed)

**Example:**
```bash
# Works out of the box
curl http://localhost:23121/llmstudio/status
curl http://localhost:1234/v1/models
```

---

### Level 1: Basic Security (For Cautious Users)
**Settings:**
- ☑️ API Authentication: ON
- ❌ Strict Validation: OFF
- ❌ Remote Servers: OFF

**Use case:** Local use with API protection
**API usage:** Requires API key
**URL restrictions:** None

**Example:**
```bash
# Requires API key
curl -H "X-API-Key: abc123..." http://localhost:23121/llmstudio/status

# Any LLM URL still works
curl http://192.168.1.100:1234/v1/models  # Works
```

---

### Level 2: Strict Security (For Remote/Network Use)
**Settings:**
- ☑️ API Authentication: ON
- ☑️ Strict Validation: ON
- ☑️ Remote Servers: ON
- Trusted Hosts: api.openai.com

**Use case:** Remote LLM services, network exposure
**API usage:** Requires API key
**URL restrictions:** Localhost + whitelisted hosts only

**Example:**
```bash
# API requires key
curl -H "X-API-Key: abc123..." http://localhost:23121/llmstudio/status

# Remote server allowed if whitelisted
curl https://api.openai.com/v1/models  # Works (in trusted list)
curl http://192.168.1.100:1234  # Blocked (private IP)
```

---

## 🎯 Quick Setup Guide

### For Local-Only Users (98% of users)
**Do nothing!** It works out of the box.
- Install the plugin
- Set LLM Studio URL to `http://localhost:1234`
- Start using it

### For Security-Conscious Users
**Enable API authentication:**
1. Preferences → LLM Studio
2. Check "Require API key authentication"
3. Copy your API key
4. Add `-H "X-API-Key: YOUR_KEY"` to API calls

### For Remote LLM Service Users
**Enable full security:**
1. Preferences → LLM Studio → Advanced Security
2. Check "Enable strict URL validation"
3. Check "Allow remote LLM servers"
4. Add your LLM provider to trusted hosts: `api.openai.com`
5. Set LLM URL to: `https://api.openai.com/v1`

---

## ⚠️ Important Notes

### Always Secure (Cannot Be Disabled)
These security features are always active:
- ✅ **XSS Protection** - Sanitizes all LLM responses
- ✅ **Prototype Pollution Fix** - Prevents JavaScript issues
- ✅ **Timeout/Retry** - Prevents hanging requests
- ✅ **Error Handling** - Safe error messages

### Migration from v0.1.0 (Initial Release)
If you installed the initial build before optional security was added:
- API authentication was ON by default
- You'll need to either:
  1. **Option A:** Disable it in preferences (no breaking change)
  2. **Option B:** Keep using your API key (still works)

---

## 🔧 Troubleshooting

### "Unauthorized" Error
**Problem:** Getting 401 Unauthorized from API

**Solution:**
1. Check if "Require API key authentication" is enabled
2. If enabled: Include API key in header
3. If disabled: Restart Zotero (preference might not have updated)

### "Invalid or unsafe server URL" Error
**Problem:** Can't connect to LLM server

**Solution:**
1. Check if "Enable strict URL validation" is enabled
2. If enabled and using remote server: Enable "Allow remote servers"
3. If remote server: Add hostname to trusted hosts
4. Or: Disable strict validation for local-only use

### API Works Without Key?
**Expected behavior** if authentication is disabled.

**To require authentication:**
1. Enable "Require API key authentication" in preferences
2. Restart Zotero
3. API will now require the key

---

## 📚 More Information

- **Default behavior:** Optimized for local-only usage (easiest setup)
- **All security features:** Available but optional
- **No breaking changes:** Existing users can keep using API keys
- **Flexible:** Choose your security level based on your needs

---

## 💡 Recommendations

### ✅ Use Default Settings If:
- LLM Studio runs on localhost
- You're the only user of your computer
- You trust all apps on your machine
- You want the simplest setup

### ✅ Enable API Authentication If:
- Multiple users share your computer
- You're worried about other apps accessing Zotero
- You want extra peace of mind

### ✅ Enable Full Security If:
- Using remote LLM services
- Exposing API over network
- Working in enterprise environment
- Paranoid about security (that's okay!)

---

**Updated:** February 13, 2026
**Plugin Version:** 0.1.0+
**Default Security Level:** Level 0 (Minimal restrictions, maximum ease of use)
