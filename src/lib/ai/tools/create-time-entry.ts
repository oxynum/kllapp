import { db } from "@/lib/db";
import { timeEntries, projects, projectAssignments } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import type { OrgRole } from "@/lib/auth-context";
import type { ToolDefinition } from "./index";

export const createTimeEntryTool: ToolDefinition = {
  name: "create_time_entry",
  description:
    "Create or update a time entry for the current user. The user must be assigned to the project. Always confirm with the user before calling this tool.",
  input_schema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
        description: "The project ID. Required.",
      },
      date: {
        type: "string",
        description: "Date of the entry (YYYY-MM-DD). Required.",
      },
      value: {
        type: "number",
        description:
          "Number of days (e.g. 0.5 for half day, 1 for full day). Required.",
      },
      type: {
        type: "string",
        enum: ["worked", "forecast"],
        description: "Entry type. Defaults to 'worked'.",
      },
      note: {
        type: "string",
        description: "Optional note for the time entry.",
      },
    },
    required: ["project_id", "date", "value"],
  },
  execute: async (
    params: Record<string, unknown>,
    ctx: { userId: string; organizationId: string; role: OrgRole }
  ) => {
    const { project_id, date, value, type, note } = params as {
      project_id: string;
      date: string;
      value: number;
      type?: string;
      note?: string;
    };

    // Verify project belongs to org
    const [project] = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(
        and(eq(projects.id, project_id), eq(projects.organizationId, ctx.organizationId))
      );

    if (!project) {
      return { error: "Project not found in your organization." };
    }

    // Verify user is assigned to project
    const [assignment] = await db
      .select({ id: projectAssignments.id })
      .from(projectAssignments)
      .where(
        and(
          eq(projectAssignments.projectId, project_id),
          eq(projectAssignments.userId, ctx.userId)
        )
      );

    if (!assignment) {
      return { error: `You are not assigned to project "${project.name}".` };
    }

    // Validate value
    if (value <= 0 || value > 1) {
      return { error: "Value must be between 0 and 1 (0 = 0 days, 1 = 1 full day)." };
    }

    // Upsert time entry
    const [entry] = await db
      .insert(timeEntries)
      .values({
        userId: ctx.userId,
        projectId: project_id,
        date,
        value: value.toString(),
        type: (type as "worked" | "forecast") ?? "worked",
        note: note ?? null,
      })
      .onConflictDoUpdate({
        target: [timeEntries.userId, timeEntries.projectId, timeEntries.date],
        set: {
          value: value.toString(),
          type: (type as "worked" | "forecast") ?? "worked",
          note: note ?? null,
        },
      })
      .returning();

    return {
      success: true,
      message: `Time entry created: ${value} day(s) on "${project.name}" for ${date}.`,
      entry: {
        id: entry.id,
        date: entry.date,
        value: entry.value,
        type: entry.type,
        projectName: project.name,
      },
    };
  },
};
