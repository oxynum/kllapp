import type { OrgRole } from "@/lib/auth-context";
import { canUseTool } from "../permissions";
import { queryTimeEntriesTool } from "./query-time-entries";
import { queryExpensesTool } from "./query-expenses";
import { queryProjectsTool } from "./query-projects";
import { queryAbsencesTool } from "./query-absences";
import { getAvailabilityTool } from "./get-availability";
import { getProjectHealthTool } from "./get-project-health";
import { computeProfitabilityTool } from "./compute-profitability";
import { createTimeEntryTool } from "./create-time-entry";
import { createExpenseTool } from "./create-expense";
import { getCalendarEventsTool } from "./get-calendar-events";

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (
    params: Record<string, unknown>,
    ctx: { userId: string; organizationId: string; role: OrgRole }
  ) => Promise<unknown>;
}

const ALL_TOOLS: ToolDefinition[] = [
  queryTimeEntriesTool,
  queryExpensesTool,
  queryProjectsTool,
  queryAbsencesTool,
  getAvailabilityTool,
  getProjectHealthTool,
  computeProfitabilityTool,
  createTimeEntryTool,
  createExpenseTool,
  getCalendarEventsTool,
];

const toolMap = new Map(ALL_TOOLS.map((t) => [t.name, t]));

/**
 * Returns the tool definitions available for a given role,
 * formatted for the Claude API tool_use parameter.
 */
export function getToolDefinitions(role: OrgRole) {
  return ALL_TOOLS.filter((t) => canUseTool(role, t.name)).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}

/**
 * Execute a tool by name with the given parameters and context.
 */
export async function executeTool(
  toolName: string,
  params: Record<string, unknown>,
  ctx: { userId: string; organizationId: string; role: OrgRole }
): Promise<unknown> {
  if (!canUseTool(ctx.role, toolName)) {
    return { error: `You don't have permission to use the tool "${toolName}".` };
  }

  const tool = toolMap.get(toolName);
  if (!tool) {
    return { error: `Unknown tool: ${toolName}` };
  }

  try {
    return await tool.execute(params, ctx);
  } catch (err) {
    console.error(`[ai-tool] ${toolName} failed:`, err);
    return {
      error: `Tool execution failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}
