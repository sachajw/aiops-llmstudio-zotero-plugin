# LLM Studio Zotero Plugin

Connect Zotero to local LLMs (LM Studio, Ollama, etc.) for AI-powered research assistance.

## Features

- **Send to LM Studio**: Send selected items to your local LLM for analysis
- **Summarize**: Generate concise summaries saved as Zotero notes
- **Ask Question**: Interactive Q&A about any research item
- **Extract Key Points**: Bullet-point extraction of main findings
- **Auto-summarize**: Automatically generate summaries for new items
- **API Server**: HTTP endpoints for external integrations
- **Item Pane Section**: AI panel in the item detail view
- **Context Menus**: Right-click to summarize or analyze items
- **Keyboard Shortcuts**: Cmd/Ctrl+Shift+L to send to LLM
- **Streaming Support**: Real-time response streaming (SSE)

## Development Setup

### 1. Install for Development

```bash
# Close Zotero first

# Find your Zotero profile directory
PROFILE_DIR=$(find ~/Library/Application\ Support/Zotero/Profiles -name "*.default" -type d | head -1)

# Create extension proxy file pointing to src directory
echo "$(pwd)/src" > "${PROFILE_DIR}/extensions/llmstudio-zotero@aiops.dev"

# Start Zotero with debug console
/Applications/Zotero.app/Contents/MacOS/zotero -jsconsole -ZoteroDebugText
```

### 2. Build XPI

```bash
bash build.sh
```

### 3. Project Structure

```
src/
├── manifest.json           # Plugin manifest (Manifest V2)
├── bootstrap.js            # Lifecycle hooks (install/startup/shutdown)
├── prefs.js                # Default preferences
└── content/
    ├── scripts/
    │   ├── llmstudio-plugin.js   # Main plugin code + LM Studio API client
    │   └── preferences.js        # Preferences UI logic
    ├── preferences.xhtml   # Preferences UI
    ├── styles/
    │   ├── llmstudio.css         # Main styles
    │   └── preferences.css       # Preferences styles
    └── icons/
        ├── icon-16.svg
        ├── icon-20.svg
        ├── icon-48.png
        └── icon-96.png
└── locale/
    └── en-US/
        └── llmstudio-plugin-preferences.ftl
```

## Architecture

### Communication Flow

```
┌─────────────────┐     OpenAI-compatible HTTP API     ┌─────────────────┐
│    Zotero       │ ─────────────────────────────────► │   LM Studio     │
│    Plugin       │     http://localhost:1234/v1/*     │    Server       │
│                 │ ◄───────────────────────────────── │                 │
│  LMStudioAPI    │         JSON / SSE Stream          │  Loaded Model   │
└─────────────────┘                                    └─────────────────┘
        │
        │ Zotero.Server.Endpoints
        ▼
┌─────────────────┐
│  HTTP Server    │  Port 23121
│  /llmstudio/*   │  External API access
└─────────────────┘
```

### LM Studio API Client

The plugin includes a built-in API client (`LMStudioAPI`) that communicates with LM Studio's OpenAI-compatible endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `checkServer(url)` | `/lmstudio-greeting` | Verify LM Studio is running |
| `discoverServer()` | Auto-scan | Find LM Studio on ports 1234, 8080, 3000 |
| `listModels(url)` | `GET /v1/models` | Get loaded models |
| `chat(url, model, messages, opts)` | `POST /v1/chat/completions` | Chat completion |
| `chatStream(url, model, messages, opts)` | `POST /v1/chat/completions` | Streaming chat (SSE) |
| `embed(url, model, input)` | `POST /v1/embeddings` | Generate embeddings |
| `complete(url, model, prompt, opts)` | `POST /v1/completions` | Text completion |

### ChatManager

Similar to `@lmstudio/sdk`'s Chat class, for building conversations from Zotero items:

```javascript
// Create chat from multiple items
let chat = ChatManager.fromItems(items, {
  includeAbstracts: true,
  prompt: "Analyze these research items:"
});

// Create chat from single item
let chat = ChatManager.fromItem(item, true);  // include abstract

// Append messages
chat.append("user", "What are the main findings?");

// Send to LLM
let result = await Zotero.LLMStudio.chat(chat);
console.log(result.content);
```

### Streaming Example

```javascript
// Stream response in real-time
let chat = ChatManager.fromItem(item, true);
chat.append("user", "Summarize this paper");

for await (const chunk of Zotero.LLMStudio.chatStream(chat)) {
  process.stdout.write(chunk.content);
}
```

## Zotero 7 API Patterns Used

### 1. Preference Pane Registration

```javascript
Zotero.PreferencePanes.register({
  pluginID: "llmstudio-zotero@aiops.dev",
  src: rootURI + "content/preferences.xhtml",
  scripts: [rootURI + "content/scripts/preferences.js"],
  stylesheets: [rootURI + "content/styles/preferences.css"],
});
```

### 2. Menu Registration

```javascript
Zotero.MenuManager.register({
  id: "llmstudio-send-selection",
  label: "Send to LM Studio",
  icon: rootURI + "content/icons/icon-16.svg",
  callback: (event, items) => { /* handle */ },
  target: ["main/library/item", "main/collectionTree"],
});
```

### 3. Item Pane Section

```javascript
Zotero.ItemPaneManager.registerSection({
  paneID: "llmstudio-summary",
  pluginID: "llmstudio-zotero@aiops.dev",
  header: { l10nID: "llmstudio-pane-header", icon: "..." },
  bodyXHTML: `<html:div>...</html:div>`,
  onInit: ({ body, doc }) => { /* setup buttons */ },
  onRender: ({ body, item }) => { /* update content */ },
});
```

### 4. Notifier (Events)

```javascript
Zotero.Notifier.registerObserver(
  observer,
  ["item", "collection", "tag"],
  "llmstudio-observer",
  50  // priority
);
```

### 5. HTTP Endpoints

```javascript
Zotero.Server.Endpoints["/llmstudio/status"] = function () {};
Zotero.Server.Endpoints["/llmstudio/status"].prototype = {
  supportedMethods: ["GET"],
  supportedDataTypes: [],
  permitBookmarklet: false,
  init: async function (request) {
    return [200, "application/json", JSON.stringify({ status: "ok" })];
  },
};
```

## Plugin API Endpoints

When the server is enabled (default port 23121):

| Method | Endpoint            | Description                    |
|--------| ------------------- | ------------------------------ |
| GET    | `/llmstudio/status` | Server status + LM Studio conn |
| GET    | `/llmstudio/models` | List loaded LM Studio models   |
| POST   | `/llmstudio/chat`   | Send chat to LM Studio         |
| POST   | `/llmstudio/search` | Search Zotero items            |

### Example: Chat via API

```bash
curl -X POST http://localhost:23121/llmstudio/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "options": {
      "maxTokens": 1024,
      "temperature": 0.7
    }
  }'
```

### Example: Search Items

```bash
curl -X POST http://localhost:23121/llmstudio/search \
  -H "Content-Type: application/json" \
  -d '{"query": "machine learning"}'
```

## Configuration

Access preferences via **Tools → Add-ons → LLM Studio for Zotero → Preferences**

| Setting        | Default               | Description                       |
| -------------- | --------------------- | --------------------------------- |
| Server Enabled | true                  | Enable HTTP API server            |
| Server Port    | 23121                 | Port for API server               |
| LLM URL        | http://localhost:1234 | URL of your LLM server            |
| Model          | (empty)               | Model to use (empty for default)  |
| Auto-summarize | false                 | Summarize new items automatically |
| Max Tokens     | 4096                  | Maximum tokens for LLM responses  |
| Temperature    | 0.7                   | Response randomness (0-2)         |

## Supported LLM Providers

The plugin uses OpenAI-compatible APIs:

| Provider  | Default URL                    | Notes                    |
| --------- | ------------------------------ | ------------------------ |
| LM Studio | http://localhost:1234          | Default, auto-discovered |
| Ollama    | http://localhost:11434/v1      | Requires Ollama running  |
| OpenAI    | https://api.openai.com/v1      | Requires API key         |
| Custom    | (user-defined)                 | Any OpenAI-compatible    |

## Usage

### From Zotero UI

1. **Tools Menu**: Tools → Send to LM Studio
2. **Context Menu**: Right-click items → Summarize with LM Studio
3. **Item Pane**: Select item → AI Summary tab → Click button
4. **Keyboard**: Cmd/Ctrl+Shift+L

### From JavaScript Console

```javascript
// Get selected items and summarize
let items = Zotero.getActiveZoteroPane().getSelectedItems();
await Zotero.LLMStudio.summarizeItems(items);

// Chat with streaming
let chat = Zotero.LLMStudio.api.ChatManager.fromItem(items[0], true);
for await (const chunk of Zotero.LLMStudio.chatStream(chat)) {
  console.log(chunk.content);
}

// Generate embeddings
let result = await Zotero.LLMStudio.embed("Hello world");
console.log(result.embeddings[0]);  // number[]
```

## Debugging

View debug output:

1. Start Zotero with `-jsconsole` flag
2. Or enable: Help → Debug Output Logging

Filter logs: `[LLMStudio]`

### Common Issues

| Issue | Solution |
|-------|----------|
| "Connection failed" | Ensure LM Studio is running with a model loaded |
| "No models found" | Load a model in LM Studio first |
| Plugin not loading | Check proxy file path is absolute |
| Preferences not saving | Check prefs.js syntax |

## Related Projects

- [LM Studio](https://lmstudio.ai/) - Local LLM application
- [@lmstudio/sdk](https://github.com/lmstudio-ai/lmstudio-js) - Official JavaScript SDK
- [Zotero 7](https://www.zotero.org/) - Reference management
- [Zotero Plugin Development](https://www.zotero.org/support/dev/client_coding/plugin_development)

## License

MIT
