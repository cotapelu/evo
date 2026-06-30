#!/usr/bin/env node
import { main } from "@earendil-works/pi-coding-agent";
import { getExtensionFactories } from "./plugin/index.js";
import registerAllAddon from "./addon/index.js";

const pluginFactories = getExtensionFactories();
const { extensions: addonExtensions } = registerAllAddon(process.cwd());

await main(process.argv.slice(2), {
  extensionFactories: [...pluginFactories, ...addonExtensions]
});
