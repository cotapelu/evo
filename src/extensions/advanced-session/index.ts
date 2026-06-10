#!/usr/bin/env node

import { registerSessionManagerTool } from "./session-manager-tool.js";

export default function advancedSessionExtension(api: any): void {
  registerSessionManagerTool(api);
}

export { advancedSessionExtension };
