import { db } from "@/lib/db";
import { expenses, expenseCategories, projects } from "@/lib/db/schema";
import { and, eq, or, isNull } from "drizzle-orm";
import type { OrgRole } from "@/lib/auth-context";
import type { ToolDefinition } from "./index";

export const createExpenseTool: ToolDefinition = {
  name: "create_expense",
  description:
    "Create an expense for the current user. Always confirm with the user before calling this tool. Use query_projects to find project IDs and list expense categories if needed.",
  input_schema: {
    type: "object" as const,
    properties: {
      amount: {
        type: "number",
        description: "Expense amount in EUR. Required.",
      },
      date: {
        type: "string",
        description: "Date of the expense (YYYY-MM-DD). Required.",
      },
      description: {
        type: "string",
        description: "Description of the expense. Required.",
      },
      category_name: {
        type: "string",
        description:
          "Category name (e.g. 'transport', 'meals', 'software'). Required.",
      },
      project_id: {
        type: "string",
        description: "Associate with a project ID (optional).",
      },
    },
    required: ["amount", "date", "description", "category_name"],
  },
  execute: async (
    params: Record<string, unknown>,
    ctx: { userId: string; organizationId: string; role: OrgRole }
  ) => {
    const { amount, date, description, category_name, project_id } = params as {
      amount: number;
      date: string;
      description: string;
      category_name: string;
      project_id?: string;
    };

    // Find category by name
    const categories = await db
      .select({ id: expenseCategories.id, name: expenseCategories.name })
      .from(expenseCategories)
      .where(
        or(
          eq(expenseCategories.organizationId, ctx.organizationId),
          isNull(expenseCategories.organizationId)
        )
      );

    const category = categories.find(
      (c) => c.name.toLowerCase() === category_name.toLowerCase()
    );

    if (!category) {
      const available = categories.map((c) => c.name).join(", ");
      return {
        error: `Category "${category_name}" not found. Available categories: ${available}`,
      };
    }

    // Verify project if provided
    if (project_id) {
      const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.id, project_id),
            eq(projects.organizationId, ctx.organizationId)
          )
        );
      if (!project) {
        return { error: "Project not found in your organization." };
      }
    }

    const [expense] = await db
      .insert(expenses)
      .values({
        userId: ctx.userId,
        projectId: project_id ?? null,
        date,
        amount: amount.toFixed(2),
        description,
        categoryId: category.id,
        type: "actual",
        recurrence: "once",
        organizationId: ctx.organizationId,
      })
      .returning();

    return {
      success: true,
      message: `Expense created: ${amount.toFixed(2)}€ — "${description}" (${category.name}) on ${date}.`,
      expense: {
        id: expense.id,
        date: expense.date,
        amount: expense.amount,
        description: expense.description,
        category: category.name,
      },
    };
  },
};
