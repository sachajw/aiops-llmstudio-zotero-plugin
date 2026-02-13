# API Authentication Guide

As of version 0.1.0, the LLM Studio Zotero plugin requires API key authentication for all HTTP API endpoints.

---

## 🔑 Getting Your API Key

### First Installation
When you install the plugin for the first time, an API key is automatically generated.

### Finding Your API Key

1. Open Zotero
2. Go to: **Edit → Preferences** (or **Zotero → Settings** on macOS)
3. Click the **LLM Studio** tab
4. Scroll to **Server Settings**
5. Your API key is displayed in the **API Key** field

### Copying Your API Key

Click the **Copy** button next to the API key field to copy it to your clipboard.

### Regenerating Your API Key

If you need to regenerate your API key:

1. Click the **Regenerate** button
2. Confirm the regeneration (this will invalidate the old key)
3. Update all applications using the old key

---

## 🚀 Using the API

### Authentication Header

All API requests must include the `X-API-Key` header with your API key.

### Example Requests

#### Check Server Status

```bash
curl -H "X-API-Key: YOUR_API_KEY_HERE" \
     http://localhost:23121/llmstudio/status
```

**Response:**
```json
{
  "status": "ok",
  "version": "0.1.0",
  "lmstudioConnected": true,
  "llmstudioUrl": "http://localhost:1234"
}
```

#### List Available Models

```bash
curl -H "X-API-Key: YOUR_API_KEY_HERE" \
     http://localhost:23121/llmstudio/models
```

**Response:**
```json
{
  "models": [
    {
      "id": "mistral-7b-instruct",
      "owned_by": "lmstudio"
    }
  ]
}
```

#### Chat Completion

```bash
curl -X POST \
     -H "X-API-Key: YOUR_API_KEY_HERE" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "mistral-7b-instruct",
       "messages": [
         {"role": "user", "content": "Hello!"}
       ]
     }' \
     http://localhost:23121/llmstudio/chat
```

**Response:**
```json
{
  "content": "Hello! How can I help you today?",
  "role": "assistant",
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 15,
    "total_tokens": 25
  }
}
```

#### Semantic Search

```bash
curl -X POST \
     -H "X-API-Key: YOUR_API_KEY_HERE" \
     -H "Content-Type: application/json" \
     -d '{
       "query": "machine learning papers"
     }' \
     http://localhost:23121/llmstudio/search
```

---

## 🐍 Python Example

```python
import requests

API_KEY = "your_api_key_here"
BASE_URL = "http://localhost:23121/llmstudio"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

# Check status
response = requests.get(f"{BASE_URL}/status", headers=headers)
print(response.json())

# Chat completion
chat_data = {
    "model": "mistral-7b-instruct",
    "messages": [
        {"role": "user", "content": "Summarize the latest AI research"}
    ]
}
response = requests.post(f"{BASE_URL}/chat", headers=headers, json=chat_data)
print(response.json())
```

---

## 📦 JavaScript/Node.js Example

```javascript
const API_KEY = "your_api_key_here";
const BASE_URL = "http://localhost:23121/llmstudio";

async function chat(messages) {
  const response = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "mistral-7b-instruct",
      messages: messages
    })
  });

  return await response.json();
}

// Usage
chat([
  { role: "user", content: "What are the key themes in this paper?" }
]).then(result => {
  console.log(result.content);
});
```

---

## ⚠️ Error Responses

### 401 Unauthorized

**When:** API key is missing or invalid

```json
{
  "error": "Unauthorized"
}
```

**Fix:** Include valid `X-API-Key` header in your request

### 400 Bad Request

**When:** Invalid request data

```json
{
  "error": "messages must be an array"
}
```

**Fix:** Check your request data matches the API specification

### 500 Internal Server Error

**When:** LLM Studio connection failed or internal error

```json
{
  "error": "HTTP 500: Connection refused"
}
```

**Fix:** Check that LLM Studio is running and accessible

---

## 🔒 Security Best Practices

### Do:
✅ Keep your API key secret
✅ Store API keys in environment variables
✅ Regenerate API keys if compromised
✅ Use HTTPS if exposing API over network (requires reverse proxy)

### Don't:
❌ Commit API keys to version control
❌ Share API keys publicly
❌ Hardcode API keys in client-side code
❌ Use the same API key across multiple environments

---

## 🌐 Network Security

### Default Configuration
- API listens on **127.0.0.1:23121** (localhost only)
- Not accessible from other machines by default
- API key required for authentication

### Exposing to Network (Advanced)

If you need to access the API from other machines:

1. **Use a reverse proxy** (recommended)
   - Set up nginx/Caddy with HTTPS
   - Forward to localhost:23121
   - Add rate limiting and additional security

2. **Configure firewall rules**
   - Restrict access to trusted IPs
   - Consider VPN for remote access

3. **Monitor for suspicious activity**
   - Check logs for unauthorized attempts
   - Rotate API keys regularly

---

## 🆘 Troubleshooting

### "Unauthorized" Error

**Problem:** API key not accepted

**Solutions:**
1. Verify API key is correct (copy from preferences)
2. Check header name is exactly `X-API-Key` (case-sensitive)
3. Ensure no extra spaces in the header value
4. Try regenerating the API key

### "Connection Refused" Error

**Problem:** Cannot connect to plugin API

**Solutions:**
1. Verify Zotero is running
2. Check plugin is installed and enabled
3. Verify server is enabled in preferences
4. Check port 23121 is not blocked by firewall

### Request Timeout

**Problem:** Requests timing out

**Solutions:**
1. Increase timeout in plugin preferences (default 30s)
2. Check LLM Studio is responding
3. Try with smaller requests
4. Check system resources

---

## 📚 API Reference

### Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/llmstudio/status` | GET | Check plugin status | Yes |
| `/llmstudio/models` | GET | List available models | Yes |
| `/llmstudio/chat` | POST | Chat completion | Yes |
| `/llmstudio/search` | POST | Semantic search | Yes |

### Request Validation

#### Chat Request
- `messages`: Array of message objects (required)
  - Each message must have `role` and `content`
- `model`: String (optional, uses default if not specified)
- `options`: Object (optional)
  - `temperature`: Number 0-2 (optional)
  - `maxTokens`: Number 1-100000 (optional)
  - `topP`: Number 0-1 (optional)

#### Search Request
- `query`: String 1-1000 characters (required)

---

## 🔄 Migration from 0.0.9

If you're upgrading from version 0.0.9 (pre-authentication):

### Update Your Code

**Before (0.0.9):**
```bash
curl http://localhost:23121/llmstudio/status
```

**After (0.1.0+):**
```bash
curl -H "X-API-Key: YOUR_KEY" http://localhost:23121/llmstudio/status
```

### Update Environment Variables

```bash
# Add to your .env file
ZOTERO_API_KEY=your_api_key_here
```

### Update Scripts

Search your codebase for:
- `localhost:23121`
- `llmstudio/`
- `fetch` or `curl` calls

Add the `X-API-Key` header to all requests.

---

## 📧 Support

For issues with API authentication:
1. Check this guide first
2. Review error messages carefully
3. Verify API key in preferences
4. Check plugin logs in Zotero console
5. Open an issue on GitHub with details

---

**Last Updated:** February 13, 2026
**Plugin Version:** 0.1.0+
**API Version:** 1.0
