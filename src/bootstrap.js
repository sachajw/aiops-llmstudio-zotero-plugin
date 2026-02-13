/**
 * LLM Studio Zotero Plugin - Bootstrap
 *
 * Based on Zotero's official patterns from zotero/source
 * https://github.com/zotero/zotero
 */

// Reason constants (from Zotero's plugins.js)
const APP_STARTUP = 1;
const APP_SHUTDOWN = 2;
const ADDON_ENABLE = 3;
const ADDON_DISABLE = 4;
const ADDON_INSTALL = 5;
const ADDON_UNINSTALL = 6;
const ADDON_UPGRADE = 7;
const ADDON_DOWNGRADE = 8;

var chromeHandle;
var resourceHandle;

/**
 * Called when the plugin is installed
 */
function install(data, reason) {
	Zotero.debug("[LLMStudio] Plugin installed");
}

/**
 * Called when the plugin starts up (app startup, enable, install, upgrade)
 */
async function startup({ id, version, resourceURI, rootURI }, reason) {
	Zotero.debug(`[LLMStudio] Starting up (reason: ${reason})`);

	// Register chrome content using AddonManager API
	let aomStartup = Components.classes[
		"@mozilla.org/addons/addon-manager-startup;1"
	].getService(Components.interfaces.amIAddonManagerStartup);

	let manifestURI = Services.io.newURI(rootURI + "manifest.json");

	// Register content, locale, and resource
	chromeHandle = aomStartup.registerChrome(manifestURI, [
		["content", "llmstudio-zotero", rootURI + "content/"],
		["locale", "llmstudio-zotero", "en-US", rootURI + "locale/en-US/"],
		["resource", "llmstudio-zotero", rootURI + "resource/"],
	]);

	// Create plugin context with exposed globals
	let ctx = {
		rootURI,
		pluginID: id,
		// Expose commonly needed globals
		Zotero,
		Services,
		Components,
		ChromeUtils,
		IOUtils,
		PathUtils,
		_globalThis: null,
	};
	ctx._globalThis = ctx;

	// Load main plugin script
	Services.scriptloader.loadSubScript(
		`${rootURI}content/scripts/llmstudio-plugin.js`,
		ctx
	);

	// Wait for Zotero to be ready before initializing
	await Zotero.initializationPromise;

	// Initialize plugin
	await Zotero.LLMStudio.hooks.onStartup();

	Zotero.debug("[LLMStudio] Plugin started successfully");
}

/**
 * Called when a main Zotero window loads
 */
async function onMainWindowLoad({ window }, reason) {
	Zotero.debug("[LLMStudio] Main window loading");
	await Zotero.LLMStudio?.hooks.onMainWindowLoad(window);
}

/**
 * Called when a main Zotero window unloads
 */
async function onMainWindowUnload({ window }, reason) {
	Zotero.debug("[LLMStudio] Main window unloading");
	await Zotero.LLMStudio?.hooks.onMainWindowUnload(window);
}

/**
 * Called when the plugin shuts down (app shutdown, disable, uninstall, upgrade)
 */
async function shutdown({ id, version, resourceURI, rootURI }, reason) {
	// Don't bother cleaning up on app shutdown
	if (reason === APP_SHUTDOWN) {
		return;
	}

	Zotero.debug(`[LLMStudio] Shutting down (reason: ${reason})`);

	// Let plugin clean up
	if (Zotero.LLMStudio) {
		await Zotero.LLMStudio.hooks.onShutdown();
	}

	// Deregister chrome
	if (chromeHandle) {
		chromeHandle.destruct();
		chromeHandle = null;
	}

	Zotero.debug("[LLMStudio] Plugin shut down");
}

/**
 * Called when the plugin is uninstalled
 */
async function uninstall(data, reason) {
	Zotero.debug("[LLMStudio] Plugin uninstalled");

	// Clean up preferences on uninstall
	if (reason === ADDON_UNINSTALL) {
		let branch = Services.prefs.getBranch("extensions.zotero.llmstudio-zotero.");
		if (branch) {
			branch.deleteBranch("");
		}
	}
}
