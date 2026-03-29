import { db } from "@/lib/db";
import { timeEntries, projects, users, clients } from "@/lib/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { OrgRole } from "@/lib/auth-context";
import { getDataScope } from "../permissions";
import type { ToolDefinition } from "./index";

export const queryTimeEntriesTool: ToolDefinition = {
  name: "query_time_entries",
  description:
    "Search time entries with filters. Returns time logged by users on projects within a date range. Can aggregate by user, project, or return raw entries.",
  input_schema: {
    type: "object" as const,
    properties: {
      start_date: {
        type: "string",
        description: "Start date (YYYY-MM-DD). Required.",
      },
      end_date: {
        type: "string",
        description: "End date (YYYY-MM-DD). Required.",
      },
      user_id: {
        type: "string",
        description: "Filter by specific user ID (optional).",
      },
      project_id: {
        type: "string",
        description: "Filter by specific project ID (optional).",
      },
      type: {
        type: "string",
        enum: ["worked", "forecast", "pipeline"],
        description: "Filter by entry type (optional, defaults to all).",
      },
      aggregate_by: {
        type: "string",
        enum: ["user", "project", "none"],
        description:
          "How to aggregate results: 'user' sums by user, 'project' sums by project, 'none' returns raw entries. Defaults to 'none'.",
      },
    },
    required: ["start_date", "end_date"],
  },
  execute: async (
    params: Record<string, unknown>,
    ctx: { userId: string; organizationId: string; role: OrgRole }
  ) => {
    const { start_date, end_date, user_id, project_id, type, aggregate_by } =
      params as {
        start_date: string;
        end_date: string;
        user_id?: string;
        project_id?: string;
        type?: string;
        aggregate_by?: string;
      };

    const scope = getDataScope(ctx.role, "query_time_entries");

    const conditions = [
      eq(projects.organizationId, ctx.organizationId),
      gte(timeEntries.date, start_date),
      lte(timeEntries.date, end_date),
    ];

    // Enforce data scope
    if (scope === "self" || (user_id && user_id === ctx.userId)) {
      conditions.push(eq(timeEntries.userId, ctx.userId));
    } else if (user_id) {
      conditions.push(eq(timeEntries.userId, user_id));
    }

    if (project_id) {
      conditions.push(eq(timeEntries.projectId, project_id));
    }

    if (type) {
      conditions.push(eq(timeEntries.type, type as "worked" | "forecast" | "pipeline"));
    }

    if (aggregate_by === "user") {
      const rows = await db
        .select({
          userId: timeEntries.userId,
          userName: users.name,
          totalDays: sql<string>`SUM(CAST(${timeEntries.value} AS DECIMAL))`,
          entryCount: sql<number>`COUNT(*)`,
        })
        .from(timeEntries)
        .innerJoin(projects, eq(timeEntries.projectId, projects.id))
        .innerJoin(users, eq(timeEntries.userId, users.id))
        .where(and(...conditions))
        .groupBy(timeEntries.userId, users.name);

      return { aggregation: "by_user", period: { start_date, end_date }, data: rows };
    }

    if (aggregate_by === "project") {
      const rows = await db
        .select({
          projectId: timeEntries.projectId,
          projectName: projects.name,
          clientName: clients.name,
          totalDays: sql<string>`SUM(CAST(${timeEntries.value} AS DECIMAL))`,
          entryCount: sql<number>`COUNT(*)`,
        })
        .from(timeEntries)
        .innerJoin(projects, eq(timeEntries.projectId, projects.id))
        .leftJoin(clients, eq(projects.clientId, clients.id))
        .where(and(...conditions))
        .groupBy(timeEntries.projectId, projects.name, clients.name);

      return { aggregation: "by_project", period: { start_date, end_date }, data: rows };
    }

    // Raw entries (limited to 100)
    const rows = await db
      .select({
        date: timeEntries.date,
        value: timeEntries.value,
        type: timeEntries.type,
        note: timeEntries.note,
        userName: users.name,
        projectName: projects.name,
      })
      .from(timeEntries)
      .innerJoin(projects, eq(timeEntries.projectId, projects.id))
      .innerJoin(users, eq(timeEntries.userId, users.id))
      .where(and(...conditions))
      .orderBy(timeEntries.date)
      .limit(100);

    return { aggregation: "none", period: { start_date, end_date }, count: rows.length, data: rows };
  },
};
