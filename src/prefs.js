// LLM Studio Plugin Default Preferences
// These are loaded on plugin startup

// Server settings
pref("extensions.zotero.llmstudio-zotero.server.enabled", true);
pref("extensions.zotero.llmstudio-zotero.server.port", 23121);
pref("extensions.zotero.llmstudio-zotero.server.host", "127.0.0.1");

// LLM Studio connection
pref("extensions.zotero.llmstudio-zotero.llmstudio.url", "http://localhost:1234");
pref("extensions.zotero.llmstudio-zotero.llmstudio.model", "");

// Features
pref("extensions.zotero.llmstudio-zotero.features.autoSummarize", false);
pref("extensions.zotero.llmstudio-zotero.features.maxTokens", 4096);
pref("extensions.zotero.llmstudio-zotero.features.temperature", 0.7);

// Advanced
pref("extensions.zotero.llmstudio-zotero.advanced.timeout", 30000);
pref("extensions.zotero.llmstudio-zotero.advanced.retryCount", 3);
pref("extensions.zotero.llmstudio-zotero.advanced.debugLogging", false);
