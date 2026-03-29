"use server";

import { requireOrgContext, requireManagerOrAdmin } from "@/lib/auth-context";
import { z } from "zod";
import {
  upsertTimeEntry,
  upsertTimeEntryNote,
  deleteTimeEntry,
} from "@/lib/db/queries/time-entries";
import { updateProjectDates } from "@/lib/db/queries/project-dates";
import {
  createExpense,
  deleteExpense,
  getExpensesForDateRange,
  getExpenseCategories,
} from "@/lib/db/queries/expenses";
import { db } from "@/lib/db";
import { projects, organizationMembers, projectForecasts } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function verifyProjectInOrg(projectId: string, organizationId: string) {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)));
  if (!project) throw new Error("Project not found");
}

async function verifyUserInOrg(userId: string, organizationId: string) {
  const [member] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(and(
      eq(organizationMembers.userId, userId),
      eq(organizationMembers.organizationId, organizationId),
      ne(organizationMembers.status, "declined")
    ));
  if (!member) throw new Error("User not found");
}

const cellEditSchema = z.object({
  userId: z.string().uuid(),
  projectId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.string(),
  type: z.enum(["worked", "forecast", "pipeline"]),
  probability: z.number().min(0).max(100).optional(),
});

export async function updateCellAction(input: z.infer<typeof cellEditSchema>) {
  const { organizationId, appUserId, orgRole } = await requireOrgContext();

  const parsed = cellEditSchema.parse(input);

  // Verify project and user belong to this org
  await verifyProjectInOrg(parsed.projectId, organizationId);
  await verifyUserInOrg(parsed.userId, organizationId);

  // Collaborators can only edit their own entries
  if (orgRole === "collaborator" && parsed.userId !== appUserId) {
    throw new Error("Cannot edit other users' entries");
  }

  const numValue = Number(parsed.value);
  if (numValue === 0 || parsed.value === "") {
    await deleteTimeEntry(parsed.userId, parsed.projectId, parsed.date);
    return { success: true, deleted: true };
  }

  const result = await upsertTimeEntry({
    userId: parsed.userId,
    projectId: parsed.projectId,
    date: parsed.date,
    value: parsed.value,
    type: parsed.type,
    probability: parsed.probability,
  });

  return { success: true, entry: result[0] };
}

const noteEditSchema = z.object({
  userId: z.string().uuid(),
  projectId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().nullable(),
});

export async function updateNoteAction(input: z.infer<typeof noteEditSchema>) {
  const { organizationId, appUserId, orgRole } = await requireOrgContext();

  const parsed = noteEditSchema.parse(input);

  await verifyProjectInOrg(parsed.projectId, organizationId);
  await verifyUserInOrg(parsed.userId, organizationId);

  // Collaborators can only edit their own notes
  if (orgRole === "collaborator" && parsed.userId !== appUserId) {
    throw new Error("Cannot edit other users' notes");
  }

  await upsertTimeEntryNote({
    userId: parsed.userId,
    projectId: parsed.projectId,
    date: parsed.date,
    note: parsed.note,
  });

  return { success: true };
}

const projectDatesSchema = z.object({
  projectId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export async function updateProjectDatesAction(
  input: z.infer<typeof projectDatesSchema>
) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);
  const parsed = projectDatesSchema.parse(input);
  await verifyProjectInOrg(parsed.projectId, organizationId);
  await updateProjectDates(parsed);
  return { success: true };
}

// ============================================================
// Expenses
// ============================================================

const createExpenseSchema = z.object({
  userId: z.string().uuid(),
  projectId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.string().min(1),
  description: z.string().nullable(),
  categoryId: z.string().uuid(),
  attachmentUrl: z.string().url().nullable().optional(),
});

export async function createExpenseAction(
  input: z.infer<typeof createExpenseSchema>
) {
  const { organizationId, appUserId, orgRole } = await requireOrgContext();
  const parsed = createExpenseSchema.parse(input);

  await verifyProjectInOrg(parsed.projectId, organizationId);
  await verifyUserInOrg(parsed.userId, organizationId);

  if (orgRole === "collaborator" && parsed.userId !== appUserId) {
    throw new Error("Cannot create expenses for other users");
  }

  const result = await createExpense({
    userId: parsed.userId,
    projectId: parsed.projectId,
    date: parsed.date,
    amount: parsed.amount,
    description: parsed.description ?? null,
    categoryId: parsed.categoryId,
    attachmentUrl: parsed.attachmentUrl ?? null,
    organizationId,
  });

  return { success: true, expense: result[0] };
}

const deleteExpenseSchema = z.object({
  expenseId: z.string().uuid(),
});

export async function deleteExpenseAction(
  input: z.infer<typeof deleteExpenseSchema>
) {
  const { organizationId } = await requireOrgContext();
  const parsed = deleteExpenseSchema.parse(input);
  await deleteExpense(parsed.expenseId, organizationId);
  return { success: true };
}

export async function getExpensesAction(startDate: string, endDate: string) {
  const { organizationId } = await requireOrgContext();
  return getExpensesForDateRange(organizationId, startDate, endDate);
}

export async function getExpenseCategoriesAction() {
  const { organizationId } = await requireOrgContext();
  return getExpenseCategories(organizationId);
}

// ─── Project forecasts (previsionnel) ─────────────────────────

const forecastSchema = z.object({
  projectId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.string(),
});

export async function upsertForecastAction(input: z.infer<typeof forecastSchema>) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);
  const parsed = forecastSchema.parse(input);

  await verifyProjectInOrg(parsed.projectId, organizationId);

  if (!parsed.value || parsed.value === "0") {
    await db
      .delete(projectForecasts)
      .where(
        and(
          eq(projectForecasts.projectId, parsed.projectId),
          eq(projectForecasts.date, parsed.date)
        )
      );
  } else {
    await db
      .insert(projectForecasts)
      .values({
        projectId: parsed.projectId,
        organizationId,
        date: parsed.date,
        value: parsed.value,
      })
      .onConflictDoUpdate({
        target: [projectForecasts.projectId, projectForecasts.date],
        set: { value: parsed.value, updatedAt: new Date() },
      });
  }

  revalidatePath("/");
  return { success: true };
}
