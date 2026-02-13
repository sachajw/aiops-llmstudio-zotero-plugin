# LM Studio Zotero Plugin - Testing Todo

## Chat Feature Testing

### Basic Chat Functionality
- [ ] Open chat window by clicking "Chat with Document" button
- [ ] Send a message and receive response from LM Studio
- [ ] Verify chat history displays correctly (user messages on right, assistant on left)
- [ ] Test Enter key to send message
- [ ] Test Shift+Enter for new line

### Chat History
- [ ] Verify chat history persists during session
- [ ] Check if chat is saved to item note after conversation
- [ ] Test "Copy" button to copy chat to clipboard
- [ ] Test "Clear" button to clear chat history

### Message Formatting
- [ ] Test markdown rendering (bold, italic)
- [ ] Test code blocks formatting
- [ ] Test inline code formatting
- [ ] Verify line breaks work correctly

### Context Integration
- [ ] Verify item title is included in context
- [ ] Verify authors are included in context
- [ ] Verify abstract is included in context
- [ ] Verify publication info is included in context

## Item Pane Testing

### Buttons
- [ ] "Chat with Document" opens chat window
- [ ] "Summarize" generates summary and saves as note
- [ ] "Ask Question" opens prompt dialog and returns answer
- [ ] "Extract Key Points" extracts bullet points and saves as note

## Context Menu Testing

- [ ] Right-click item(s) → "Summarize with LM Studio" works
- [ ] Right-click item(s) → context menu options appear

## Tools Menu Testing

- [ ] Tools → "Send to LM Studio" sends selected items

## Keyboard Shortcut Testing

- [ ] Cmd+Shift+L (Mac) / Ctrl+Shift+L (Windows) sends selected items

## API Endpoints Testing

```bash
# Status check
curl http://localhost:23119/lmstudio/status

# List models
curl http://localhost:23119/lmstudio/models

# Chat
curl -X POST http://localhost:23119/lmstudio/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello!"}]}'

# Search
curl -X POST http://localhost:23119/lmstudio/search \
  -H "Content-Type: application/json" \
  -d '{"query": "machine learning"}'
```

- [ ] `/lmstudio/status` returns OK with LM Studio connection status
- [ ] `/lmstudio/models` lists available models
- [ ] `/lmstudio/chat` returns chat response
- [ ] `/lmstudio/search` returns matching items

## Preferences Testing

- [ ] Open preferences via Tools → Add-ons → LM Studio → Preferences
- [ ] Test connection button works
- [ ] Verify settings persist after restart

## Error Handling Testing

- [ ] Test behavior when LM Studio is not running
- [ ] Test behavior with no item selected
- [ ] Test behavior with network errors

---

## Notes

- LM Studio running at: http://localhost:1234
- Model loaded: qwen3-14b-mlx
- Zotero HTTP server: port 23119

## Issues Found

| Issue | Description | Status |
|-------|-------------|--------|
| | | |
