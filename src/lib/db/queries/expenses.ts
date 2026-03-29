import { db } from "@/lib/db";
import { expenses, expenseCategories } from "@/lib/db/schema";
import { and, eq, gte, lte, or, isNull } from "drizzle-orm";

export async function getExpensesForDateRange(
  organizationId: string,
  startDate: string,
  endDate: string
) {
  return db
    .select({
      id: expenses.id,
      userId: expenses.userId,
      projectId: expenses.projectId,
      date: expenses.date,
      amount: expenses.amount,
      description: expenses.description,
      categoryId: expenses.categoryId,
      categoryName: expenseCategories.name,
      attachmentUrl: expenses.attachmentUrl,
    })
    .from(expenses)
    .innerJoin(
      expenseCategories,
      eq(expenses.categoryId, expenseCategories.id)
    )
    .where(
      and(
        eq(expenses.organizationId, organizationId),
        gte(expenses.date, startDate),
        lte(expenses.date, endDate)
      )
    );
}

export async function getExpenseCategories(organizationId: string) {
  return db
    .select({
      id: expenseCategories.id,
      name: expenseCategories.name,
    })
    .from(expenseCategories)
    .where(
      or(
        eq(expenseCategories.organizationId, organizationId),
        isNull(expenseCategories.organizationId)
      )
    );
}

export async function createExpense(data: {
  userId: string;
  projectId: string;
  date: string;
  amount: string;
  description: string | null;
  categoryId: string;
  attachmentUrl: string | null;
  organizationId: string;
}) {
  return db
    .insert(expenses)
    .values({
      ...data,
      type: "actual",
      recurrence: "once",
    })
    .returning();
}

export async function deleteExpense(id: string, organizationId: string) {
  return db
    .delete(expenses)
    .where(
      and(eq(expenses.id, id), eq(expenses.organizationId, organizationId))
    );
}
