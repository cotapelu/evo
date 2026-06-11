/**
 * Tools Index
 * Re-exports all custom tools for registration
 */

// ES module syntax - TypeScript understands these with moduleResolution: NodeNext
export { registerTodosTool } from "./todos-tool.js";
export { registerMemoryTool } from "./memory-tool.js";

export { registerBranchTool } from "./branch.js";
export { registerSessionInfoTool } from "./session-info.js";
export { registerTestRunnerTool } from "./test-runner.js";
export { registerGitTool } from "./git-tool.js";

export { registerKicadSchTool } from "./kicad-sch.js";
export { registerKicadPcbTool } from "./kicad-pcb.js";

export { registerCodeHealthTool } from "./code-health-tool.js";
export { registerFormatTool } from "./format-tool.js";

export { registerMetricsTool } from "./metrics-tool.js";

export { registerSecurityAuditTool } from "./security-audit-tool.js";
export { registerExtensionTemplateGeneratorTool } from "./extension-template-generator.js";
export { registerWatchTool } from "./watch-tool.js";
export { registerCoverageTool } from "./coverage-tool.js";
export { registerCoverageHistoryTool } from "./coverage-history-tool.js";
export { registerNotesTool } from "./notes-tool.js";
export { registerToolMetricsTool } from "./tool-metrics-tool.js";
export { registerCoverageLeadersTool } from "./coverage-leaders.js";
export { registerPerformanceAdvisorTool } from "./performance-advisor-tool.js";

// From extensions_qclaw
 export { registerUniversalTool } from "./universal-tool.js";
 export { registerAuditTool } from "./audit-tool.js";
 export { registerBuildTool } from "./build-tool.js";
 export { registerFormatterTool } from "./formatter-tool.js";
 export { registerScriptsTool } from "./scripts-tool.js";
 export { registerSecretScannerTool } from "./secret-scanner-tool.js";
 export { registerTestTool } from "./test-tool.js";
 export { registerToolTemplate } from "./tool-template.js";
 export { registerSubToolLoaderExtension } from "./subtool-loader.js";
