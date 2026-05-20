#!/usr/bin/env node
/**
 * Simple Team Tool
 *
 * Single tool: team_run
 * Just provide tasks, team size, roles -> team auto-completes
 */

import { bootPiclawTeam, executeTeamTasks } from "./team-manager.js";
import type { ToolDefinition, ExtensionAPI } from "@earendil-works/pi-coding-agent";

export function registerTeamTool(api: ExtensionAPI): void {
  api.registerTool(createTeamTool());
}

function createTeamTool(): ToolDefinition {
  return {
    name: "team_run",
    label: "Team Run",
    description: "Create a team and automatically execute tasks. The team will self-organize and complete all tasks without further intervention.",
    promptSnippet: "Delegates tasks to a self-organizing multi-agent team",
    promptGuidelines: [
      "Use team_run when you need to parallelize work across multiple specialized agents.",
      "Provide an array of clear, independent tasks as strings.",
      "Specify teamSize (1-4) based on task complexity. Default is 2.",
      "Optionally provide teamRoles (e.g., ['planner', 'coder', 'reviewer']) to specialize agents.",
      "The team works autonomously - no need to monitor. Results returned after completion.",
      "Tasks should be self-contained and not require heavy coordination between agents.",
      "team_run is blocking - it does not return until all tasks are finished.",
      "Results are returned in the same order as the tasks array.",
      "Note: team_run is called by the main agent to spawn a team of child agents."
    ],
    parameters: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          items: { type: "string" },
          description: "List of tasks to be completed by the team"
        },
        teamSize: {
          type: "number",
          description: "Number of agents in the team (default: 2, max: 4)"
        },
        teamRoles: {
          type: "array",
          items: { type: "string" },
          description: "Optional roles for each agent (e.g., ['planner', 'coder', 'reviewer'])"
        }
      },
      required: ["tasks"]
    },
    async execute(params: any, ctx: any) {
      const { tasks, teamSize, teamRoles } = params;

      if (!Array.isArray(tasks) || tasks.length === 0) {
        return {
          content: [{ type: "text", text: "Error: tasks must be a non-empty array of strings" }],
          isError: true,
          details: { error: "Invalid tasks parameter" }
        };
      }

      try {
        // Get parent runtime from context
        const parentRuntime = ctx.runtime;
        if (!parentRuntime) {
          throw new Error("No runtime context available");
        }

        // Boot team
        const team = await bootPiclawTeam(parentRuntime, {
          teamSize,
          teamRoles
        });

        // Execute tasks (this blocks until all tasks done)
        await executeTeamTasks(team, tasks);

        // Get results
        const results = team.getResults();

        // Dispose team
        await team.dispose();

        // Format output
        const output = results.map((result, idx) => {
          const taskPreview = tasks[idx].length > 50 ? tasks[idx].substring(0, 50) + "..." : tasks[idx];
          const resultPreview = result.length > 100 ? result.substring(0, 100) + "..." : result;
          return `Task ${idx}: ${taskPreview}\nResult: ${resultPreview || "(empty)"}`;
        }).join("\n\n");

        return {
          content: [{ type: "text", text: `✅ Team completed ${tasks.length} tasks.\n\n${output}` }],
          details: {
            totalTasks: tasks.length,
            results: results.map((r, i) => ({ task: tasks[i], result: r }))
          },
          isError: false
        };
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `❌ Team execution failed: ${error.message}` }],
          details: { error: error.message, stack: error.stack },
          isError: true
        };
      }
    }
  };
}
