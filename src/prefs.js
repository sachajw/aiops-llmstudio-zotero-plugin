// LM Studio Plugin Default Preferences
// These are loaded on plugin startup

// Server settings (endpoints are registered on Zotero's built-in HTTP server)
// Note: The actual port is configured in Zotero's preferences (default: 23119)
pref("extensions.zotero.lmstudio-zotero.server.enabled", true);
pref("extensions.zotero.lmstudio-zotero.server.apiKey", "");
pref("extensions.zotero.lmstudio-zotero.server.requireAuth", false);

// Security settings
pref("extensions.zotero.lmstudio-zotero.security.enableStrictValidation", false);
pref("extensions.zotero.lmstudio-zotero.security.allowRemoteServers", false);
pref("extensions.zotero.lmstudio-zotero.security.trustedHosts", "");

// LLM Studio connection
pref("extensions.zotero.lmstudio-zotero.lmstudio.url", "http://localhost:1234");
pref("extensions.zotero.lmstudio-zotero.lmstudio.model", "");
pref("extensions.zotero.lmstudio-zotero.lmstudio.apiVersion", "openai"); // openai, lmstudio-v1, anthropic, custom

// LM Studio v1 API features
pref("extensions.zotero.lmstudio-zotero.lmstudio.useStatefulChats", false);
pref("extensions.zotero.lmstudio-zotero.lmstudio.enableMCP", false);
pref("extensions.zotero.lmstudio-zotero.lmstudio.streamModelLoading", false);
pref("extensions.zotero.lmstudio-zotero.lmstudio.streamPromptProcessing", false);
pref("extensions.zotero.lmstudio-zotero.lmstudio.contextLength", 0); // 0 = auto
pref("extensions.zotero.lmstudio-zotero.lmstudio.customEndpoint", "");

// Features
pref("extensions.zotero.lmstudio-zotero.features.autoSummarize", false);
pref("extensions.zotero.lmstudio-zotero.features.maxTokens", 4096);
pref("extensions.zotero.lmstudio-zotero.features.temperature", 0.7);

// Advanced
pref("extensions.zotero.lmstudio-zotero.advanced.timeout", 30000);
pref("extensions.zotero.lmstudio-zotero.advanced.retryCount", 3);
pref("extensions.zotero.lmstudio-zotero.advanced.debugLogging", false);
