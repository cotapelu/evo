/**
 * Minimal Team Ops Tool
 *
 * Actions for child agents to collaborate:
 * - Task management: claim_task, release_task, complete_task, get_team_status
 * - Workspace: workspace_read, workspace_write
 * - Messaging: send_message, get_messages
 * - Status: update_status
 */
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { AgentTeam } from "./team-manager.js";
/**
 * Create team_ops tool for child agents
 */
export declare function createTeamOpsTool(team: AgentTeam): ToolDefinition;
//# sourceMappingURL=team-ops-tool.d.ts.map