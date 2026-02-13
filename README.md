# LLM Studio Zotero Plugin

Connect Zotero to local LLMs (LM Studio, Ollama, etc.) for AI-powered research assistance.

## Features

- **Send to LLM**: Send selected items to your local LLM for analysis
- **Auto-summarize**: Automatically generate summaries for new items
- **API Server**: HTTP endpoints for external integrations
- **Item Pane Section**: AI summary panel in the item detail view
- **Context Menus**: Right-click to summarize or analyze items
- **Keyboard Shortcuts**: Cmd/Ctrl+Shift+L to send to LLM

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
    │   ├── llmstudio-plugin.js   # Main plugin code
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

## Zotero 7 API Patterns Used

### 1. Preference Pane Registration

```javascript
Zotero.PreferencePanes.register({
  pluginID: "llmstudio-zotero@aiops.dev",
  src: rootURI + "content/preferences.xhtml",
  scripts: [rootURI + "content/scripts/preferences.js"],
});
```

### 2. Menu Registration

```javascript
Zotero.MenuManager.register({
  id: "llmstudio-send-selection",
  label: "Send to LLM Studio",
  callback: (event, items) => {
    /* handle */
  },
  target: ["main/library/item"],
});
```

### 3. Item Pane Section

```javascript
Zotero.ItemPaneManager.registerSection({
  paneID: "llmstudio-summary",
  pluginID: "llmstudio-zotero@aiops.dev",
  onRender: ({ body, item }) => {
    /* render */
  },
});
```

### 4. Notifier (Events)

```javascript
Zotero.Notifier.registerObserver(
  observer,
  ["item", "collection"],
  "observer-id",
);
```

### 5. HTTP Endpoints

```javascript
Zotero.Server.Endpoints["/llmstudio/status"] = function () {};
Zotero.Server.Endpoints["/llmstudio/status"].prototype = {
  supportedMethods: ["GET"],
  init: async function (request) {
    return [200, "application/json", JSON.stringify({ status: "ok" })];
  },
};
```

## API Endpoints

When the server is enabled (default port 23121):

| Method | Endpoint            | Description            |
| ------ | ------------------- | ---------------------- |
| GET    | `/llmstudio/status` | Server status          |
| GET    | `/llmstudio/items`  | List items             |
| POST   | `/llmstudio/items`  | Process items with LLM |
| POST   | `/llmstudio/search` | Search items           |

### Example: Send items to LLM

```bash
curl -X POST http://localhost:23121/llmstudio/items \
  -H "Content-Type: application/json" \
  -d '{
    "items": ["ABCD1234"],
    "prompt": "Summarize these items"
  }'
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

## Supported LLM Providers

- **LM Studio** - Default, http://localhost:1234
- **Ollama** - http://localhost:11434/v1
- **OpenAI** - https://api.openai.com/v1 (with API key)
- **Custom** - Any OpenAI-compatible API

## Debugging

View debug output:

1. Start Zotero with `-jsconsole` flag
2. Or enable: Help → Debug Output Logging

Filter logs: `[LLMStudio]`

## License

MIT
