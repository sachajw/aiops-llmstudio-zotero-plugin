/**
 * LLM Studio Zotero Plugin - Bootstrap
 *
 * Based on Zotero's official Make It Red example
 * https://github.com/zotero/make-it-red
 */

var chromeHandle;

function install(data, reason) {
  Zotero.debug("[LLMStudio] Plugin installed");
}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  // Register chrome content
  var aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);

  var manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "llmstudio-zotero", rootURI + "content/"],
  ]);

  // Set up global context for plugin
  const ctx = { rootURI };
  ctx._globalThis = ctx;

  // Load main plugin script
  Services.scriptloader.loadSubScript(
    `${rootURI}/content/scripts/llmstudio-plugin.js`,
    ctx
  );

  // Initialize plugin
  await Zotero.LLMStudio.hooks.onStartup();

  Zotero.debug("[LLMStudio] Plugin started");
}

async function onMainWindowLoad({ window }, reason) {
  await Zotero.LLMStudio?.hooks.onMainWindowLoad(window);
}

async function onMainWindowUnload({ window }, reason) {
  await Zotero.LLMStudio?.hooks.onMainWindowUnload(window);
}

async function shutdown({ id, version, resourceURI, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }

  await Zotero.LLMStudio?.hooks.onShutdown();

  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }

  Zotero.debug("[LLMStudio] Plugin shut down");
}

async function uninstall(data, reason) {
  Zotero.debug("[LLMStudio] Plugin uninstalled");
}
