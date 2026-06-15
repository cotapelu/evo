#!/usr/bin/env node
import { main } from "@earendil-works/pi-coding-agent";
import { getExtensionFactories } from "./extensions/index.js";

main(process.argv.slice(2), {
  extensionFactories: getExtensionFactories()
}).catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
