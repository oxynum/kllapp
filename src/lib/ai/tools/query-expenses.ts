import { db } from "@/lib/db";
import { expenses, expenseCategories, projects } from "@/lib/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { OrgRole } from "@/lib/auth-context";
import { getDataScope } from "../permissions";
import type { ToolDefinition } from "./index";

export const queryExpensesTool: ToolDefinition = {
  name: "query_expenses",
  description:
    "Search expenses with filters. Returns expenses within a date range, optionally filtered by project or category. Can aggregate by category or project.",
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
        description: "Filter by specific project ID (optional).",
      },
      category_name: {
        type: "string",
        description: "Filter by category name (optional).",
      },
      aggregate_by: {
        type: "string",
        enum: ["category", "project", "none"],
        description: "How to aggregate results. Defaults to 'none'.",
      },
    },
    required: ["start_date", "end_date"],
  },
  execute: async (
    params: Record<string, unknown>,
    ctx: { userId: string; organizationId: string; role: OrgRole }
  ) => {
    const { start_date, end_date, project_id, category_name, aggregate_by } =
      params as {
        start_date: string;
        end_date: string;
        project_id?: string;
        category_name?: string;
        aggregate_by?: string;
      };

    const scope = getDataScope(ctx.role, "query_expenses");

    const conditions = [
      eq(expenses.organizationId, ctx.organizationId),
      gte(expenses.date, start_date),
      lte(expenses.date, end_date),
    ];

    if (scope === "self") {
      conditions.push(eq(expenses.userId, ctx.userId));
    }

    if (project_id) {
      conditions.push(eq(expenses.projectId, project_id));
    }

    if (category_name) {
      conditions.push(eq(expenseCategories.name, category_name));
    }

    if (aggregate_by === "category") {
      const rows = await db
        .select({
          categoryName: expenseCategories.name,
          totalAmount: sql<string>`SUM(CAST(${expenses.amount} AS DECIMAL))`,
          count: sql<number>`COUNT(*)`,
        })
        .from(expenses)
        .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
        .where(and(...conditions))
        .groupBy(expenseCategories.name);

      return { aggregation: "by_category", period: { start_date, end_date }, data: rows };
    }

    if (aggregate_by === "project") {
      const rows = await db
        .select({
          projectId: expenses.projectId,
          projectName: projects.name,
          totalAmount: sql<string>`SUM(CAST(${expenses.amount} AS DECIMAL))`,
          count: sql<number>`COUNT(*)`,
        })
        .from(expenses)
        .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
        .leftJoin(projects, eq(expenses.projectId, projects.id))
        .where(and(...conditions))
        .groupBy(expenses.projectId, projects.name);

      return { aggregation: "by_project", period: { start_date, end_date }, data: rows };
    }

    const rows = await db
      .select({
        id: expenses.id,
        date: expenses.date,
        amount: expenses.amount,
        description: expenses.description,
        categoryName: expenseCategories.name,
        projectName: projects.name,
      })
      .from(expenses)
      .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .leftJoin(projects, eq(expenses.projectId, projects.id))
      .where(and(...conditions))
      .orderBy(expenses.date)
      .limit(100);

    return { aggregation: "none", period: { start_date, end_date }, count: rows.length, data: rows };
  },
};
