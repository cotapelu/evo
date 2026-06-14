#!/usr/bin/env node
import { main as upstreamMain } from "@earendil-works/pi-coding-agent";
import { getExtensionFactories } from "./extensions/index.js";

async function main() {
  const args = process.argv.slice(2);

  await upstreamMain(args, {
    extensionFactories: getExtensionFactories()
  });
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
