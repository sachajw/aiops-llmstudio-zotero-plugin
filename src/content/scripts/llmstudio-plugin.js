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
const PLUGIN_ID = "llmstudio-zotero@aiops.dev";
const PLUGIN_PREF_BRANCH = "extensions.zotero.llmstudio-zotero.";

// LM Studio default ports
const LMSTUDIO_PORTS = [1234, 8080, 3000];
const LMSTUDIO_GREETING_PATH = "/lmstudio-greeting";

// Global reference stored in bootstrap context
var rootURI;
var pluginID;

/**
 * LM Studio API Client
 * Handles communication with LM Studio's OpenAI-compatible API
 */
const LMStudioAPI = {
	/**
	 * Check if LM Studio server is running
	 */
	async checkServer(baseUrl) {
		try {
			let response = await fetch(`${baseUrl}${LMSTUDIO_GREETING_PATH}`, {
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
			let response = await fetch(`${baseUrl}/v1/models`, {
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
			Zotero.debug(`[LLMStudio] Failed to list models: ${e}`);
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
		let response = await fetch(`${baseUrl}/v1/chat/completions`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Accept": "application/json",
			},
			body: JSON.stringify({
				model: model || "",
				messages: messages,
				max_tokens: options.maxTokens || 4096,
				temperature: options.temperature ?? 0.7,
				top_p: options.topP,
				top_k: options.topK,
				stop: options.stopStrings,
				stream: false,
			}),
		});

		if (!response.ok) {
			let error = await response.text();
			throw new Error(`HTTP ${response.status}: ${error}`);
		}

		let data = await response.json();
		return {
			content: data.choices?.[0]?.message?.content || "",
			role: data.choices?.[0]?.message?.role || "assistant",
			usage: data.usage,
			model: data.model,
		};
	},

	/**
	 * Chat completion with streaming
	 * Returns an async generator yielding chunks
	 */
	async *chatStream(baseUrl, model, messages, options = {}) {
		let response = await fetch(`${baseUrl}/v1/chat/completions`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Accept": "text/event-stream",
			},
			body: JSON.stringify({
				model: model || "",
				messages: messages,
				max_tokens: options.maxTokens || 4096,
				temperature: options.temperature ?? 0.7,
				stream: true,
			}),
		});

		if (!response.ok) {
			let error = await response.text();
			throw new Error(`HTTP ${response.status}: ${error}`);
		}

		let reader = response.body.getReader();
		let decoder = new TextDecoder();
		let buffer = "";

		try {
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
			reader.releaseLock();
		}
	},

	/**
	 * Text completion (non-chat)
	 */
	async complete(baseUrl, model, prompt, options = {}) {
		let response = await fetch(`${baseUrl}/v1/completions`, {
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
		let response = await fetch(`${baseUrl}/v1/embeddings`, {
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
 * Chat history manager (similar to @lmstudio/sdk Chat class)
 */
const ChatManager = {
	/**
	 * Create empty chat history
	 */
	empty() {
		return {
			messages: [],
		};
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

// Extend chat objects with methods
Object.defineProperty(Object.prototype, "append", {
	value: function (role, content) {
		if (!this.messages) this.messages = [];

		this.messages.push({
			role: role,
			content: content,
		});

		return this;
	},
	configurable: true,
	writable: true,
});

/**
 * Main plugin namespace
 */
Zotero.LLMStudio = {
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
		get serverPort() {
			return this.get("server.port", 23121);
		},
		get llmstudioUrl() {
			return this.get("llmstudio.url", "http://localhost:1234");
		},
		get llmstudioModel() {
			return this.get("llmstudio.model", "");
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
			if (this.initialized) return;

			Zotero.debug("[LLMStudio] onStartup: initializing...");

			// Register preference pane
			await this.registerPreferencePane();

			// Register menus
			this.registerMenus();

			// Register item pane section
			this.registerItemPaneSection();

			// Set up notifier for item events
			this.registerNotifier();

			// Start HTTP server
			if (this.prefs.serverEnabled) {
				await this.startServer();
			}

			// Auto-discover LM Studio if URL not set
			if (!this.prefs.llmstudioUrl || this.prefs.llmstudioUrl === "http://localhost:1234") {
				let discovered = await this.api.discoverServer();
				if (discovered) {
					Zotero.debug(`[LLMStudio] Auto-discovered LM Studio at ${discovered.url}`);
				}
			}

			this.initialized = true;
			Zotero.debug("[LLMStudio] onStartup: complete");
		},

		/**
		 * Called when main window loads
		 */
		async onMainWindowLoad(window) {
			Zotero.debug("[LLMStudio] onMainWindowLoad");

			// Inject styles
			this.injectStyles(window);

			// Add keyboard shortcuts
			this.registerKeyShortcuts(window);
		},

		/**
		 * Called when main window unloads
		 */
		async onMainWindowUnload(window) {
			Zotero.debug("[LLMStudio] onMainWindowUnload");
			this.removeKeyShortcuts(window);
		},

		/**
		 * Called on plugin shutdown
		 */
		async onShutdown() {
			Zotero.debug("[LLMStudio] onShutdown: cleaning up...");

			// Unregister notifier
			if (this.notifierID) {
				Zotero.Notifier.unregisterObserver(this.notifierID);
				this.notifierID = null;
			}

			// Unregister menus
			this.unregisterMenus();

			// Stop server
			await this.stopServer();

			this.initialized = false;
			Zotero.debug("[LLMStudio] onShutdown: complete");
		},

		/**
		 * Called when preferences window loads
		 */
		onPrefsEvent(event, { window }) {
			if (event === "load") {
				Zotero.debug("[LLMStudio] Preferences loaded");
				this.initPreferencesUI(window);
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
			Zotero.debug(`[LLMStudio] Registered preference pane: ${paneID}`);
		}
		catch (e) {
			Zotero.debug(`[LLMStudio] Failed to register preference pane: ${e}`);
		}
	},

	/**
	 * Register menus using Zotero.MenuManager API
	 */
	registerMenus() {
		// Tools menu item
		try {
			let menuID = Zotero.MenuManager.register({
				id: "llmstudio-send-selection",
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
				id: "llmstudio-context-summarize",
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
		if (!toolsMenu || doc.getElementById("llmstudio-send-to-llm")) return;

		let menuItem = doc.createXULElement("menuitem");
		menuItem.id = "llmstudio-send-to-llm";
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
				Zotero.debug(`[LLMStudio] Failed to unregister menu ${menuID}: ${e}`);
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
				paneID: "llmstudio-summary",
				pluginID: PLUGIN_ID,
				header: {
					l10nID: "llmstudio-pane-header",
					icon: rootURI + "content/icons/icon-16.svg",
				},
				sidenav: {
					l10nID: "llmstudio-pane-sidenav",
					icon: rootURI + "content/icons/icon-20.svg",
				},
				bodyXHTML: `
					<html:div class="llmstudio-pane-body">
						<html:div class="llmstudio-summary" id="llmstudio-summary-content">
							<html:p>Select an item to generate AI summary</html:p>
						</html:div>
						<html:div class="llmstudio-actions">
							<html:button id="llmstudio-summarize-btn" class="btn">Summarize</html:button>
							<html:button id="llmstudio-ask-btn" class="btn">Ask Question</html:button>
							<html:button id="llmstudio-extract-btn" class="btn">Extract Key Points</html:button>
						</html:div>
					</html:div>
				`,
				onInit: ({ body, doc }) => {
					let summarizeBtn = body.querySelector("#llmstudio-summarize-btn");
					summarizeBtn?.addEventListener("click", () => this.summarizeCurrentItem());

					let askBtn = body.querySelector("#llmstudio-ask-btn");
					askBtn?.addEventListener("click", () => this.promptAndAsk());

					let extractBtn = body.querySelector("#llmstudio-extract-btn");
					extractBtn?.addEventListener("click", () => this.extractKeyPoints());
				},
				onRender: ({ body, item }) => {
					let content = body.querySelector("#llmstudio-summary-content");
					if (content && item) {
						content.innerHTML = `<p>Click a button to analyze: <strong>${item.getField("title") || "this item"}</strong></p>`;
					}
				},
			});
			Zotero.debug(`[LLMStudio] Registered item pane section: ${sectionID}`);
		}
		catch (e) {
			Zotero.debug(`[LLMStudio] Failed to register item pane section: ${e}`);
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
			"llmstudio-observer",
			50
		);

		Zotero.debug(`[LLMStudio] Registered notifier: ${this.notifierID}`);
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
		Zotero.debug(`[LLMStudio] Processing ${itemIDs.length} new items`);
		let items = await Zotero.Items.getAsync(itemIDs);

		for (let item of items) {
			if (!item.isTopLevelItem() || !item.numAttachments()) continue;
			Zotero.debug(`[LLMStudio] Auto-summarizing: ${item.getField("title")}`);
		}
	},

	/**
	 * Start HTTP server
	 */
	async startServer() {
		try {
			this.registerServerEndpoints();
			Zotero.debug(`[LLMStudio] Server ready on port ${this.prefs.serverPort}`);
		}
		catch (e) {
			Zotero.debug(`[LLMStudio] Failed to start server: ${e}`);
		}
	},

	/**
	 * Register HTTP endpoints
	 */
	registerServerEndpoints() {
		// Status endpoint
		Zotero.Server.Endpoints["/llmstudio/status"] = function () {};
		Zotero.Server.Endpoints["/llmstudio/status"].prototype = {
			supportedMethods: ["GET"],
			supportedDataTypes: [],
			permitBookmarklet: false,

			init: async function (request) {
				let isConnected = await Zotero.LLMStudio.api.checkServer(Zotero.LLMStudio.prefs.llmstudioUrl);
				return [
					200,
					"application/json",
					JSON.stringify({
						status: "ok",
						version: "0.1.0",
						lmstudioConnected: isConnected,
						llmstudioUrl: Zotero.LLMStudio.prefs.llmstudioUrl,
					}),
				];
			},
		};
		this.registeredEndpoints.push("/llmstudio/status");

		// Models endpoint
		Zotero.Server.Endpoints["/llmstudio/models"] = function () {};
		Zotero.Server.Endpoints["/llmstudio/models"].prototype = {
			supportedMethods: ["GET"],
			supportedDataTypes: [],
			permitBookmarklet: false,

			init: async function (request) {
				let models = await Zotero.LLMStudio.api.listModels(Zotero.LLMStudio.prefs.llmstudioUrl);
				return [200, "application/json", JSON.stringify({ models })];
			},
		};
		this.registeredEndpoints.push("/llmstudio/models");

		// Chat endpoint
		Zotero.Server.Endpoints["/llmstudio/chat"] = function () {};
		Zotero.Server.Endpoints["/llmstudio/chat"].prototype = {
			supportedMethods: ["POST"],
			supportedDataTypes: ["application/json"],
			permitBookmarklet: false,

			init: async function (request) {
				let data = request.data;
				let result = await Zotero.LLMStudio.api.chat(
					Zotero.LLMStudio.prefs.llmstudioUrl,
					data.model || Zotero.LLMStudio.prefs.llmstudioModel,
					data.messages,
					data.options || {}
				);
				return [200, "application/json", JSON.stringify(result)];
			},
		};
		this.registeredEndpoints.push("/llmstudio/chat");

		// Search endpoint
		Zotero.Server.Endpoints["/llmstudio/search"] = function () {};
		Zotero.Server.Endpoints["/llmstudio/search"].prototype = {
			supportedMethods: ["POST"],
			supportedDataTypes: ["application/json"],
			permitBookmarklet: false,

			init: async function (request) {
				let query = request.data.query;
				let results = await Zotero.LLMStudio.semanticSearch(query);
				return [200, "application/json", JSON.stringify(results)];
			},
		};
		this.registeredEndpoints.push("/llmstudio/search");

		Zotero.debug(`[LLMStudio] Registered ${this.registeredEndpoints.length} endpoints`);
	},

	/**
	 * Stop HTTP server
	 */
	async stopServer() {
		for (let endpoint of this.registeredEndpoints) {
			delete Zotero.Server.Endpoints[endpoint];
		}
		this.registeredEndpoints = [];
		Zotero.debug("[LLMStudio] Server stopped");
	},

	/**
	 * Inject styles
	 */
	injectStyles(window) {
		let doc = window.document;
		let link = doc.createElement("link");
		link.rel = "stylesheet";
		link.href = rootURI + "content/styles/llmstudio.css";
		doc.head.appendChild(link);
	},

	/**
	 * Register keyboard shortcuts
	 */
	registerKeyShortcuts(window) {
		let key = window.document.createElement("key");
		key.id = "llmstudio-key-send";
		key.setAttribute("key", "L");
		key.setAttribute("modifiers", "accel shift");
		key.setAttribute("oncommand", "Zotero.LLMStudio.sendSelectedItemsToLLM();");

		let keyset = window.document.getElementById("mainKeyset");
		if (keyset) keyset.appendChild(key);
	},

	/**
	 * Remove keyboard shortcuts
	 */
	removeKeyShortcuts(window) {
		let key = window.document.getElementById("llmstudio-key-send");
		if (key) key.remove();
	},

	/**
	 * Initialize preferences UI
	 */
	initPreferencesUI(window) {
		let doc = window.document;
		let testBtn = doc.getElementById("llmstudio-test-connection-button");
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
		let modelsSelect = doc.getElementById("llmstudio-model-select");

		if (resultSpan) {
			resultSpan.textContent = "Testing...";
			resultSpan.style.color = "#666";
		}

		try {
			let url = this.prefs.llmstudioUrl;
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
				this.prefs.llmstudioUrl,
				options.model || this.prefs.llmstudioModel,
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
			this.prefs.llmstudioUrl,
			options.model || this.prefs.llmstudioModel,
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

		let chat = ChatManager.fromItems(items, {
			includeAbstracts: true,
			prompt: "Provide a concise summary of these research items, highlighting the key findings and contributions:",
		});

		let result = await this.chat(chat);

		// Store summary as note on first item
		if (items[0] && result.content) {
			await this.addNoteToItem(items[0], result.content, "LM Studio Summary");
		}

		return result.content;
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

			return response.content;
		}
	},

	/**
	 * Extract key points from current item
	 */
	async extractKeyPoints() {
		let items = Zotero.getActiveZoteroPane().getSelectedItems();
		if (!items.length) return;

		let item = items[0];
		let chat = ChatManager.fromItem(item, true);

		chat.append("user", "Extract the key points, main arguments, and conclusions from this research paper. Format as a bulleted list.");

		let result = await this.chat(chat);

		if (result.content) {
			await this.addNoteToItem(item, result.content, "LM Studio Key Points");
		}

		return result.content;
	},

	/**
	 * Add a note to an item
	 */
	async addNoteToItem(item, noteText, title = "LM Studio Note") {
		let note = new Zotero.Item("note");
		note.parentKey = item.key;
		note.setNote(`<h2>${title}</h2>\n<p>${noteText.replace(/\n/g, "<br/>")}</p>`);
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
			this.prefs.llmstudioUrl,
			this.prefs.llmstudioModel,
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
		let prefix = "[LLMStudio]";

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
	Zotero.LLMStudio._rootURI = rootURI;
}

Zotero.debug("[LLMStudio] Plugin script loaded");
