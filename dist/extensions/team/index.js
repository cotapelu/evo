/**
 * Team System - Exports
 *
 * Simple team collaboration: one tool (team_run) that auto-executes tasks.
 */
// Core classes (if needed externally)
export { AgentTeam } from "./team-manager.js";
export { SharedWorkspace } from "./workspace.js";
// Boot functions
export { bootEvoTeam, executeTeamTasks } from "./team-manager.js";
// Tool registration
export { registerTeamTool } from "./team-tool.js";
// Autocomplete registration
export { registerTeamRunAutocomplete } from "./team-autocomplete.js";
//# sourceMappingURL=index.js.map