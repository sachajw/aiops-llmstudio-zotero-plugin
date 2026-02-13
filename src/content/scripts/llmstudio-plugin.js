/**
 * LLM Studio Zotero Plugin
 *
 * Main plugin module providing integration between Zotero and LLM Studio
 */

"use strict";

// Create namespace
Zotero.LLMStudio = {
  // Plugin state
  initialized: false,
  server: null,

  // Lifecycle hooks
  hooks: {
    async onStartup() {
      Zotero.debug("[LLMStudio] onStartup called");

      // Register preferences
      this.registerPrefs();

      // Initialize services
      await this.initServer();

      this.initialized = true;
      Zotero.debug("[LLMStudio] Initialization complete");
    },

    async onMainWindowLoad(window) {
      Zotero.debug("[LLMStudio] Main window loaded");

      // Add UI elements
      this.addMenuItems(window);
    },

    async onMainWindowUnload(window) {
      Zotero.debug("[LLMStudio] Main window unloaded");
    },

    async onShutdown() {
      Zotero.debug("[LLMStudio] Shutting down");

      if (this.server) {
        await this.stopServer();
      }

      this.initialized = false;
    },
  },

  // Preference handling
  registerPrefs() {
    this.prefs = {
      get serverEnabled() {
        return Zotero.Prefs.get("extensions.zotero.llmstudio-zotero.server.enabled", true);
      },
      get serverPort() {
        return Zotero.Prefs.get("extensions.zotero.llmstudio-zotero.server.port", 23121);
      },
      get llmstudioUrl() {
        return Zotero.Prefs.get("extensions.zotero.llmstudio-zotero.llmstudio.url", "http://localhost:1234");
      },
      get maxTokens() {
        return Zotero.Prefs.get("extensions.zotero.llmstudio-zotero.features.maxTokens", 4096);
      },
    };
  },

  // HTTP Server for MCP/API
  async initServer() {
    if (!this.prefs.serverEnabled) {
      Zotero.debug("[LLMStudio] Server disabled in preferences");
      return;
    }

    const port = this.prefs.serverPort;
    Zotero.debug(`[LLMStudio] Starting server on port ${port}`);

    // TODO: Implement HTTP server
    // This would typically use Firefox's nsIServerSocket or similar
  },

  async stopServer() {
    if (this.server) {
      Zotero.debug("[LLMStudio] Stopping server");
      // TODO: Stop server
      this.server = null;
    }
  },

  // UI Integration
  addMenuItems(window) {
    const doc = window.document;

    // Add menu item to Tools menu
    const toolsMenu = doc.getElementById("menu_ToolsPopup");
    if (toolsMenu) {
      const menuItem = doc.createXULElement("menuitem");
      menuItem.setAttribute("id", "llmstudio-send-to-llm");
      menuItem.setAttribute("label", "Send to LLM Studio");
      menuItem.addEventListener("command", () => {
        this.sendSelectedItemsToLLM();
      });

      toolsMenu.appendChild(menuItem);
    }
  },

  // Core functionality
  async sendSelectedItemsToLLM() {
    const items = Zotero.getActiveZoteroPane().getSelectedItems();
    if (!items.length) {
      Zotero.debug("[LLMStudio] No items selected");
      return;
    }

    Zotero.debug(`[LLMStudio] Sending ${items.length} items to LLM Studio`);

    const formattedItems = await Promise.all(
      items.map((item) => this.formatItem(item))
    );

    await this.sendToLLMStudio(formattedItems);
  },

  async formatItem(item) {
    return {
      key: item.key,
      title: item.getField("title") || "No Title",
      itemType: item.itemType,
      creators: item.getCreators().map((c) =>
        `${c.firstName || ""} ${c.lastName || ""}`.trim()
      ),
      date: item.getField("date")?.match(/\d{4}/)?.[0] || "",
      abstract: item.getField("abstractNote") || "",
      url: item.getField("url") || "",
      doi: item.getField("DOI") || "",
      tags: item.getTags().map((t) => t.tag),
      zoteroUrl: `zotero://select/library/items/${item.key}`,
    };
  },

  async sendToLLMStudio(data) {
    const url = `${this.prefs.llmstudioUrl}/v1/chat/completions`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.prefs.model || "local-model",
          messages: [
            {
              role: "user",
              content: JSON.stringify(data, null, 2),
            },
          ],
          max_tokens: this.prefs.maxTokens,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      Zotero.debug("[LLMStudio] LLM response received");

      return result;
    } catch (error) {
      Zotero.debug(`[LLMStudio] Error sending to LLM Studio: ${error}`);
      throw error;
    }
  },

  // Utility methods
  log(message, level = "info") {
    const prefix = "[LLMStudio]";
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
};

// Initialize
Zotero.debug("[LLMStudio] Plugin script loaded");
