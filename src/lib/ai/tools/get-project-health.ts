import { db } from "@/lib/db";
import {
  projects,
  clients,
  timeEntries,
  expenses,
  projectAssignments,
  users,
} from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { OrgRole } from "@/lib/auth-context";
import type { ToolDefinition } from "./index";

export const getProjectHealthTool: ToolDefinition = {
  name: "get_project_health",
  description:
    "Get health metrics for a project: total days worked, budget consumed, team size, expenses, and status indicators. Managers and admins only.",
  input_schema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
        description: "The project ID. Required.",
      },
    },
    required: ["project_id"],
  },
  execute: async (
    params: Record<string, unknown>,
    ctx: { userId: string; organizationId: string; role: OrgRole }
  ) => {
    const { project_id } = params as { project_id: string };

    // Get project info
    const [project] = await db
      .select({
        id: projects.id,
        name: projects.name,
        clientName: clients.name,
        type: projects.type,
        status: projects.status,
        dailyRate: projects.dailyRate,
        fixedPrice: projects.fixedPrice,
        budget: projects.budget,
        billable: projects.billable,
        startDate: projects.startDate,
        endDate: projects.endDate,
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(
        and(eq(projects.id, project_id), eq(projects.organizationId, ctx.organizationId))
      );

    if (!project) {
      return { error: "Project not found or not in your organization." };
    }

    // Total days worked
    const [timeAgg] = await db
      .select({
        totalDays: sql<string>`COALESCE(SUM(CAST(${timeEntries.value} AS DECIMAL)), 0)`,
        workedDays: sql<string>`COALESCE(SUM(CASE WHEN ${timeEntries.type} = 'worked' THEN CAST(${timeEntries.value} AS DECIMAL) ELSE 0 END), 0)`,
        forecastDays: sql<string>`COALESCE(SUM(CASE WHEN ${timeEntries.type} = 'forecast' THEN CAST(${timeEntries.value} AS DECIMAL) ELSE 0 END), 0)`,
      })
      .from(timeEntries)
      .where(eq(timeEntries.projectId, project_id));

    // Total expenses
    const [expenseAgg] = await db
      .select({
        totalExpenses: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
        expenseCount: sql<number>`COUNT(*)`,
      })
      .from(expenses)
      .where(eq(expenses.projectId, project_id));

    // Team members
    const team = await db
      .select({
        userName: users.name,
        dailyRate: projectAssignments.dailyRate,
        dailyCost: projectAssignments.dailyCost,
      })
      .from(projectAssignments)
      .innerJoin(users, eq(projectAssignments.userId, users.id))
      .where(eq(projectAssignments.projectId, project_id));

    const workedDays = parseFloat(timeAgg.workedDays);
    const forecastDays = parseFloat(timeAgg.forecastDays);
    const totalExpenses = parseFloat(expenseAgg.totalExpenses);
    const budget = project.budget ? parseFloat(project.budget) : null;
    const dailyRate = project.dailyRate ? parseFloat(project.dailyRate) : null;

    // Compute revenue and cost estimates
    const estimatedRevenue = dailyRate ? workedDays * dailyRate : null;
    const budgetConsumedPct =
      budget && budget > 0
        ? Math.round(((workedDays * (dailyRate ?? 0) + totalExpenses) / budget) * 100)
        : null;

    // Health indicators
    const indicators: string[] = [];
    if (budgetConsumedPct !== null && budgetConsumedPct > 90) {
      indicators.push("CRITICAL: Budget consumed > 90%");
    } else if (budgetConsumedPct !== null && budgetConsumedPct > 75) {
      indicators.push("WARNING: Budget consumed > 75%");
    }
    if (project.endDate) {
      const daysToEnd = Math.ceil(
        (new Date(project.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysToEnd < 0) {
        indicators.push("OVERDUE: Project past end date");
      } else if (daysToEnd < 14) {
        indicators.push(`ATTENTION: ${daysToEnd} days until end date`);
      }
    }

    return {
      project: {
        name: project.name,
        client: project.clientName,
        status: project.status,
        type: project.type,
        billable: project.billable,
        startDate: project.startDate,
        endDate: project.endDate,
      },
      metrics: {
        workedDays,
        forecastDays,
        totalExpenses: `${totalExpenses.toFixed(2)}€`,
        estimatedRevenue: estimatedRevenue ? `${estimatedRevenue.toFixed(2)}€` : null,
        budget: budget ? `${budget.toFixed(2)}€` : null,
        budgetConsumedPct: budgetConsumedPct !== null ? `${budgetConsumedPct}%` : null,
        teamSize: team.length,
      },
      team: team.map((t) => ({
        name: t.userName,
        dailyRate: t.dailyRate,
        dailyCost: t.dailyCost,
      })),
      healthIndicators: indicators,
    };
  },
};
