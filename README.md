# LM Studio for Zotero

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

## Quick Start

### Prerequisites

1. **Install LM Studio** from [lmstudio.ai](https://lmstudio.ai/)
2. **Download a model** in LM Studio (e.g., Llama 3, Qwen, Mistral)
3. **Start the local server** in LM Studio:
   - Open LM Studio
   - Go to the "Local Server" tab (or press `Cmd/Ctrl + L`)
   - Click "Start Server" (default port: 1234)
   - Ensure a model is loaded

### Install the Plugin

#### Option 1: Download XPI (Recommended)

1. Download the latest `lmstudio-zotero-x.x.x.xpi` from [Releases](https://github.com/sachajw/aiops-lmstudio-zotero-plugin/releases)
2. In Zotero, go to **Tools → Add-ons**
3. Click the gear icon (⚙️) → **Install Add-on From File**
4. Select the downloaded `.xpi` file
5. Restart Zotero when prompted

#### Option 2: Install from Source (Development)

```bash
# Clone the repository
git clone https://github.com/sachajw/aiops-lmstudio-zotero-plugin.git
cd aiops-lmstudio-zotero-plugin

# Close Zotero first, then create extension proxy file
PROFILE_DIR=$(find ~/Library/Application\ Support/Zotero/Profiles -name "*.default" -type d | head -1)
echo "$(pwd)/src" > "${PROFILE_DIR}/extensions/lmstudio-zotero@aiops.dev"

# Start Zotero
```

### Configure the Plugin

1. In Zotero, go to **Tools → Add-ons**
2. Find "LM Studio for Zotero" and click **Preferences**
3. Configure the following:
   - **LM Studio URL**: `http://localhost:1234` (default)
   - **API Version**: `openai` (default) or `lmstudio-v1` for native API
   - **Model**: Leave empty to use the currently loaded model
4. Click **Test Connection** to verify LM Studio is running

## Using the Plugin in Zotero

### Method 1: Context Menu (Right-Click)

1. Select one or more items in your Zotero library
2. **Right-click** on the selection
3. Choose from the menu:
   - **Summarize with LM Studio** - Generate a summary saved as a note
   - **Ask Question about Item** - Open a dialog to ask questions
   - **Extract Key Points** - Get bullet-point main findings

### Method 2: Tools Menu

1. Select items in your library
2. Go to **Tools → Send to LM Studio**
3. The AI will analyze the selected items

### Method 3: Keyboard Shortcut

1. Select items in your library
2. Press **Cmd+Shift+L** (Mac) or **Ctrl+Shift+L** (Windows/Linux)
3. The selected items will be sent to LM Studio

### Method 4: Item Pane (Individual Items)

1. Click on an item to view its details
2. Look for the **"LM Studio"** or **"AI Summary"** tab in the right pane
3. Click buttons to:
   - Summarize the item
   - Ask questions
   - Extract key points

### Auto-Summarize New Items

To automatically summarize items when added to your library:

1. Go to **Tools → Add-ons → LM Studio for Zotero → Preferences**
2. Enable **"Auto-summarize new items"**
3. New items will be automatically summarized when added

## HTTP API Endpoints

The plugin exposes HTTP endpoints on Zotero's built-in server (default port 23119).

### Check Status

```bash
curl http://localhost:23119/lmstudio/status
```

Response:

```json
{
  "status": "ok",
  "version": "0.1.0",
  "lmstudioConnected": true,
  "lmstudioUrl": "http://localhost:1234"
}
```

### List Available Models

```bash
curl http://localhost:23119/lmstudio/models
```

### Chat with Context

```bash
curl -X POST http://localhost:23119/lmstudio/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Summarize the key themes in my research"}
    ]
  }'
```

### Search Zotero Items

```bash
curl -X POST http://localhost:23119/lmstudio/search \
  -H "Content-Type: application/json" \
  -d '{"query": "machine learning"}'
```

## Configuration Options

Access via **Tools → Add-ons → LM Studio for Zotero → Preferences**

| Setting             | Default               | Description                                          |
| ------------------- | --------------------- | ---------------------------------------------------- |
| **Server Enabled**  | true                  | Enable HTTP API endpoints                            |
| **Require API Key** | false                 | Require authentication for API                       |
| **LM Studio URL**   | http://localhost:1234 | URL of your LM Studio server                         |
| **API Version**     | openai                | API version (openai, lmstudio-v1, anthropic, custom) |
| **Model**           | (empty)               | Specific model to use (empty = current)              |
| **Context Length**  | 0                     | Context window (0 = auto)                            |
| **Auto-summarize**  | false                 | Automatically summarize new items                    |
| **Max Tokens**      | 4096                  | Maximum response length                              |
| **Temperature**     | 0.7                   | Response randomness (0-2)                            |

### API Version Support

| Version       | Endpoint Path  | Best For                                 |
| ------------- | -------------- | ---------------------------------------- |
| `openai`      | `/v1/*`        | Default, works with most LLM servers     |
| `lmstudio-v1` | `/api/v1/*`    | LM Studio native API with extra features |
| `anthropic`   | `/v1/messages` | Anthropic Claude API                     |
| `custom`      | User-defined   | Custom endpoint configurations           |

### LM Studio v1 Features

When using `lmstudio-v1` API version:

- **Stateful chats** - Maintains conversation context across requests
- **MCP support** - Model Context Protocol integrations
- **Stream model loading** - Events during model loading
- **Stream prompt processing** - Events during prompt processing

## Security Features

Optional security features (disabled by default for local use):

- **API Key Authentication** - Require API key for HTTP endpoints
- **Strict URL Validation** - SSRF protection for remote servers
- **Trusted Hosts** - Whitelist allowed remote hosts
- **Allow Remote Servers** - Enable connections to non-localhost URLs

Enable in Preferences if exposing the API beyond localhost.

## Supported LLM Providers

| Provider      | Default URL                  | Notes                        |
| ------------- | ---------------------------- | ---------------------------- |
| **LM Studio** | http://localhost:1234        | Default, auto-discovered     |
| **Ollama**    | http://localhost:11434/v1    | Requires Ollama running      |
| **OpenAI**    | https://api.openai.com/v1    | Requires API key             |
| **Anthropic** | https://api.anthropic.com/v1 | Requires API key             |
| **Custom**    | (user-defined)               | Any OpenAI-compatible server |

## Troubleshooting

### Common Issues

| Issue                    | Solution                                        |
| ------------------------ | ----------------------------------------------- |
| "Connection failed"      | Ensure LM Studio is running with a model loaded |
| "No models found"        | Load a model in LM Studio first                 |
| Plugin not loading       | Check that the XPI was installed correctly      |
| Endpoints not responding | Check Zotero's HTTP server port (default 23119) |
| Slow responses           | Try a smaller/faster model in LM Studio         |

### Debug Mode

1. Start Zotero with debug output:

   ```bash
   /Applications/Zotero.app/Contents/MacOS/zotero -jsconsole -ZoteroDebugText
   ```

2. Filter logs for `[LMStudio]`

### Check LM Studio Connection

1. Open LM Studio
2. Go to Local Server tab
3. Verify "Server Running" is shown
4. Test in browser: `http://localhost:1234/v1/models`

## Development

### Build from Source

```bash
git clone https://github.com/sachajw/aiops-lmstudio-zotero-plugin.git
cd aiops-lmstudio-zotero-plugin
npm run build
```

The XPI file will be created as `lmstudio-zotero-0.1.0.xpi`.

### Project Structure

```
src/
├── manifest.json           # Plugin manifest (Manifest V2)
├── bootstrap.js            # Lifecycle hooks (install/startup/shutdown)
├── prefs.js                # Default preferences
└── content/
    ├── scripts/
    │   ├── lmstudio-plugin.js   # Main plugin code
    │   ├── preferences.js       # Preferences UI logic
    │   └── security-utils.js    # Security utilities
    ├── preferences.xhtml   # Preferences UI
    └── styles/
        ├── lmstudio.css         # Main styles
        └── preferences.css      # Preferences styles
```

## Related Projects

- [LM Studio](https://lmstudio.ai/) - Local LLM application
- [@lmstudio/sdk](https://github.com/lmstudio-ai/lmstudio-js) - Official JavaScript SDK
- [Zotero 7/8](https://www.zotero.org/) - Reference management
- [Zotero Plugin Development](https://www.zotero.org/support/dev/client_coding/plugin_development)

## Author

Sacha Wharton - [GitHub](https://github.com/sachajw)

## License

MIT
