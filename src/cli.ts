#!/usr/bin/env node
import { main } from "@earendil-works/pi-coding-agent";
import { extensionFactories } from "./plugin/extensions/index.js";

await main(process.argv.slice(2), { extensionFactories });
