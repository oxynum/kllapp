import { db } from "@/lib/db";
import {
  projects,
  clients,
  timeEntries,
  expenses,
  projectAssignments,
} from "@/lib/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { OrgRole } from "@/lib/auth-context";
import type { ToolDefinition } from "./index";

export const computeProfitabilityTool: ToolDefinition = {
  name: "compute_profitability",
  description:
    "Compute profitability for projects or clients over a period. Calculates revenue (days * daily rate), costs (days * daily cost + expenses), and margin. Admin only.",
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
      project_id: {
        type: "string",
        description: "Compute for a specific project (optional).",
      },
      client_id: {
        type: "string",
        description: "Compute for all projects of a specific client (optional).",
      },
    },
    required: ["start_date", "end_date"],
  },
  execute: async (
    params: Record<string, unknown>,
    ctx: { userId: string; organizationId: string; role: OrgRole }
  ) => {
    const { start_date, end_date, project_id, client_id } = params as {
      start_date: string;
      end_date: string;
      project_id?: string;
      client_id?: string;
    };

    const projectConditions = [eq(projects.organizationId, ctx.organizationId)];
    if (project_id) projectConditions.push(eq(projects.id, project_id));
    if (client_id) projectConditions.push(eq(projects.clientId, client_id));

    // Get all relevant projects
    const relevantProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        clientName: clients.name,
        dailyRate: projects.dailyRate,
        billable: projects.billable,
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(and(...projectConditions));

    if (relevantProjects.length === 0) {
      return { data: [], message: "No projects found matching criteria." };
    }

    const projectIds = relevantProjects.map((p) => p.id);
    const inProjects = sql`${timeEntries.projectId} IN (${sql.join(
      projectIds.map((id) => sql`${id}`),
      sql`, `
    )})`;

    // Revenue: time entries * project daily rate
    const revenueData = await db
      .select({
        projectId: timeEntries.projectId,
        totalDays: sql<string>`SUM(CAST(${timeEntries.value} AS DECIMAL))`,
      })
      .from(timeEntries)
      .where(
        and(
          inProjects,
          eq(timeEntries.type, "worked"),
          gte(timeEntries.date, start_date),
          lte(timeEntries.date, end_date)
        )
      )
      .groupBy(timeEntries.projectId);

    // Cost: time entries * assignment daily cost
    const costData = await db
      .select({
        projectId: timeEntries.projectId,
        totalCost: sql<string>`SUM(CAST(${timeEntries.value} AS DECIMAL) * COALESCE(CAST(${projectAssignments.dailyCost} AS DECIMAL), 0))`,
      })
      .from(timeEntries)
      .leftJoin(
        projectAssignments,
        and(
          eq(timeEntries.projectId, projectAssignments.projectId),
          eq(timeEntries.userId, projectAssignments.userId)
        )
      )
      .where(
        and(
          inProjects,
          eq(timeEntries.type, "worked"),
          gte(timeEntries.date, start_date),
          lte(timeEntries.date, end_date)
        )
      )
      .groupBy(timeEntries.projectId);

    // Expenses per project
    const inExpenseProjects = sql`${expenses.projectId} IN (${sql.join(
      projectIds.map((id) => sql`${id}`),
      sql`, `
    )})`;
    const expenseData = await db
      .select({
        projectId: expenses.projectId,
        totalExpenses: sql<string>`SUM(CAST(${expenses.amount} AS DECIMAL))`,
      })
      .from(expenses)
      .where(
        and(
          inExpenseProjects,
          gte(expenses.date, start_date),
          lte(expenses.date, end_date)
        )
      )
      .groupBy(expenses.projectId);

    const revenueMap = new Map(revenueData.map((r) => [r.projectId, parseFloat(r.totalDays)]));
    const costMap = new Map(costData.map((c) => [c.projectId, parseFloat(c.totalCost)]));
    const expenseMap = new Map(
      expenseData.map((e) => [e.projectId, parseFloat(e.totalExpenses)])
    );

    let totalRevenue = 0;
    let totalCost = 0;
    let totalExpenses = 0;

    const data = relevantProjects.map((p) => {
      const days = revenueMap.get(p.id) ?? 0;
      const rate = p.dailyRate ? parseFloat(p.dailyRate) : 0;
      const revenue = p.billable ? days * rate : 0;
      const laborCost = costMap.get(p.id) ?? 0;
      const projectExpenses = expenseMap.get(p.id) ?? 0;
      const totalProjectCost = laborCost + projectExpenses;
      const margin = revenue - totalProjectCost;
      const marginPct = revenue > 0 ? Math.round((margin / revenue) * 100) : 0;

      totalRevenue += revenue;
      totalCost += totalProjectCost;
      totalExpenses += projectExpenses;

      return {
        projectName: p.name,
        client: p.clientName,
        daysWorked: days,
        revenue: `${revenue.toFixed(2)}€`,
        laborCost: `${laborCost.toFixed(2)}€`,
        expenses: `${projectExpenses.toFixed(2)}€`,
        totalCost: `${totalProjectCost.toFixed(2)}€`,
        margin: `${margin.toFixed(2)}€`,
        marginPct: `${marginPct}%`,
      };
    });

    const overallMargin = totalRevenue - totalCost;
    const overallMarginPct =
      totalRevenue > 0 ? Math.round((overallMargin / totalRevenue) * 100) : 0;

    return {
      period: { start_date, end_date },
      summary: {
        totalRevenue: `${totalRevenue.toFixed(2)}€`,
        totalCost: `${totalCost.toFixed(2)}€`,
        totalExpenses: `${totalExpenses.toFixed(2)}€`,
        overallMargin: `${overallMargin.toFixed(2)}€`,
        overallMarginPct: `${overallMarginPct}%`,
      },
      projects: data,
    };
  },
};
