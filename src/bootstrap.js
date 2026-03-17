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

/**
 * Called when the plugin is installed
 */
function install(data, reason) {}

/**
 * Called when the plugin starts up (app startup, enable, install, upgrade)
 */
async function startup({ id, version, resourceURI, rootURI }, reason) {
	// Register chrome content using AddonManager API
	var aomStartup = Components.classes[
		"@mozilla.org/addons/addon-manager-startup;1"
	].getService(Components.interfaces.amIAddonManagerStartup);

	var manifestURI = Services.io.newURI(rootURI + "manifest.json");

	// Register content, locale, and resource
	chromeHandle = aomStartup.registerChrome(manifestURI, [
		["content", "lmstudio-zotero", rootURI + "content/"],
		["locale", "lmstudio-zotero", "en-US", rootURI + "locale/en-US/"],
	]);

	// Create plugin context with exposed globals
	const ctx = { rootURI, pluginID: id };
	ctx._globalThis = ctx;

	// Load security utilities first
	Services.scriptloader.loadSubScript(
		`${rootURI}content/scripts/security-utils.js`,
		ctx
	);

	// Load main plugin script
	Services.scriptloader.loadSubScript(
		`${rootURI}content/scripts/lmstudio-plugin.js`,
		ctx
	);

	// Initialize plugin
	try {
		await Zotero.LMStudio.hooks.onStartup();
	} catch (e) {
		Components.utils.reportError(`[LMStudio] Failed to initialize: ${e}\n${e.stack}`);
	}
}

/**
 * Called when a main Zotero window loads
 */
async function onMainWindowLoad({ window }, reason) {
	await Zotero.LMStudio?.hooks.onMainWindowLoad(window);
}

/**
 * Called when a main Zotero window unloads
 */
async function onMainWindowUnload({ window }, reason) {
	await Zotero.LMStudio?.hooks.onMainWindowUnload(window);
}

/**
 * Called when the plugin shuts down (app shutdown, disable, uninstall, upgrade)
 */
async function shutdown({ id, version, resourceURI, rootURI }, reason) {
	// Don't bother cleaning up on app shutdown
	if (reason === APP_SHUTDOWN) {
		return;
	}

	// Let plugin clean up
	if (Zotero.LMStudio) {
		await Zotero.LMStudio.hooks.onShutdown();
	}

	// Deregister chrome
	if (chromeHandle) {
		chromeHandle.destruct();
		chromeHandle = null;
	}
}

/**
 * Called when the plugin is uninstalled
 */
async function uninstall(data, reason) {
	// Clean up preferences on uninstall
	if (reason === ADDON_UNINSTALL) {
		let branch = Services.prefs.getBranch("extensions.zotero.lmstudio-zotero.");
		if (branch) {
			branch.deleteBranch("");
		}
	}
}
