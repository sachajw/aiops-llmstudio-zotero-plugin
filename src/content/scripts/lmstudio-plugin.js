/**
 * LLM Studio Zotero Plugin
 *
 * Main plugin module providing integration between Zotero and LM Studio.
 * Uses Zotero 7 plugin API patterns.
 *
 * Communication:
 * - Primary: OpenAI-compatible HTTP API (http://localhost:1234/v1/*)
 * - Supports streaming via fetch + ReadableStream
 */

"use strict";

// Plugin configuration
const PLUGIN_ID = "lmstudio-zotero@aiops.dev";
const PLUGIN_PREF_BRANCH = "extensions.zotero.lmstudio-zotero.";

// LM Studio default ports
const LMSTUDIO_PORTS = [1234, 8080, 3000];
const LMSTUDIO_GREETING_PATH = "/lmstudio-greeting";

// API endpoint paths by version
const API_PATHS = {
	"openai": {
		models: "/v1/models",
		chat: "/v1/chat/completions",
		completions: "/v1/completions",
		embeddings: "/v1/embeddings"
	},
	"lmstudio-v1": {
		models: "/api/v1/models",
		chat: "/api/v1/chat",
		load: "/api/v1/models/load",
		unload: "/api/v1/models/unload",
		download: "/api/v1/models/download",
		downloadStatus: "/api/v1/models/download/status"
	},
	"anthropic": {
		messages: "/v1/messages"
	}
};

// Global reference stored in bootstrap context
var rootURI;
var pluginID;

/**
 * Get API endpoint path based on version preference
 */
function getAPIPath(endpoint) {
	let apiVersion = Zotero?.LLMStudio?.prefs?.get("lmstudio.apiVersion", "openai");
	let customEndpoint = Zotero?.LLMStudio?.prefs?.get("lmstudio.customEndpoint", "");

	if (apiVersion === "custom" && customEndpoint) {
		return customEndpoint;
	}

	let paths = API_PATHS[apiVersion];
	return paths?.[endpoint] || API_PATHS.openai[endpoint];
}

/**
 * LM Studio API Client
 * Handles communication with LM Studio (supports multiple API versions)
 */
const LMStudioAPI = {
	/**
	 * Check if LM Studio server is running
	 */
	async checkServer(baseUrl) {
		try {
			let response = await Zotero.SecurityUtils.secureFetch(`${baseUrl}${LMSTUDIO_GREETING_PATH}`, {
				method: "GET",
				headers: { "Accept": "application/json" },
			});

			if (response.ok) {
				let data = await response.json();
				return data?.lmstudio === true;
			}
			return false;
		}
		catch (e) {
			return false;
		}
	},

	/**
	 * Auto-discover LM Studio server
	 */
	async discoverServer() {
		for (let port of LMSTUDIO_PORTS) {
			let url = `http://127.0.0.1:${port}`;
			if (await this.checkServer(url)) {
				return { url, port };
			}
		}
		return null;
	},

	/**
	 * List available models
	 */
	async listModels(baseUrl) {
		try {
			let response = await Zotero.SecurityUtils.secureFetch(`${baseUrl}/v1/models`, {
				method: "GET",
				headers: { "Accept": "application/json" },
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			let data = await response.json();
			return data.data || [];
		}
		catch (e) {
			Zotero.debug(`[LMStudio] Failed to list models: ${e}`);
			return [];
		}
	},

	/**
	 * Get a loaded model (or use any available)
	 */
	async getLoadedModel(baseUrl) {
		let models = await this.listModels(baseUrl);
		if (models.length > 0) {
			return models[0].id;
		}
		return null;
	},

	/**
	 * Chat completion (non-streaming)
	 */
	async chat(baseUrl, model, messages, options = {}) {
		let apiVersion = Zotero?.LLMStudio?.prefs?.get("lmstudio.apiVersion", "openai");
		let endpoint = getAPIPath("chat");

		// Build request body based on API version
		let requestBody = this.buildChatRequest(apiVersion, model, messages, options);

		let response = await Zotero.SecurityUtils.secureFetch(`${baseUrl}${endpoint}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Accept": "application/json",
			},
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			let error = await response.text();
			throw new Error(`HTTP ${response.status}: ${error}`);
		}

		let data = await response.json();
		return this.parseChatResponse(apiVersion, data);
	},

	/**
	 * Build chat request based on API version
	 */
	buildChatRequest(apiVersion, model, messages, options) {
		let prefs = Zotero?.LLMStudio?.prefs;
		let request = {};

		if (apiVersion === "lmstudio-v1") {
			// LM Studio v1 API format
			request = {
				messages: messages,
			};

			// Add optional v1 features
			if (prefs?.get("lmstudio.useStatefulChats")) {
				request.chatId = options.chatId || null; // null = create new chat
			}

			if (prefs?.get("lmstudio.enableMCP")) {
				request.mcpServers = options.mcpServers || [];
			}

			let contextLength = prefs?.get("lmstudio.contextLength", 0);
			if (contextLength > 0) {
				request.contextLength = contextLength;
			}

			// Standard parameters
			if (model) request.model = model;
			if (options.maxTokens) request.maxPredictedTokens = options.maxTokens;
			if (options.temperature !== undefined) request.temperature = options.temperature;
			if (options.topP) request.topP = options.topP;
			if (options.stopStrings) request.stopStrings = options.stopStrings;

		} else if (apiVersion === "anthropic") {
			// Anthropic API format
			request = {
				model: model || "claude-3-sonnet-20240229",
				messages: messages,
				max_tokens: options.maxTokens || 4096,
			};

			if (options.temperature !== undefined) request.temperature = options.temperature;
			if (options.topP) request.top_p = options.topP;
			if (options.topK) request.top_k = options.topK;

		} else {
			// OpenAI format (default)
			request = {
				model: model || "",
				messages: messages,
				max_tokens: options.maxTokens || 4096,
				temperature: options.temperature ?? 0.7,
				stream: false,
			};

			if (options.topP) request.top_p = options.topP;
			if (options.topK) request.top_k = options.topK;
			if (options.stopStrings) request.stop = options.stopStrings;
		}

		return request;
	},

	/**
	 * Parse chat response based on API version
	 */
	parseChatResponse(apiVersion, data) {
		if (apiVersion === "lmstudio-v1") {
			// LM Studio v1 response format
			return {
				content: data.content || "",
				role: "assistant",
				usage: data.stats,
				model: data.model,
				chatId: data.chatId, // For stateful chats
			};
		} else if (apiVersion === "anthropic") {
			// Anthropic response format
			return {
				content: data.content?.[0]?.text || "",
				role: data.role || "assistant",
				usage: data.usage,
				model: data.model,
			};
		} else {
			// OpenAI format (default)
			return {
				content: data.choices?.[0]?.message?.content || "",
				role: data.choices?.[0]?.message?.role || "assistant",
				usage: data.usage,
				model: data.model,
			};
		}
	},

	/**
	 * Chat completion with streaming
	 * Returns an async generator yielding chunks
	 */
	async *chatStream(baseUrl, model, messages, options = {}) {
		let reader = null;
		let apiVersion = Zotero?.LLMStudio?.prefs?.get("lmstudio.apiVersion", "openai");
		let endpoint = getAPIPath("chat");

		// Build request body
		let requestBody = this.buildChatRequest(apiVersion, model, messages, options);
		requestBody.stream = true;

		try {
			let response = await Zotero.SecurityUtils.secureFetch(`${baseUrl}${endpoint}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Accept": "text/event-stream",
				},
				body: JSON.stringify(requestBody),
			});

			if (!response.ok) {
				let error = await response.text();
				throw new Error(`HTTP ${response.status}: ${error}`);
			}

			reader = response.body.getReader();
			let decoder = new TextDecoder();
			let buffer = "";

			while (true) {
				let { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				let lines = buffer.split("\n");
				buffer = lines.pop() || "";

				for (let line of lines) {
					line = line.trim();
					if (!line || !line.startsWith("data: ")) continue;

					let data = line.slice(6);
					if (data === "[DONE]") {
						return;
					}

					try {
						let parsed = JSON.parse(data);
						let delta = parsed.choices?.[0]?.delta;
						if (delta?.content) {
							yield {
								content: delta.content,
								role: delta.role,
								done: false,
							};
						}
					}
					catch (e) {
						// Skip malformed JSON
					}
				}
			}
		}
		finally {
			if (reader) {
				try {
					reader.releaseLock();
				} catch (e) {
					// Reader already released
				}
			}
		}
	},

	/**
	 * Text completion (non-chat)
	 */
	async complete(baseUrl, model, prompt, options = {}) {
		let response = await Zotero.SecurityUtils.secureFetch(`${baseUrl}/v1/completions`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Accept": "application/json",
			},
			body: JSON.stringify({
				model: model || "",
				prompt: prompt,
				max_tokens: options.maxTokens || 4096,
				temperature: options.temperature ?? 0.7,
				stream: false,
			}),
		});

		if (!response.ok) {
			let error = await response.text();
			throw new Error(`HTTP ${response.status}: ${error}`);
		}

		let data = await response.json();
		return {
			content: data.choices?.[0]?.text || "",
			usage: data.usage,
			model: data.model,
		};
	},

	/**
	 * Generate embeddings
	 */
	async embed(baseUrl, model, input) {
		let response = await Zotero.SecurityUtils.secureFetch(`${baseUrl}/v1/embeddings`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Accept": "application/json",
			},
			body: JSON.stringify({
				model: model || "",
				input: Array.isArray(input) ? input : [input],
			}),
		});

		if (!response.ok) {
			let error = await response.text();
			throw new Error(`HTTP ${response.status}: ${error}`);
		}

		let data = await response.json();
		return {
			embeddings: data.data?.map((d) => d.embedding) || [],
			usage: data.usage,
			model: data.model,
		};
	},

	/**
	 * Tokenize text (estimate tokens)
	 */
	estimateTokens(text) {
		// Rough estimation: ~4 characters per token
		return Math.ceil(text.length / 4);
	},
};

/**
 * Chat class for managing conversation messages
 */
class Chat {
	constructor() {
		this.messages = [];
	}

	/**
	 * Append a message to the chat
	 * @param {string} role - Message role (user, assistant, system)
	 * @param {string} content - Message content
	 * @returns {Chat} This chat instance for chaining
	 */
	append(role, content) {
		this.messages.push({
			role: role,
			content: content,
		});
		return this;
	}

	/**
	 * Get all messages
	 * @returns {Array} Array of message objects
	 */
	getMessages() {
		return this.messages;
	}
}

/**
 * Chat history manager (similar to @lmstudio/sdk Chat class)
 */
const ChatManager = {
	/**
	 * Create empty chat history
	 */
	empty() {
		return new Chat();
	},

	/**
	 * Create chat from Zotero item
	 */
	fromItem(item, includeAbstract = true, includeNotes = false) {
		let chat = this.empty();

		// Build context about the item
		let context = `Title: ${item.getField("title") || "Unknown"}\n`;

		let creators = item.getCreators();
		if (creators.length > 0) {
			let authorStr = creators.map((c) => `${c.firstName || ""} ${c.lastName || ""}`.trim()).join(", ");
			context += `Authors: ${authorStr}\n`;
		}

		let date = item.getField("date");
		if (date) {
			context += `Date: ${date}\n`;
		}

		if (includeAbstract) {
			let abstract = item.getField("abstractNote");
			if (abstract) {
				context += `\nAbstract:\n${abstract}\n`;
			}
		}

		if (includeNotes && item.numNotes()) {
			// Notes would need async loading
		}

		chat.append("user", `Analyze this research paper:\n\n${context}`);
		return chat;
	},

	/**
	 * Create chat from multiple items
	 */
	fromItems(items, options = {}) {
		let chat = this.empty();

		let context = items.map((item, i) => {
			let str = `[${i + 1}] ${item.getField("title") || "No Title"}`;

			let creators = item.getCreators();
			if (creators.length > 0) {
				str += ` - ${creators.map((c) => c.lastName || c.firstName || "").filter(Boolean).join(", ")}`;
			}

			let date = item.getField("date")?.match(/\d{4}/)?.[0];
			if (date) str += ` (${date})`;

			if (options.includeAbstracts) {
				let abstract = item.getField("abstractNote");
				if (abstract) {
					str += `\n    Abstract: ${abstract.substring(0, 500)}${abstract.length > 500 ? "..." : ""}`;
				}
			}

			return str;
		}).join("\n\n");

		chat.append("user", `${options.prompt || "Analyze these research items:"}\n\n${context}`);
		return chat;
	},
};

/**
 * Main plugin namespace
 */
Zotero.LMStudio = {
	// State
	initialized: false,
	notifierID: null,
	registeredMenus: [],
	registeredEndpoints: [],
	api: LMStudioAPI,

	/**
	 * Preference accessors
	 */
	prefs: {
		get(key, defaultValue) {
			let value = Zotero.Prefs.get(PLUGIN_PREF_BRANCH + key, true);
			return value !== undefined ? value : defaultValue;
		},

		set(key, value) {
			Zotero.Prefs.set(PLUGIN_PREF_BRANCH + key, value, true);
		},

		// Convenience getters
		get serverEnabled() {
			return this.get("server.enabled", true);
		},
		get lmstudioUrl() {
			return this.get("lmstudio.url", "http://localhost:1234");
		},
		get lmstudioModel() {
			return this.get("lmstudio.model", "");
		},
		get maxTokens() {
			return this.get("features.maxTokens", 4096);
		},
		get temperature() {
			return this.get("features.temperature", 0.7);
		},
		get autoSummarize() {
			return this.get("features.autoSummarize", false);
		},
	},

	/**
	 * Lifecycle hooks called from bootstrap.js
	 */
	hooks: {
		/**
		 * Called on plugin startup
		 */
		async onStartup() {
			if (Zotero.LMStudio.initialized) return;

			Zotero.debug("[LMStudio] onStartup: initializing...");

			// Register preference pane
			await Zotero.LMStudio.registerPreferencePane();

			// Register menus
			Zotero.LMStudio.registerMenus();

			// Register item pane section
			Zotero.LMStudio.registerItemPaneSection();

			// Set up notifier for item events
			Zotero.LMStudio.registerNotifier();

			// Generate API key if not set
			if (!Zotero.LMStudio.prefs.get("server.apiKey")) {
				let apiKey = Zotero.SecurityUtils.generateAPIKey();
				Zotero.LMStudio.prefs.set("server.apiKey", apiKey);
				Zotero.debug("[LMStudio] Generated new API key");
			}

			// Start HTTP server
			if (Zotero.LMStudio.prefs.serverEnabled) {
				await Zotero.LMStudio.startServer();
			}

			// Auto-discover LM Studio if URL not set
			if (!Zotero.LMStudio.prefs.lmstudioUrl || Zotero.LMStudio.prefs.lmstudioUrl === "http://localhost:1234") {
				let discovered = await Zotero.LMStudio.api.discoverServer();
				if (discovered) {
					Zotero.debug(`[LMStudio] Auto-discovered LM Studio at ${discovered.url}`);
				}
			}

			Zotero.LMStudio.initialized = true;
			Zotero.debug("[LMStudio] onStartup: complete");
		},

		/**
		 * Called when main window loads
		 */
		async onMainWindowLoad(window) {
			Zotero.debug("[LMStudio] onMainWindowLoad");

			// Inject styles
			Zotero.LMStudio.injectStyles(window);

			// Add keyboard shortcuts
			Zotero.LMStudio.registerKeyShortcuts(window);
		},

		/**
		 * Called when main window unloads
		 */
		async onMainWindowUnload(window) {
			Zotero.debug("[LMStudio] onMainWindowUnload");
			Zotero.LMStudio.removeKeyShortcuts(window);
		},

		/**
		 * Called on plugin shutdown
		 */
		async onShutdown() {
			Zotero.debug("[LMStudio] onShutdown: cleaning up...");

			// Unregister notifier
			if (Zotero.LMStudio.notifierID) {
				Zotero.Notifier.unregisterObserver(Zotero.LMStudio.notifierID);
				Zotero.LMStudio.notifierID = null;
			}

			// Unregister menus
			Zotero.LMStudio.unregisterMenus();

			// Stop server
			await Zotero.LMStudio.stopServer();

			Zotero.LMStudio.initialized = false;
			Zotero.debug("[LMStudio] onShutdown: complete");
		},

		/**
		 * Called when preferences window loads
		 */
		onPrefsEvent(event, { window }) {
			if (event === "load") {
				Zotero.debug("[LMStudio] Preferences loaded");
				Zotero.LMStudio.initPreferencesUI(window);
			}
		},
	},

	/**
	 * Register preference pane using Zotero 7 API
	 */
	async registerPreferencePane() {
		try {
			let paneID = await Zotero.PreferencePanes.register({
				pluginID: PLUGIN_ID,
				src: rootURI + "content/preferences.xhtml",
				scripts: [rootURI + "content/scripts/preferences.js"],
				stylesheets: [rootURI + "content/styles/preferences.css"],
			});
			Zotero.debug(`[LMStudio] Registered preference pane: ${paneID}`);
		}
		catch (e) {
			Zotero.debug(`[LMStudio] Failed to register preference pane: ${e}`);
		}
	},

	/**
	 * Register menus using Zotero.MenuManager API
	 */
	registerMenus() {
		// Tools menu item
		try {
			let menuID = Zotero.MenuManager.register({
				id: "lmstudio-send-selection",
				label: "Send to LM Studio",
				icon: rootURI + "content/icons/icon-16.svg",
				callback: (event, items) => {
					this.sendItemsToLLM(items);
				},
				target: ["main/library/item", "main/collectionTree"],
			});
			this.registeredMenus.push(menuID);
		}
		catch (e) {
			this.addMenuItemFallback();
		}

		// Context menu for summarization
		try {
			let contextMenuID = Zotero.MenuManager.register({
				id: "lmstudio-context-summarize",
				label: "Summarize with LM Studio",
				icon: rootURI + "content/icons/icon-16.svg",
				callback: (event, items) => {
					this.summarizeItems(items);
				},
				target: ["main/library/item"],
			});
			this.registeredMenus.push(contextMenuID);
		}
		catch (e) {
			Zotero.debug(`[LLMStudio] Context menu registration failed: ${e}`);
		}
	},

	/**
	 * Fallback: Add menu items manually
	 */
	addMenuItemFallback() {
		let windows = Services.wm.getEnumerator("navigator:browser");
		while (windows.hasMoreElements()) {
			let win = windows.getNext();
			this.addMenuItemToWindow(win);
		}
	},

	addMenuItemToWindow(win) {
		let doc = win.document;
		let toolsMenu = doc.getElementById("menu_ToolsPopup");
		if (!toolsMenu || doc.getElementById("lmstudio-send-to-llm")) return;

		let menuItem = doc.createXULElement("menuitem");
		menuItem.id = "lmstudio-send-to-llm";
		menuItem.setAttribute("label", "Send to LM Studio");
		menuItem.addEventListener("command", () => {
			let items = Zotero.getActiveZoteroPane().getSelectedItems();
			this.sendItemsToLLM(items);
		});

		let separator = doc.createXULElement("menuseparator");
		toolsMenu.appendChild(separator);
		toolsMenu.appendChild(menuItem);
	},

	/**
	 * Unregister all menus
	 */
	unregisterMenus() {
		for (let menuID of this.registeredMenus) {
			try {
				Zotero.MenuManager.unregister(menuID);
			}
			catch (e) {
				Zotero.debug(`[LMStudio] Failed to unregister menu ${menuID}: ${e}`);
			}
		}
		this.registeredMenus = [];
	},

	/**
	 * Register custom item pane section
	 */
	registerItemPaneSection() {
		try {
			let sectionID = Zotero.ItemPaneManager.registerSection({
				paneID: "lmstudio-summary",
				pluginID: PLUGIN_ID,
				header: {
					l10nID: "lmstudio-pane-header",
					icon: rootURI + "content/icons/icon-16.svg",
				},
				sidenav: {
					l10nID: "lmstudio-pane-sidenav",
					icon: rootURI + "content/icons/icon-20.svg",
				},
				bodyXHTML: `
					<html:div class="lmstudio-pane-body">
						<html:div class="lmstudio-summary" id="lmstudio-summary-content">
							<html:p>Select an item to generate AI summary</html:p>
						</html:div>
						<html:div class="lmstudio-actions">
							<html:button id="lmstudio-chat-btn" class="btn chat-btn">Chat with Document</html:button>
						</html:div>
						<html:div class="lmstudio-actions" style="margin-top: 8px;">
							<html:button id="lmstudio-summarize-btn" class="btn">Summarize</html:button>
							<html:button id="lmstudio-ask-btn" class="btn">Ask Question</html:button>
							<html:button id="lmstudio-extract-btn" class="btn">Extract Key Points</html:button>
						</html:div>
					</html:div>
				`,
				onInit: ({ body, doc }) => {
					let chatBtn = body.querySelector("#lmstudio-chat-btn");
					chatBtn?.addEventListener("click", () => this.openChatWindow());

					let summarizeBtn = body.querySelector("#lmstudio-summarize-btn");
					summarizeBtn?.addEventListener("click", () => this.summarizeCurrentItem());

					let askBtn = body.querySelector("#lmstudio-ask-btn");
					askBtn?.addEventListener("click", () => this.promptAndAsk());

					let extractBtn = body.querySelector("#lmstudio-extract-btn");
					extractBtn?.addEventListener("click", () => this.extractKeyPoints());
				},
				onRender: ({ body, item }) => {
					let content = body.querySelector("#lmstudio-summary-content");
					if (content && item) {
						content.innerHTML = `<p>Click a button to analyze: <strong>${item.getField("title") || "this item"}</strong></p>`;
					}
				},
			});
			Zotero.debug(`[LMStudio] Registered item pane section: ${sectionID}`);
		}
		catch (e) {
			Zotero.debug(`[LMStudio] Failed to register item pane section: ${e}`);
		}
	},

	/**
	 * Register notifier for item events
	 */
	registerNotifier() {
		let observer = {
			notify: (action, type, ids, extraData) => {
				this.handleNotification(action, type, ids, extraData);
			},
		};

		this.notifierID = Zotero.Notifier.registerObserver(
			observer,
			["item", "collection", "tag"],
			"lmstudio-observer",
			50
		);

		Zotero.debug(`[LMStudio] Registered notifier: ${this.notifierID}`);
	},

	/**
	 * Handle notifications
	 */
	handleNotification(action, type, ids, extraData) {
		if (type === "item" && action === "add" && this.prefs.autoSummarize) {
			this.handleNewItems(ids);
		}
	},

	/**
	 * Handle new items
	 */
	async handleNewItems(itemIDs) {
		Zotero.debug(`[LMStudio] Processing ${itemIDs.length} new items`);
		let items = await Zotero.Items.getAsync(itemIDs);

		for (let item of items) {
			if (!item.isTopLevelItem() || !item.numAttachments()) continue;
			Zotero.debug(`[LMStudio] Auto-summarizing: ${item.getField("title")}`);
		}
	},

	/**
	 * Start HTTP server (register endpoints on Zotero's built-in server)
	 */
	async startServer() {
		try {
			this.registerServerEndpoints();
			Zotero.debug(`[LMStudio] API endpoints registered on Zotero HTTP server`);
		}
		catch (e) {
			Zotero.debug(`[LMStudio] Failed to register endpoints: ${e}`);
		}
	},

	/**
	 * Validate API key from request headers
	 */
	validateAPIKey(request) {
		// Check if authentication is required
		let requireAuth = this.prefs.get("server.requireAuth", false);
		if (!requireAuth) {
			return true; // Authentication disabled, allow all requests
		}

		let apiKey = this.prefs.get("server.apiKey");
		if (!apiKey) {
			return false;
		}

		// Check for API key in headers (case-insensitive)
		let requestKey = request.headers?.["x-api-key"] || request.headers?.["X-API-Key"];
		return requestKey === apiKey;
	},

	/**
	 * Register HTTP endpoints
	 */
	registerServerEndpoints() {
		// Status endpoint
		Zotero.Server.Endpoints["/lmstudio/status"] = function () {};
		Zotero.Server.Endpoints["/lmstudio/status"].prototype = {
			supportedMethods: ["GET"],
			supportedDataTypes: [],
			permitBookmarklet: false,

			init: async function (request) {
				// Validate API key
				if (!Zotero.LMStudio.validateAPIKey(request)) {
					return [401, "application/json", JSON.stringify({ error: "Unauthorized" })];
				}

				let isConnected = await Zotero.LMStudio.api.checkServer(Zotero.LMStudio.prefs.lmstudioUrl);
				return [
					200,
					"application/json",
					JSON.stringify({
						status: "ok",
						version: "0.1.0",
						lmstudioConnected: isConnected,
						lmstudioUrl: Zotero.LMStudio.prefs.lmstudioUrl,
					}),
				];
			},
		};
		this.registeredEndpoints.push("/lmstudio/status");

		// Models endpoint
		Zotero.Server.Endpoints["/lmstudio/models"] = function () {};
		Zotero.Server.Endpoints["/lmstudio/models"].prototype = {
			supportedMethods: ["GET"],
			supportedDataTypes: [],
			permitBookmarklet: false,

			init: async function (request) {
				// Validate API key
				if (!Zotero.LMStudio.validateAPIKey(request)) {
					return [401, "application/json", JSON.stringify({ error: "Unauthorized" })];
				}

				let models = await Zotero.LMStudio.api.listModels(Zotero.LMStudio.prefs.lmstudioUrl);
				return [200, "application/json", JSON.stringify({ models })];
			},
		};
		this.registeredEndpoints.push("/lmstudio/models");

		// Chat endpoint
		Zotero.Server.Endpoints["/lmstudio/chat"] = function () {};
		Zotero.Server.Endpoints["/lmstudio/chat"].prototype = {
			supportedMethods: ["POST"],
			supportedDataTypes: ["application/json"],
			permitBookmarklet: false,

			init: async function (request) {
				// Validate API key
				if (!Zotero.LMStudio.validateAPIKey(request)) {
					return [401, "application/json", JSON.stringify({ error: "Unauthorized" })];
				}

				// Validate request data
				try {
					Zotero.SecurityUtils.validateChatRequest(request.data);
				} catch (e) {
					return [400, "application/json", JSON.stringify({ error: e.message })];
				}

				try {
					let data = request.data;
					let result = await Zotero.LMStudio.api.chat(
						Zotero.LMStudio.prefs.lmstudioUrl,
						data.model || Zotero.LMStudio.prefs.lmstudioModel,
						data.messages,
						data.options || {}
					);
					return [200, "application/json", JSON.stringify(result)];
				} catch (e) {
					return [500, "application/json", JSON.stringify({ error: e.message })];
				}
			},
		};
		this.registeredEndpoints.push("/lmstudio/chat");

		// Search endpoint
		Zotero.Server.Endpoints["/lmstudio/search"] = function () {};
		Zotero.Server.Endpoints["/lmstudio/search"].prototype = {
			supportedMethods: ["POST"],
			supportedDataTypes: ["application/json"],
			permitBookmarklet: false,

			init: async function (request) {
				// Validate API key
				if (!Zotero.LMStudio.validateAPIKey(request)) {
					return [401, "application/json", JSON.stringify({ error: "Unauthorized" })];
				}

				// Validate query
				try {
					Zotero.SecurityUtils.validateSearchQuery(request.data?.query);
				} catch (e) {
					return [400, "application/json", JSON.stringify({ error: e.message })];
				}

				try {
					let query = request.data.query;
					let results = await Zotero.LMStudio.semanticSearch(query);
					return [200, "application/json", JSON.stringify(results)];
				} catch (e) {
					return [500, "application/json", JSON.stringify({ error: e.message })];
				}
			},
		};
		this.registeredEndpoints.push("/lmstudio/search");

		Zotero.debug(`[LMStudio] Registered ${this.registeredEndpoints.length} endpoints`);
	},

	/**
	 * Stop HTTP server
	 */
	async stopServer() {
		for (let endpoint of this.registeredEndpoints) {
			delete Zotero.Server.Endpoints[endpoint];
		}
		this.registeredEndpoints = [];
		Zotero.debug("[LMStudio] Server stopped");
	},

	/**
	 * Inject styles
	 */
	injectStyles(window) {
		let doc = window.document;
		let link = doc.createElement("link");
		link.rel = "stylesheet";
		link.href = rootURI + "content/styles/lmstudio.css";
		doc.head.appendChild(link);
	},

	/**
	 * Register keyboard shortcuts
	 */
	registerKeyShortcuts(window) {
		let key = window.document.createElement("key");
		key.id = "lmstudio-key-send";
		key.setAttribute("key", "L");
		key.setAttribute("modifiers", "accel shift");
		key.setAttribute("oncommand", "Zotero.LMStudio.sendSelectedItemsToLLM();");

		let keyset = window.document.getElementById("mainKeyset");
		if (keyset) keyset.appendChild(key);
	},

	/**
	 * Remove keyboard shortcuts
	 */
	removeKeyShortcuts(window) {
		let key = window.document.getElementById("lmstudio-key-send");
		if (key) key.remove();
	},

	/**
	 * Initialize preferences UI
	 */
	initPreferencesUI(window) {
		let doc = window.document;
		let testBtn = doc.getElementById("lmstudio-test-connection-button");
		if (testBtn) {
			testBtn.addEventListener("command", async () => {
				await this.testConnection(window);
			});
		}
	},

	/**
	 * Test connection to LM Studio
	 */
	async testConnection(window) {
		let doc = window.document;
		let resultSpan = doc.getElementById("connection-test-result");
		let modelsSelect = doc.getElementById("lmstudio-model-select");

		if (resultSpan) {
			resultSpan.textContent = "Testing...";
			resultSpan.style.color = "#666";
		}

		try {
			let url = this.prefs.lmstudioUrl;
			let isConnected = await this.api.checkServer(url);

			if (isConnected) {
				let models = await this.api.listModels(url);

				if (resultSpan) {
					resultSpan.textContent = `✓ Connected (${models.length} models)`;
					resultSpan.style.color = "green";
				}

				// Populate model select if exists
				if (modelsSelect) {
					modelsSelect.innerHTML = '<option value="">Default</option>';
					for (let model of models) {
						let option = doc.createElement("option");
						option.value = model.id;
						option.textContent = model.id;
						modelsSelect.appendChild(option);
					}
				}

				return true;
			}
			else {
				throw new Error("Not an LM Studio server");
			}
		}
		catch (e) {
			if (resultSpan) {
				resultSpan.textContent = `✗ Failed: ${e.message}`;
				resultSpan.style.color = "red";
			}
			return false;
		}
	},

	// ============================================
	// Core LLM Integration Functions
	// ============================================

	/**
	 * Send selected items to LLM
	 */
	async sendSelectedItemsToLLM() {
		let items = Zotero.getActiveZoteroPane().getSelectedItems();
		await this.sendItemsToLLM(items);
	},

	/**
	 * Send items to LLM for analysis
	 */
	async sendItemsToLLM(items) {
		if (!items || !items.length) {
			this.log("No items to send");
			return;
		}

		this.log(`Sending ${items.length} items to LM Studio`);

		let chat = ChatManager.fromItems(items, {
			includeAbstracts: true,
			prompt: "Analyze these research items and provide insights:",
		});

		return await this.chat(chat);
	},

	/**
	 * Send a chat message to LLM
	 */
	async chat(chatOrMessages, options = {}) {
		let messages = chatOrMessages.messages || chatOrMessages;

		try {
			let result = await this.api.chat(
				this.prefs.lmstudioUrl,
				options.model || this.prefs.lmstudioModel,
				messages,
				{
					maxTokens: options.maxTokens || this.prefs.maxTokens,
					temperature: options.temperature ?? this.prefs.temperature,
				}
			);

			this.log("LLM response received");
			return result;
		}
		catch (e) {
			this.log(`Error: ${e.message}`, "error");
			throw e;
		}
	},

	/**
	 * Chat with streaming
	 */
	async *chatStream(chatOrMessages, options = {}) {
		let messages = chatOrMessages.messages || chatOrMessages;

		yield* this.api.chatStream(
			this.prefs.lmstudioUrl,
			options.model || this.prefs.lmstudioModel,
			messages,
			{
				maxTokens: options.maxTokens || this.prefs.maxTokens,
				temperature: options.temperature ?? this.prefs.temperature,
			}
		);
	},

	/**
	 * Summarize items
	 */
	async summarizeItems(items) {
		if (!items || !items.length) return;

		try {
			let chat = ChatManager.fromItems(items, {
				includeAbstracts: true,
				prompt: "Provide a concise summary of these research items, highlighting the key findings and contributions:",
			});

			let result = await this.chat(chat);

			// Store summary as note on first item
			if (items[0] && result.content) {
				await this.addNoteToItem(items[0], result.content, "LM Studio Summary");
			}

			Zotero.SecurityUtils.notifySuccess("Summary generated successfully");
			return result.content;
		} catch (e) {
			this.log(`Summarize failed: ${e.message}`, "error");
			Zotero.SecurityUtils.notifyError("Failed to generate summary", e.message);
			throw e;
		}
	},

	/**
	 * Summarize currently selected item
	 */
	async summarizeCurrentItem() {
		let items = Zotero.getActiveZoteroPane().getSelectedItems();
		if (items.length > 0) {
			return await this.summarizeItems([items[0]]);
		}
	},

	/**
	 * Prompt user and ask question
	 */
	async promptAndAsk() {
		let items = Zotero.getActiveZoteroPane().getSelectedItems();
		if (!items.length) return;

		let item = items[0];

		try {
			// Use prompt service
			let promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
				.getService(Components.interfaces.nsIPromptService);

			let input = { value: "" };
			let result = promptService.prompt(
				null,
				"Ask about this item",
				`Question about: ${item.getField("title") || "this item"}`,
				input,
				null,
				{}
			);

			if (result && input.value) {
				let chat = ChatManager.fromItem(item, true);
				chat.append("user", input.value);

				let response = await this.chat(chat);
				await this.addNoteToItem(item, `Q: ${input.value}\n\nA: ${response.content}`, "LM Studio Q&A");

				Zotero.SecurityUtils.notifySuccess("Question answered successfully");
				return response.content;
			}
		} catch (e) {
			this.log(`promptAndAsk failed: ${e.message}`, "error");
			Zotero.SecurityUtils.notifyError("Failed to answer question", e.message);
			throw e;
		}
	},

	/**
	 * Extract key points from current item
	 */
	async extractKeyPoints() {
		let items = Zotero.getActiveZoteroPane().getSelectedItems();
		if (!items.length) return;

		let item = items[0];

		try {
			let chat = ChatManager.fromItem(item, true);

			chat.append("user", "Extract the key points, main arguments, and conclusions from this research paper. Format as a bulleted list.");

			let result = await this.chat(chat);

			if (result.content) {
				await this.addNoteToItem(item, result.content, "LM Studio Key Points");
			}

			Zotero.SecurityUtils.notifySuccess("Key points extracted successfully");
			return result.content;
		} catch (e) {
			this.log(`extractKeyPoints failed: ${e.message}`, "error");
			Zotero.SecurityUtils.notifyError("Failed to extract key points", e.message);
			throw e;
		}
	},

	/**
	 * Open chat window for continuous conversation with document
	 */
	openChatWindow() {
		let items = Zotero.getActiveZoteroPane().getSelectedItems();
		if (!items.length) {
			Zotero.SecurityUtils.notifyError("No item selected");
			return;
		}

		let item = items[0];

		// Open the chat window
		try {
			window.openDialog(
				"chrome://lmstudio-zotero/content/chat-panel.xhtml",
				"lmstudio-chat-window",
				"chrome,dialog=no,resizable,centerscreen,width=600,height=500",
				{ item: item }
			);
			this.log(`Opened chat window for item: ${item.key}`);
		} catch (e) {
			this.log(`Failed to open chat window: ${e.message}`, "error");
			Zotero.SecurityUtils.notifyError("Failed to open chat window", e.message);
		}
	},

	/**
	 * Add a note to an item
	 */
	async addNoteToItem(item, noteText, title = "LM Studio Note") {
		// Sanitize inputs to prevent XSS attacks
		let safeTitle = Zotero.SecurityUtils.sanitizeHTML(title);
		let safeContent = Zotero.SecurityUtils.sanitizeHTML(noteText);

		// Convert newlines to <br/> after sanitization
		safeContent = safeContent.replace(/\n/g, "<br/>");

		let note = new Zotero.Item("note");
		note.parentKey = item.key;
		note.setNote(`<h2>${safeTitle}</h2>\n<div>${safeContent}</div>`);
		await note.saveTx();

		this.log(`Added note to item ${item.key}`);
		return note;
	},

	/**
	 * Semantic search using Zotero's built-in search
	 */
	async semanticSearch(query) {
		let s = new Zotero.Search();
		s.addCondition("title", "contains", query);
		s.addCondition("abstractNote", "contains", query);
		s.addCondition("note", "contains", query);

		let itemIDs = await s.search();
		let items = await Zotero.Items.getAsync(itemIDs);

		return items.slice(0, 20).map((item) => ({
			key: item.key,
			title: item.getField("title"),
			itemType: item.itemType,
			date: item.getField("date"),
			abstract: item.getField("abstractNote")?.substring(0, 200),
		}));
	},

	/**
	 * Generate embeddings for text
	 */
	async embed(text) {
		return await this.api.embed(
			this.prefs.lmstudioUrl,
			this.prefs.lmstudioModel,
			text
		);
	},

	// ============================================
	// Utility Methods
	// ============================================

	/**
	 * Logging utility
	 */
	log(message, level = "info") {
		let prefix = "[LMStudio]";

		switch (level) {
			case "error":
				Zotero.debug(`${prefix} ERROR: ${message}`);
				break;
			case "warn":
				Zotero.debug(`${prefix} WARN: ${message}`);
				break;
			default:
				Zotero.debug(`${prefix} ${message}`);
		}
	},

	/**
	 * Show notification popup
	 */
	showNotification(message, type = "info") {
		let progressWindow = new Zotero.ProgressWindow({ closeOnClick: true });
		progressWindow.changeHeadline("LM Studio");
		progressWindow.progress = new progressWindow.ItemProgress(
			rootURI + "content/icons/icon-48.png",
			message
		);
		progressWindow.show();
		progressWindow.startCloseTimer(3000);
	},
};

// Store rootURI reference
if (typeof rootURI !== "undefined") {
	Zotero.LMStudio._rootURI = rootURI;
}

Zotero.debug("[LMStudio] Plugin script loaded");
