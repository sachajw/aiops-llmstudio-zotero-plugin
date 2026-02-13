/**
 * LLM Studio Zotero Plugin - Preferences Script
 *
 * Handles preference pane UI interactions
 */

"use strict";

// Attach to window load event
window.addEventListener("load", () => {
	Zotero.debug("[LMStudio] Preferences window loaded");

	// Initialize UI
	initConnectionTest();
	initProviderPresets();
	initAPIKeyButtons();
	initSecurityToggles();
	initAPIVersionToggles();
});

/**
 * Initialize connection test button
 */
function initConnectionTest() {
	let testBtn = document.getElementById("lmstudio-test-connection-button");
	let resultSpan = document.getElementById("connection-test-result");

	if (!testBtn) return;

	testBtn.addEventListener("command", async () => {
		if (resultSpan) {
			resultSpan.textContent = "Testing...";
			resultSpan.style.color = "#666";
		}

		try {
			let url = document.getElementById("lmstudio-pref-lmstudio-url").value;
			let response = await Zotero.SecurityUtils.secureFetch(`${url}/v1/models`, {
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
 * Initialize API key buttons
 */
function initAPIKeyButtons() {
	let copyBtn = document.getElementById("lmstudio-copy-api-key-button");
	let regenerateBtn = document.getElementById("lmstudio-regenerate-api-key-button");
	let apiKeyInput = document.getElementById("lmstudio-pref-api-key");

	if (copyBtn && apiKeyInput) {
		copyBtn.addEventListener("command", () => {
			let apiKey = apiKeyInput.value;
			if (apiKey) {
				// Copy to clipboard
				Components.classes["@mozilla.org/widget/clipboardhelper;1"]
					.getService(Components.interfaces.nsIClipboardHelper)
					.copyString(apiKey);

				// Show feedback
				let originalLabel = copyBtn.label || copyBtn.textContent;
				copyBtn.label = "Copied!";
				setTimeout(() => {
					copyBtn.label = originalLabel;
				}, 2000);
			}
		});
	}

	if (regenerateBtn && apiKeyInput) {
		regenerateBtn.addEventListener("command", () => {
			// Confirm regeneration
			let promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
				.getService(Components.interfaces.nsIPromptService);

			let confirmed = promptService.confirm(
				window,
				"Regenerate API Key",
				"This will invalidate the current API key. Any external applications using the old key will need to be updated. Continue?"
			);

			if (confirmed) {
				// Generate new API key
				let newKey = Zotero.SecurityUtils.generateAPIKey();
				Zotero.Prefs.set("extensions.zotero.lmstudio-zotero.server.apiKey", newKey, true);

				// Update UI
				apiKeyInput.value = newKey;

				// Show notification
				promptService.alert(
					window,
					"API Key Regenerated",
					"New API key has been generated. Make sure to update any external applications."
				);
			}
		});
	}
}

/**
 * Initialize provider presets
 */
function initProviderPresets() {
	let providerSelect = document.getElementById("lmstudio-pref-provider");
	let urlInput = document.getElementById("lmstudio-pref-lmstudio-url");

	if (!providerSelect || !urlInput) return;

	let presets = {
		"lmstudio": "http://localhost:1234",
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
	let modelInput = document.getElementById("lmstudio-pref-lmstudio-model");
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
		Zotero.debug(`[LMStudio] Available models: ${models.map((m) => m.id).join(", ")}`);
	}
}

/**
 * Export preferences to file
 */
async function exportPreferences() {
	let prefs = {
		server: {
			enabled: Zotero.Prefs.get("extensions.zotero.lmstudio-zotero.server.enabled"),
			port: Zotero.Prefs.get("extensions.zotero.lmstudio-zotero.server.port"),
		},
		lmstudio: {
			url: Zotero.Prefs.get("extensions.zotero.lmstudio-zotero.lmstudio.url"),
			model: Zotero.Prefs.get("extensions.zotero.lmstudio-zotero.lmstudio.model"),
		},
		features: {
			autoSummarize: Zotero.Prefs.get("extensions.zotero.lmstudio-zotero.features.autoSummarize"),
			maxTokens: Zotero.Prefs.get("extensions.zotero.lmstudio-zotero.features.maxTokens"),
		},
	};

	let json = JSON.stringify(prefs, null, 2);

	// Use Zotero's file picker
	let fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
	fp.init(window, "Export Preferences", fp.modeSave);
	fp.appendFilter("JSON Files", "*.json");
	fp.defaultExtension = "json";
	fp.defaultString = "lmstudio-preferences.json";

	let result = await new Promise((resolve) => {
		fp.open(resolve);
	});

	if (result === fp.returnOK || result === fp.returnReplace) {
		let file = fp.file;
		await IOUtils.writeUTF8(file.path, json);
		Zotero.debug(`[LMStudio] Preferences exported to ${file.path}`);
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
				Zotero.Prefs.set("extensions.zotero.lmstudio-zotero.server.enabled", prefs.server.enabled);
			}
			if (prefs.server.port !== undefined) {
				Zotero.Prefs.set("extensions.zotero.lmstudio-zotero.server.port", prefs.server.port);
			}
		}
		if (prefs.lmstudio) {
			if (prefs.lmstudio.url !== undefined) {
				Zotero.Prefs.set("extensions.zotero.lmstudio-zotero.lmstudio.url", prefs.lmstudio.url);
			}
			if (prefs.lmstudio.model !== undefined) {
				Zotero.Prefs.set("extensions.zotero.lmstudio-zotero.lmstudio.model", prefs.lmstudio.model);
			}
		}
		if (prefs.features) {
			if (prefs.features.autoSummarize !== undefined) {
				Zotero.Prefs.set("extensions.zotero.lmstudio-zotero.features.autoSummarize", prefs.features.autoSummarize);
			}
			if (prefs.features.maxTokens !== undefined) {
				Zotero.Prefs.set("extensions.zotero.lmstudio-zotero.features.maxTokens", prefs.features.maxTokens);
			}
		}

		Zotero.debug(`[LMStudio] Preferences imported from ${file.path}`);

		// Refresh UI
		window.location.reload();
	}
}

/**
 * Initialize security toggle controls
 */
function initSecurityToggles() {
	let requireAuthCheckbox = document.getElementById("lmstudio-pref-require-auth");
	let apiKeySection = document.getElementById("lmstudio-api-key-section");

	if (requireAuthCheckbox && apiKeySection) {
		// Update visibility based on current state
		function updateAPIKeyVisibility() {
			let requireAuth = requireAuthCheckbox.checked;
			apiKeySection.style.display = requireAuth ? "" : "none";
		}

		// Set initial state
		updateAPIKeyVisibility();

		// Update when checkbox changes
		requireAuthCheckbox.addEventListener("command", updateAPIKeyVisibility);
	}
}

/**
 * Initialize API version toggle controls
 */
function initAPIVersionToggles() {
	let apiVersionSelect = document.getElementById("lmstudio-pref-api-version");
	let v1FeaturesSection = document.getElementById("lmstudio-v1-features");
	let customEndpointRow = document.getElementById("lmstudio-custom-endpoint-row");

	if (apiVersionSelect) {
		// Update visibility based on current state
		function updateVersionBasedUI() {
			let selectedVersion = apiVersionSelect.value;

			// Show v1 features only for lmstudio-v1
			if (v1FeaturesSection) {
				v1FeaturesSection.style.display = selectedVersion === "lmstudio-v1" ? "" : "none";
			}

			// Show custom endpoint row only for custom
			if (customEndpointRow) {
				customEndpointRow.style.display = selectedVersion === "custom" ? "" : "none";
			}
		}

		// Set initial state
		updateVersionBasedUI();

		// Update when selection changes
		apiVersionSelect.addEventListener("command", updateVersionBasedUI);
	}
}
