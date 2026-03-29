import { db } from "@/lib/db";
import { absences, users } from "@/lib/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { OrgRole } from "@/lib/auth-context";
import { getDataScope } from "../permissions";
import type { ToolDefinition } from "./index";

export const queryAbsencesTool: ToolDefinition = {
  name: "query_absences",
  description:
    "Search absences with filters. Returns absences within a date range, optionally filtered by user or type. Can aggregate by user or type.",
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
      type: {
        type: "string",
        enum: ["vacation", "sick", "training", "remote", "other"],
        description: "Filter by absence type (optional).",
      },
      status: {
        type: "string",
        enum: ["pending", "approved", "rejected"],
        description: "Filter by status (optional).",
      },
      aggregate_by: {
        type: "string",
        enum: ["user", "type", "none"],
        description: "How to aggregate results. Defaults to 'none'.",
      },
    },
    required: ["start_date", "end_date"],
  },
  execute: async (
    params: Record<string, unknown>,
    ctx: { userId: string; organizationId: string; role: OrgRole }
  ) => {
    const { start_date, end_date, user_id, type, status, aggregate_by } =
      params as {
        start_date: string;
        end_date: string;
        user_id?: string;
        type?: string;
        status?: string;
        aggregate_by?: string;
      };

    const scope = getDataScope(ctx.role, "query_absences");

    // We need to join with users to filter by org
    const conditions = [
      gte(absences.date, start_date),
      lte(absences.date, end_date),
      eq(users.currentOrganizationId, ctx.organizationId),
    ];

    if (scope === "self") {
      conditions.push(eq(absences.userId, ctx.userId));
    } else if (user_id) {
      conditions.push(eq(absences.userId, user_id));
    }

    if (type) {
      conditions.push(
        eq(absences.type, type as "vacation" | "sick" | "training" | "remote" | "other")
      );
    }
    if (status) {
      conditions.push(
        eq(absences.status, status as "pending" | "approved" | "rejected")
      );
    }

    if (aggregate_by === "user") {
      const rows = await db
        .select({
          userId: absences.userId,
          userName: users.name,
          totalDays: sql<string>`SUM(CAST(${absences.value} AS DECIMAL))`,
          count: sql<number>`COUNT(*)`,
        })
        .from(absences)
        .innerJoin(users, eq(absences.userId, users.id))
        .where(and(...conditions))
        .groupBy(absences.userId, users.name);

      return { aggregation: "by_user", period: { start_date, end_date }, data: rows };
    }

    if (aggregate_by === "type") {
      const rows = await db
        .select({
          type: absences.type,
          totalDays: sql<string>`SUM(CAST(${absences.value} AS DECIMAL))`,
          count: sql<number>`COUNT(*)`,
        })
        .from(absences)
        .innerJoin(users, eq(absences.userId, users.id))
        .where(and(...conditions))
        .groupBy(absences.type);

      return { aggregation: "by_type", period: { start_date, end_date }, data: rows };
    }

    const rows = await db
      .select({
        id: absences.id,
        date: absences.date,
        value: absences.value,
        type: absences.type,
        status: absences.status,
        note: absences.note,
        userName: users.name,
      })
      .from(absences)
      .innerJoin(users, eq(absences.userId, users.id))
      .where(and(...conditions))
      .orderBy(absences.date)
      .limit(100);

    return { aggregation: "none", period: { start_date, end_date }, count: rows.length, data: rows };
  },
};
