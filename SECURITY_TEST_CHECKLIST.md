# Security Fixes Test Checklist

This checklist verifies all critical security and reliability fixes implemented in v0.1.0.

## ✅ Pre-Testing Setup

1. Build and install the plugin:
   ```bash
   npm run build
   # Install the XPI in Zotero
   ```

2. Open Zotero preferences → LLM Studio
3. Verify new security sections appear in preferences

---

## 🔐 Test 1: Prototype Pollution Fix

**Test:** Verify Object.prototype is not polluted

```javascript
// Open Zotero Developer Console (Help → Developer → Run JavaScript)
// Run this code:

// Should return false (no append on Object.prototype)
Object.prototype.hasOwnProperty("append")

// Should not show "append" in iteration
let obj = { name: "test" };
for (let key in obj) {
    console.log(key); // Should only show "name", not "append"
}
```

**Expected:** `hasOwnProperty` returns `false`, iteration shows only object's own properties

---

## 🛡️ Test 2: XSS Protection

**Test:** Try to inject malicious HTML via LLM response

1. Select a Zotero item
2. Modify the code temporarily to return malicious content (or use a local mock):
   ```javascript
   // In llmstudio-plugin.js, temporarily modify summarizeItems:
   result.content = '</p><script>alert("XSS")</script><p>';
   ```
3. Run "Summarize" action
4. Check the created note

**Expected:**
- No alert dialog appears
- Note contains sanitized HTML (script tags removed)
- Content displays safely

**Cleanup:** Remove temporary code modification

---

## 🔑 Test 3: API Authentication

**Test:** Verify API key is required

1. Open preferences and copy the API key
2. Test without API key:
   ```bash
   curl http://localhost:23121/llmstudio/status
   ```
   **Expected:** `{"error":"Unauthorized"}` with HTTP 401

3. Test with valid API key:
   ```bash
   curl -H "X-API-Key: YOUR_COPIED_KEY" http://localhost:23121/llmstudio/status
   ```
   **Expected:** `{"status":"ok",...}` with HTTP 200

4. Test with invalid API key:
   ```bash
   curl -H "X-API-Key: invalid-key-123" http://localhost:23121/llmstudio/status
   ```
   **Expected:** `{"error":"Unauthorized"}` with HTTP 401

---

## 🚫 Test 4: SSRF Protection

**Test:** Verify private IPs and metadata endpoints are blocked

1. Try to set LLM URL to private IP in preferences:
   - `http://192.168.1.1`
   - `http://10.0.0.1`
   - `http://169.254.169.254` (AWS metadata)

2. Click "Test Connection"

**Expected:**
- Error message: "Invalid or unsafe server URL"
- Connection fails with security error
- No actual request made to private IP

---

## ⏱️ Test 5: Timeout & Retry

**Test:** Verify timeout works correctly

1. Set LLM URL to a valid localhost but stop the LM Studio server
2. Set timeout to 5000ms (5 seconds) in preferences
3. Try to summarize an item
4. Measure time to failure

**Expected:**
- Request fails after ~5 seconds (not indefinitely)
- Error notification shown to user
- Console shows timeout error

**Test:** Verify retry works

1. Start LM Studio server but make it slow (or use network throttling)
2. Make a request
3. Check console for retry attempts

**Expected:**
- Multiple retry attempts with exponential backoff (1s, 2s, 4s)
- Eventually succeeds or fails after retries exhausted

---

## ⚠️ Test 6: Error Notifications

**Test:** Verify user sees helpful error messages

1. Stop LM Studio server
2. Try to summarize an item

**Expected:**
- User sees error notification popup
- Message includes helpful details (e.g., "Failed to generate summary")
- Error details shown (e.g., connection timeout)

3. Start LM Studio and retry

**Expected:**
- Success notification appears
- Note is created successfully

---

## 🔒 Test 7: Stream Resource Cleanup

**Test:** Verify no resource leaks

1. Start a streaming chat request
2. Kill LM Studio mid-stream (force quit)
3. Check browser console for errors

**Expected:**
- No "reader lock" errors
- Cleanup happens properly
- No memory leaks

---

## ✅ Test 8: Input Validation

**Test:** Verify API validates input

```bash
# Test invalid messages (not an array)
curl -X POST http://localhost:23121/llmstudio/chat \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages": "not an array"}'
```

**Expected:** `{"error":"messages must be an array"}` with HTTP 400

```bash
# Test invalid temperature
curl -X POST http://localhost:23121/llmstudio/chat \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}],"options":{"temperature":99}}'
```

**Expected:** `{"error":"temperature must be between 0 and 2"}` with HTTP 400

---

## 🔧 Test 9: API Key Management

**Test:** Verify API key UI works

1. Open preferences → LLM Studio → Server Settings
2. Find API key section

**Tests:**
- API key is displayed (64-character hex string)
- Click "Copy" button → verify clipboard contains API key
- Click "Regenerate" button → confirm dialog appears
- Confirm regeneration → new API key generated
- Old key no longer works, new key works

**Expected:** All UI interactions work correctly

---

## 🌐 Test 10: Security Settings

**Test:** Verify remote server controls work

1. By default, `allowRemoteServers` should be `false`
2. Try to connect to `https://api.openai.com/v1`

**Expected:** Connection blocked (localhost only)

3. Enable "Allow remote servers" in preferences
4. Add `api.openai.com` to trusted hosts
5. Try connection again

**Expected:** Connection allowed (if you have valid API endpoint)

---

## 🧪 Test 11: Chat Class Integration

**Test:** Verify Chat class works correctly

```javascript
// In Zotero Developer Console:

// Create a chat
let chat = ChatManager.empty();
chat.append("user", "Hello");
chat.append("assistant", "Hi there!");

// Verify structure
console.log(chat.messages);
// Should show: [{role:"user", content:"Hello"}, {role:"assistant", content:"Hi there!"}]

// Verify chaining works
let chat2 = ChatManager.empty()
    .append("user", "Test 1")
    .append("user", "Test 2");

console.log(chat2.messages.length); // Should be 2
```

**Expected:** All chat operations work, no prototype pollution

---

## 📊 Integration Testing

**Test:** Full workflow with security enabled

1. Start LM Studio with a model loaded
2. Import some items into Zotero
3. Run each feature:
   - ✅ Summarize item
   - ✅ Extract key points
   - ✅ Ask question about item
4. Verify all features work correctly
5. Check all notes created are properly sanitized

**Expected:** Everything works smoothly with security in place

---

## ✅ Success Criteria

All tests should pass with:
- ✅ No XSS vulnerabilities
- ✅ No SSRF vulnerabilities
- ✅ No prototype pollution
- ✅ API authentication required
- ✅ Timeouts working
- ✅ Retry logic working
- ✅ User notifications working
- ✅ No resource leaks
- ✅ Input validation working
- ✅ All features still functional

---

## 🐛 If Tests Fail

1. Check browser console for errors
2. Check Zotero debug log (Help → Debug Output Logging)
3. Verify security-utils.js is loaded (check bootstrap.js)
4. Verify preferences are set correctly
5. Report issues with:
   - What test failed
   - Error message
   - Console output
   - Steps to reproduce

---

## 🎉 Post-Testing

After all tests pass:
1. Update version in manifest.json to 0.1.1
2. Update CHANGELOG.md with security fixes
3. Create release notes highlighting security improvements
4. Consider security audit by third party if deploying publicly
