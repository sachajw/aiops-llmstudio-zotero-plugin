# LLM Studio Zotero Plugin

Connect Zotero to LLM Studio for AI-powered research assistance.

## Features

- Send selected items to LLM Studio
- API server for external integrations
- Configurable connection settings

## Development Setup

### 1. Install for Development

```bash
# Close Zotero first

# Find your Zotero profile directory
PROFILE_DIR=$(find ~/Library/Application\ Support/Zotero/Profiles -name "*.default" -type d | head -1)

# Create extension proxy file
echo "$(pwd)/src" > "${PROFILE_DIR}/extensions/llmstudio-zotero@aiops.dev"

# Start Zotero with debug flags
/Applications/Zotero.app/Contents/MacOS/zotero -jsconsole -ZoteroDebugText
```

### 2. Build XPI

```bash
bash build.sh
```

### 3. Project Structure

```
src/
├── manifest.json           # Plugin manifest
├── bootstrap.js            # Lifecycle hooks
├── prefs.js                # Default preferences
├── content/
│   ├── scripts/
│   │   └── llmstudio-plugin.js   # Main plugin code
│   ├── preferences.xhtml   # Preferences UI
│   └── icons/
│       ├── icon-48.png
│       └── icon-96.png
└── locale/
    └── en-US/
        └── llmstudio-plugin-preferences.ftl
```

## Configuration

Access preferences via Tools → Add-ons → LLM Studio for Zotero → Preferences

- **Server Port**: Port for the API server (default: 23121)
- **LLM Studio URL**: URL of your LLM Studio instance (default: http://localhost:1234)
- **Model**: Model to use (leave empty for default)

## API

The plugin exposes an API server on the configured port (default: 23121).

### Endpoints

- `GET /status` - Server status
- `POST /items` - Send items to LLM Studio

## License

MIT
