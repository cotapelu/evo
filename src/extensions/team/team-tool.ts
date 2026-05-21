#!/usr/bin/env node
/**
 * Simple Team Tool
 *
 * Single tool: team_run
 * Just provide tasks, team size, roles -> team auto-completes
 */

import { bootPiclawTeam, executeTeamTasks, TeamRegistry } from "./team-manager.js";
import type { ToolDefinition, ExtensionAPI } from "@earendil-works/pi-coding-agent";

export function registerTeamTool(api: ExtensionAPI): void {
  api.registerTool(createTeamTool());
}

export function createTeamTool(): ToolDefinition {
  return {
    name: "team_run",
    label: "Team Run",
    description: "Create a team and automatically execute tasks. The team will self-organize and complete all tasks without further intervention.",
    promptSnippet: "Delegates tasks to a self-organizing multi-agent team",
    promptGuidelines: [
      "Use team_run to create and manage agent teams.",
      "To create a new team: provide tasks array, and optionally teamSize and teamRoles. Default: wait=false (non-blocking).",
      "To wait for a team's completion: provide teamId and set wait=true. This blocks until all tasks done.",
      "To check status without waiting: provide teamId only (wait defaults to false).",
      "Tips:",
      "  - Create first: team_run({tasks: [...]}) → returns teamId.",
      "  - Do other work...",
      "  - Then check status: team_run({teamId: '...'}) or wait: team_run({teamId: '...', wait: true}).",
      "  - Progress updates are automatically sent during execution.",
      "  - Teams auto-dispose after wait completion."
    ],
    parameters: {
      type: "object",
      properties: {
        teamId: {
          type: "string",
          description: "ID of an existing team to query or wait for (optional)"
        },
        tasks: {
          type: "array",
          items: { type: "string" },
          description: "List of tasks to be completed by the team (required for new team)"
        },
        teamSize: {
          type: "number",
          description: "Number of agents in the team (default: 2, max: 4)"
        },
        teamRoles: {
          type: "array",
          items: { type: "string" },
          description: "Optional roles for each agent (e.g., ['planner', 'coder', 'reviewer'])"
        },
        wait: {
          type: "boolean",
          description: "If true, block until team completes (only valid with teamId). For new teams, use non-blocking (default)."
        }
      },
      required: []
    },
    async execute(toolCallId: string, params: any, signal: any, onUpdate: any, ctx: any) {
      // Support LLM outputting JSON string or handle call references
      if (typeof params === "string") {
        // Detect call reference pattern (e.g., "call_abc123") which indicates unresolved reference
        if (params.startsWith('call_')) {
          return {
            content: [{ type: "text", text: `❌ Error: team_run expects a JSON object with tasks and optional teamSize. Received a call reference string (${params.substring(0, 20)}...). Call references must be resolved before passing to tools.` }],
            isError: true,
            details: { error: "Unresolved call reference" }
          };
        }
        try {
          params = JSON.parse(params);
        } catch (e: any) {
          return {
            content: [{ type: "text", text: `❌ Error: Invalid JSON string: ${e.message}` }],
            isError: true,
            details: { error: "Invalid JSON" }
          };
        }
      }

      const { teamId, tasks, teamSize, teamRoles, wait } = params as { 
        teamId?: string; 
        tasks?: any; 
        teamSize?: number; 
        teamRoles?: string[]; 
        wait?: boolean 
      };

      // Prepare onUpdate wrapper for message accumulation (used for both new team and query)
      let wrappedOnUpdate: ((update: any) => void) | undefined;
      if (onUpdate) {
        // Accumulate all text messages across updates for complete history
        const messageHistory: Array<{ type: string; text: string }> = [];
        wrappedOnUpdate = (update: any) => {
          if (update.content && Array.isArray(update.content)) {
            for (const block of update.content) {
              if (block.type === 'text') {
                messageHistory.push({ type: 'text', text: block.text });
              }
            }
            onUpdate({
              content: [...messageHistory],
              details: update.details,
              isError: update.isError || false
            });
          }
        };
      } else {
        wrappedOnUpdate = undefined;
      }

      // If teamId is provided, we're querying/waiting on an existing team
      if (teamId) {
        const registry = TeamRegistry.getInstance();
        const team = registry.get(teamId);
        if (!team) {
          return {
            content: [{ type: "text", text: `Error: Team with ID ${teamId} not found` }],
            isError: true,
            details: { error: "Team not found" }
          };
        }

        // Check if wait is requested
        const shouldWait = wait === true;

        if (shouldWait) {
          wrappedOnUpdate?.({
            content: [{ type: "text", text: `⏳ Waiting for team ${teamId} to complete...` }],
            details: { teamId, wait: true }
          });

          // Wait for completion (with timeout)
          const completed = await registry.waitForTeam(teamId, 300000); // 5 min timeout

          if (!completed) {
            return {
              content: [{ type: "text", text: `⏰ Team ${teamId} did not complete within timeout` }],
              details: { teamId, completed: false },
              isError: false
            };
          }

          // Get results
          const results = await team.getResults();
          // Dispose team
          await team.dispose();

          // Format output
          const output = results.map((result: string, idx: number) => {
            const taskPreview = team.tasks[idx]?.length > 50 ? team.tasks[idx].substring(0, 50) + "..." : team.tasks[idx];
            const resultPreview = result.length > 100 ? result.substring(0, 100) + "..." : result;
            return `Task ${idx}: ${taskPreview}\nResult: ${resultPreview || "(empty)"}`;
          }).join("\n\n");

          return {
            content: [{ type: "text", text: `✅ Team ${teamId} completed ${results.length} tasks.\n\n${output}` }],
            details: { teamId, totalTasks: results.length, results },
            isError: false
          };
        } else {
          // Just return current status
          const status = await team.getTeamStatus();
          return {
            content: [{ type: "text", text: `📊 Team ${teamId} status: ${status.completedTasks}/${status.totalTasks} tasks completed, ${status.agents.length} agents` }],
            details: { teamId, status },
            isError: false
          };
        }
      }

      // New team creation
      if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
        return {
          content: [{ type: "text", text: "Error: tasks must be a non-empty array of strings when creating a new team" }],
          isError: true,
          details: { error: "Invalid tasks parameter" }
        };
      }

      try {
        // Get parent runtime from global (set by main.ts)
        const parentRuntime = (globalThis as any).__EVO__RUNTIME__;
        if (!parentRuntime) {
          throw new Error("No runtime context available. Ensure main.ts sets globalThis.__EVO__RUNTIME__");
        }

        // For new team, we want to accumulate onUpdate messages
        if (onUpdate && !wrappedOnUpdate) {
          const messageHistory: Array<{ type: string; text: string }> = [];
          wrappedOnUpdate = ((update: any) => {
            if (update.content && Array.isArray(update.content)) {
              for (const block of update.content) {
                if (block.type === 'text') {
                  messageHistory.push({ type: 'text', text: block.text });
                }
              }
            }
            onUpdate({
              content: [...messageHistory],
              details: update.details,
              isError: update.isError || false
            });
          }) as typeof onUpdate;
        }

        // Send initial update (will be accumulated)
        wrappedOnUpdate?.({
          content: [{ type: "text", text: `🚀 Starting team with ${teamSize || 2} agents for ${tasks.length} tasks` }],
          details: { teamSize, teamRoles, taskCount: tasks.length }
        });

        // Boot team
        const team = await bootPiclawTeam(parentRuntime, {
          teamSize,
          teamRoles
        });

        wrappedOnUpdate?.({
          content: [{ type: "text", text: `✅ Team booted: ${team.roles.join(", ")}` }],
          details: { roles: team.roles, teamId: team.id }
        });

        // Execute tasks NON-BLOCKING (wait: false by default)
        await executeTeamTasks(team, tasks, wrappedOnUpdate, { wait: false });

        // Return immediately with teamId (non-blocking)
        return {
          content: [{ type: "text", text: `✅ Team started: ${team.id}\nAgents: ${team.roles.join(", ")}\nTasks: ${tasks.length}\n\nProgress updates will be shown automatically.\nTo wait for completion, call team_run({teamId: "${team.id}", wait: true}).` }],
          details: {
            teamId: team.id,
            agentCount: team.roles.length,
            totalTasks: tasks.length,
            status: 'running'
          },
          isError: false
        };
      } catch (error: any) {
        // Send error update before returning (use wrappedOnUpdate if available to preserve history)
        const notify = wrappedOnUpdate || onUpdate;
        notify?.({
          content: [{ type: "text", text: `❌ Team execution failed: ${error.message}` }],
          details: { error: error.message, stack: error.stack },
          isError: true
        });
        return {
          content: [{ type: "text", text: `❌ Team execution failed: ${error.message}` }],
          details: { error: error.message, stack: error.stack },
          isError: true
        };
      }
    }
  };
}
