import { db } from "@/lib/db";
import {
  users,
  timeEntries,
  absences,
  projectAssignments,
  projects,
  organizationMembers,
} from "@/lib/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { OrgRole } from "@/lib/auth-context";
import type { ToolDefinition } from "./index";

export const getAvailabilityTool: ToolDefinition = {
  name: "get_user_availability",
  description:
    "Get availability of one or more team members for a date range. Shows how many days are worked, on absence, and remaining capacity. Managers and admins only.",
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
        description:
          "Specific user ID. If omitted, returns availability for all active org members.",
      },
    },
    required: ["start_date", "end_date"],
  },
  execute: async (
    params: Record<string, unknown>,
    ctx: { userId: string; organizationId: string; role: OrgRole }
  ) => {
    const { start_date, end_date, user_id } = params as {
      start_date: string;
      end_date: string;
      user_id?: string;
    };

    // Get target users
    let targetUsers: { id: string; name: string | null; hoursPerDay: string | null }[];

    if (user_id) {
      targetUsers = await db
        .select({ id: users.id, name: users.name, hoursPerDay: users.hoursPerDay })
        .from(users)
        .where(eq(users.id, user_id));
    } else {
      targetUsers = await db
        .select({ id: users.id, name: users.name, hoursPerDay: users.hoursPerDay })
        .from(users)
        .innerJoin(
          organizationMembers,
          and(
            eq(organizationMembers.userId, users.id),
            eq(organizationMembers.organizationId, ctx.organizationId),
            eq(organizationMembers.status, "active")
          )
        );
    }

    if (targetUsers.length === 0) {
      return { data: [], message: "No users found." };
    }

    const userIds = targetUsers.map((u) => u.id);

    // Count working days in range (exclude weekends)
    const start = new Date(start_date);
    const end = new Date(end_date);
    let workingDays = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0 && d.getDay() !== 6) workingDays++;
    }

    // Get time entries aggregated by user
    const timeData = await db
      .select({
        userId: timeEntries.userId,
        totalDays: sql<string>`SUM(CAST(${timeEntries.value} AS DECIMAL))`,
      })
      .from(timeEntries)
      .innerJoin(projects, eq(timeEntries.projectId, projects.id))
      .where(
        and(
          eq(projects.organizationId, ctx.organizationId),
          gte(timeEntries.date, start_date),
          lte(timeEntries.date, end_date),
          eq(timeEntries.type, "worked"),
          sql`${timeEntries.userId} IN (${sql.join(
            userIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        )
      )
      .groupBy(timeEntries.userId);

    // Get absences aggregated by user
    const absenceData = await db
      .select({
        userId: absences.userId,
        totalDays: sql<string>`SUM(CAST(${absences.value} AS DECIMAL))`,
      })
      .from(absences)
      .where(
        and(
          gte(absences.date, start_date),
          lte(absences.date, end_date),
          eq(absences.status, "approved"),
          sql`${absences.userId} IN (${sql.join(
            userIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        )
      )
      .groupBy(absences.userId);

    const timeMap = new Map(timeData.map((t) => [t.userId, parseFloat(t.totalDays)]));
    const absenceMap = new Map(absenceData.map((a) => [a.userId, parseFloat(a.totalDays)]));

    const data = targetUsers.map((u) => {
      const workedDays = timeMap.get(u.id) ?? 0;
      const absenceDays = absenceMap.get(u.id) ?? 0;
      const availableDays = Math.max(0, workingDays - workedDays - absenceDays);
      const occupationRate =
        workingDays > 0 ? Math.round(((workedDays + absenceDays) / workingDays) * 100) : 0;

      return {
        userId: u.id,
        userName: u.name,
        workingDays,
        workedDays,
        absenceDays,
        availableDays,
        occupationRate: `${occupationRate}%`,
      };
    });

    return {
      period: { start_date, end_date, working_days: workingDays },
      data,
    };
  },
};
