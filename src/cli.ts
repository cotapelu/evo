#!/usr/bin/env node
import { main } from "@earendil-works/pi-coding-agent";
import registerAllAddon from "./addon/index.js";

const { extensions } = registerAllAddon();

await main(process.argv.slice(2), {
  extensionFactories: extensions
});
