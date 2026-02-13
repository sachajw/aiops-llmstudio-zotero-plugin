/**
 * LLM Studio Zotero Plugin - Preferences Script
 *
 * Handles preference pane UI interactions
 */

"use strict";

// Attach to window load event
window.addEventListener("load", () => {
	Zotero.debug("[LLMStudio] Preferences window loaded");

	// Initialize UI
	initConnectionTest();
	initProviderPresets();
});

/**
 * Initialize connection test button
 */
function initConnectionTest() {
	let testBtn = document.getElementById("llmstudio-test-connection-button");
	let resultSpan = document.getElementById("connection-test-result");

	if (!testBtn) return;

	testBtn.addEventListener("command", async () => {
		if (resultSpan) {
			resultSpan.textContent = "Testing...";
			resultSpan.style.color = "#666";
		}

		try {
			let url = document.getElementById("llmstudio-pref-llmstudio-url").value;
			let response = await fetch(`${url}/v1/models`, {
				method: "GET",
				headers: { "Content-Type": "application/json" },
			});

			if (response.ok) {
				let data = await response.json();

				if (resultSpan) {
					resultSpan.textContent = `✓ Connected (${data.data?.length || 0} models)`;
					resultSpan.style.color = "green";
				}

				// Populate model dropdown if available
				populateModelDropdown(data.data);
			}
			else {
				throw new Error(`HTTP ${response.status}`);
			}
		}
		catch (e) {
			if (resultSpan) {
				resultSpan.textContent = `✗ Failed: ${e.message}`;
				resultSpan.style.color = "red";
			}
		}
	});
}

/**
 * Initialize provider presets
 */
function initProviderPresets() {
	let providerSelect = document.getElementById("llmstudio-pref-provider");
	let urlInput = document.getElementById("llmstudio-pref-llmstudio-url");

	if (!providerSelect || !urlInput) return;

	let presets = {
		"llmstudio": "http://localhost:1234",
		"ollama": "http://localhost:11434/v1",
		"openai": "https://api.openai.com/v1",
		"anthropic": "https://api.anthropic.com/v1",
		"custom": "",
	};

	providerSelect.addEventListener("command", () => {
		let selected = providerSelect.value;
		if (presets[selected]) {
			urlInput.value = presets[selected];
			// Trigger change event
			urlInput.dispatchEvent(new Event("change", { bubbles: true }));
		}
	});
}

/**
 * Populate model dropdown from API response
 */
function populateModelDropdown(models) {
	let modelInput = document.getElementById("llmstudio-pref-llmstudio-model");
	if (!modelInput || !models) return;

	// If it's a select element, populate options
	if (modelInput.tagName === "SELECT") {
		modelInput.innerHTML = '<option value="">Default</option>';
		for (let model of models) {
			let option = document.createElement("option");
			option.value = model.id;
			option.textContent = model.id;
			modelInput.appendChild(option);
		}
	}
	// If it's an input, just set a datalist or show first model
	else if (models.length > 0) {
		// Could create a datalist here
		Zotero.debug(`[LLMStudio] Available models: ${models.map((m) => m.id).join(", ")}`);
	}
}

/**
 * Export preferences to file
 */
async function exportPreferences() {
	let prefs = {
		server: {
			enabled: Zotero.Prefs.get("extensions.zotero.llmstudio-zotero.server.enabled"),
			port: Zotero.Prefs.get("extensions.zotero.llmstudio-zotero.server.port"),
		},
		llmstudio: {
			url: Zotero.Prefs.get("extensions.zotero.llmstudio-zotero.llmstudio.url"),
			model: Zotero.Prefs.get("extensions.zotero.llmstudio-zotero.llmstudio.model"),
		},
		features: {
			autoSummarize: Zotero.Prefs.get("extensions.zotero.llmstudio-zotero.features.autoSummarize"),
			maxTokens: Zotero.Prefs.get("extensions.zotero.llmstudio-zotero.features.maxTokens"),
		},
	};

	let json = JSON.stringify(prefs, null, 2);

	// Use Zotero's file picker
	let fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
	fp.init(window, "Export Preferences", fp.modeSave);
	fp.appendFilter("JSON Files", "*.json");
	fp.defaultExtension = "json";
	fp.defaultString = "llmstudio-preferences.json";

	let result = await new Promise((resolve) => {
		fp.open(resolve);
	});

	if (result === fp.returnOK || result === fp.returnReplace) {
		let file = fp.file;
		await IOUtils.writeUTF8(file.path, json);
		Zotero.debug(`[LLMStudio] Preferences exported to ${file.path}`);
	}
}

/**
 * Import preferences from file
 */
async function importPreferences() {
	let fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
	fp.init(window, "Import Preferences", fp.modeOpen);
	fp.appendFilter("JSON Files", "*.json");

	let result = await new Promise((resolve) => {
		fp.open(resolve);
	});

	if (result === fp.returnOK) {
		let file = fp.file;
		let json = await IOUtils.readUTF8(file.path);
		let prefs = JSON.parse(json);

		// Apply preferences
		if (prefs.server) {
			if (prefs.server.enabled !== undefined) {
				Zotero.Prefs.set("extensions.zotero.llmstudio-zotero.server.enabled", prefs.server.enabled);
			}
			if (prefs.server.port !== undefined) {
				Zotero.Prefs.set("extensions.zotero.llmstudio-zotero.server.port", prefs.server.port);
			}
		}
		if (prefs.llmstudio) {
			if (prefs.llmstudio.url !== undefined) {
				Zotero.Prefs.set("extensions.zotero.llmstudio-zotero.llmstudio.url", prefs.llmstudio.url);
			}
			if (prefs.llmstudio.model !== undefined) {
				Zotero.Prefs.set("extensions.zotero.llmstudio-zotero.llmstudio.model", prefs.llmstudio.model);
			}
		}
		if (prefs.features) {
			if (prefs.features.autoSummarize !== undefined) {
				Zotero.Prefs.set("extensions.zotero.llmstudio-zotero.features.autoSummarize", prefs.features.autoSummarize);
			}
			if (prefs.features.maxTokens !== undefined) {
				Zotero.Prefs.set("extensions.zotero.llmstudio-zotero.features.maxTokens", prefs.features.maxTokens);
			}
		}

		Zotero.debug(`[LLMStudio] Preferences imported from ${file.path}`);

		// Refresh UI
		window.location.reload();
	}
}
