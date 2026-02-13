# Zotero Plugin Development

_This page is a work in progress._

## Introduction to Zotero Plugins

Zotero plugins run within the Zotero desktop app and interact with Zotero's internal [JavaScript API](https://www.zotero.org/support/dev/client_coding/javascript_api "dev:client_coding:javascript_api") and internal Firefox APIs.

If you plan to write a plugin, you can start by taking a look at the [official sample plugin](https://github.com/zotero/make-it-red "https://github.com/zotero/make-it-red") as well as [existing third-party plugins](https://www.zotero.org/support/plugins "plugins").

## Alternatives to Zotero Plugins

Depending on your use case, it may be easier to create an external tool that uses the [Web API](https://www.zotero.org/support/dev/web_api "dev:web_api") to access Zotero libraries, read from (not write to!) [the Zotero client's SQLite database](https://www.zotero.org/support/dev/client_coding/direct_sqlite_database_access "dev:client_coding:direct_sqlite_database_access"), [run ad hoc JavaScript](https://www.zotero.org/support/dev/client_coding/javascript_api#running_ad_hoc_javascript_in_zotero "dev:client_coding:javascript_api") within Zotero, or interact with [one of the other APIs](https://www.zotero.org/support/dev/client_coding "dev:client_coding") that the Zotero client exposes (e.g., for word processor integration).

The [Zotero Plugins page](https://www.zotero.org/support/plugins "plugins") (which takes an expansive view of the term "plugin") can be very helpful in helping you develop your own Zotero-based tools.

## Setting Up a Plugin Development Environment

When developing a Zotero client plugin, it's helpful to have Zotero run the plugin directly from source. After creating your plugin's source directory with sample code, you can tell Zotero to load the plugin by creating an extension proxy file. (This is a technique that used to be possible for Firefox extension development, though it's since been discontinued in Firefox.)

1. Close Zotero.

2. Create a text file in the 'extensions' directory of your [Zotero profile directory](https://www.zotero.org/support/kb/profile_directory "kb:profile_directory") named after the extension id (e.g., myplugin@mydomain.org). The file contents should be the absolute path to the root of your plugin source code directory, where your install.rdf or bootstrap.js file is located.

3. Open prefs.js in the Zotero profile directory in a text editor and delete the lines containing `extensions.lastAppBuildId` and `extensions.lastAppVersion`. Save the file and restart Zotero. This will force Zotero to read the 'extensions' directory and install your plugin from source, after which you should see it listed in Tools → Add-ons. This is only necessary once.

4. Whenever you make changes to your plugin code, start up Zotero from the command line and pass the `-purgecaches` flag to force Zotero to re-read any cached files. (This may no longer be necessary with Zotero 7.) You'll likely want to make an alias or shell script that also includes the `-ZoteroDebugText` and `-jsconsole` flags and perhaps `-p <Profile>`, where `<Profile>` is the name of a development profile.


### **−** Table of Contents

- [Zotero Plugin Development](https://www.zotero.org/support/dev/client_coding/plugin_development#zotero_plugin_development)

  - [Introduction to Zotero Plugins](https://www.zotero.org/support/dev/client_coding/plugin_development#introduction_to_zotero_plugins)

  - [Alternatives to Zotero Plugins](https://www.zotero.org/support/dev/client_coding/plugin_development#alternatives_to_zotero_plugins)

  - [Setting Up a Plugin Development Environment](https://www.zotero.org/support/dev/client_coding/plugin_development#setting_up_a_plugin_development_environment)

dev/client\_coding/plugin\_development.txt · Last modified: 2023/11/14 03:41 by dstillman

- [Old revisions](https://www.zotero.org/support/dev/client_coding/plugin_development?do=revisions "Old revisions [o]")
