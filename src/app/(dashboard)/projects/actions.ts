"use server";

import { requireOrgContext, requireManagerOrAdmin } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { projects, projectAssignments, organizationMembers } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

const projectSchema = z.object({
  name: z.string().min(1),
  clientId: z.string().uuid().optional(),
  type: z
    .enum(["service", "product", "training", "internal"])
    .default("service"),
  dailyRate: z.string().optional(),
  budget: z.string().optional(),
  billable: z.boolean().default(true),
  status: z.enum(["draft", "active", "closed"]).default("draft"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function createProject(formData: FormData) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);

  const parsed = projectSchema.parse({
    name: formData.get("name"),
    clientId: formData.get("clientId") || undefined,
    type: formData.get("type") || "service",
    dailyRate: formData.get("dailyRate") || undefined,
    budget: formData.get("budget") || undefined,
    billable: formData.get("billable") === "false" ? false : true,
    status: formData.get("status") || "draft",
    startDate: formData.get("startDate") || undefined,
    endDate: formData.get("endDate") || undefined,
  });

  await db.insert(projects).values({
    name: parsed.name,
    clientId: parsed.clientId ?? null,
    type: parsed.type,
    dailyRate: parsed.dailyRate ?? null,
    budget: parsed.budget ?? null,
    billable: parsed.billable,
    status: parsed.status,
    startDate: parsed.startDate ?? null,
    endDate: parsed.endDate ?? null,
    organizationId,
  });
  revalidatePath("/projects");
  revalidatePath("/");
}

const assignmentSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  dailyRate: z.string().optional(),
});

export async function assignUser(formData: FormData) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);

  const parsed = assignmentSchema.parse({
    projectId: formData.get("projectId"),
    userId: formData.get("userId"),
    dailyRate: formData.get("dailyRate") || undefined,
  });

  // Verify project belongs to this org
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, parsed.projectId), eq(projects.organizationId, organizationId)));
  if (!project) throw new Error("Project not found");

  // Verify user is a member of this org (any non-declined status)
  const [member] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(and(
      eq(organizationMembers.userId, parsed.userId),
      eq(organizationMembers.organizationId, organizationId),
      ne(organizationMembers.status, "declined")
    ));
  if (!member) throw new Error("User not found");

  await db.insert(projectAssignments).values({
    projectId: parsed.projectId,
    userId: parsed.userId,
    dailyRate: parsed.dailyRate ?? null,
  });
  revalidatePath("/projects");
  revalidatePath("/");
}

const updateAssignmentRateSchema = z.object({
  assignmentId: z.string().uuid(),
  dailyRate: z.string().nullable(),
});

export async function updateAssignmentRate(input: z.infer<typeof updateAssignmentRateSchema>) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);

  const parsed = updateAssignmentRateSchema.parse(input);

  // Verify assignment belongs to a project in this org
  const [assignment] = await db
    .select({ id: projectAssignments.id })
    .from(projectAssignments)
    .innerJoin(projects, eq(projectAssignments.projectId, projects.id))
    .where(and(eq(projectAssignments.id, parsed.assignmentId), eq(projects.organizationId, organizationId)));
  if (!assignment) throw new Error("Assignment not found");

  await db
    .update(projectAssignments)
    .set({ dailyRate: parsed.dailyRate })
    .where(eq(projectAssignments.id, parsed.assignmentId));

  revalidatePath("/projects");
  revalidatePath("/");
}

const updateAssignmentDailyCostSchema = z.object({
  assignmentId: z.string().uuid(),
  dailyCost: z.string().nullable(),
});

export async function updateAssignmentDailyCost(input: z.infer<typeof updateAssignmentDailyCostSchema>) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);

  const parsed = updateAssignmentDailyCostSchema.parse(input);

  // Verify assignment belongs to a project in this org
  const [assignment] = await db
    .select({ id: projectAssignments.id })
    .from(projectAssignments)
    .innerJoin(projects, eq(projectAssignments.projectId, projects.id))
    .where(and(eq(projectAssignments.id, parsed.assignmentId), eq(projects.organizationId, organizationId)));
  if (!assignment) throw new Error("Assignment not found");

  await db
    .update(projectAssignments)
    .set({ dailyCost: parsed.dailyCost })
    .where(eq(projectAssignments.id, parsed.assignmentId));

  revalidatePath("/projects");
  revalidatePath("/");
}

export async function removeAssignment(id: string) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);

  // Verify assignment belongs to a project in this org
  const [assignment] = await db
    .select({ id: projectAssignments.id })
    .from(projectAssignments)
    .innerJoin(projects, eq(projectAssignments.projectId, projects.id))
    .where(and(eq(projectAssignments.id, id), eq(projects.organizationId, organizationId)));
  if (!assignment) throw new Error("Assignment not found");

  await db.delete(projectAssignments).where(eq(projectAssignments.id, id));
  revalidatePath("/projects");
  revalidatePath("/");
}

export async function deleteProject(id: string) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);

  await db.delete(projects).where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)));
  revalidatePath("/projects");
  revalidatePath("/");
}

// --- Sub-projects ---

const subProjectSchema = z.object({
  name: z.string().min(1),
  parentId: z.string().uuid(),
  type: z
    .enum(["service", "product", "training", "internal"])
    .optional(),
  dailyRate: z.string().optional(),
  budget: z.string().optional(),
  billable: z.boolean().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function createSubProject(formData: FormData) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);

  const rawBillable = formData.get("billable");
  const parsed = subProjectSchema.parse({
    name: formData.get("name"),
    parentId: formData.get("parentId"),
    type: formData.get("type") || undefined,
    dailyRate: formData.get("dailyRate") || undefined,
    budget: formData.get("budget") || undefined,
    billable: rawBillable === "false" ? false : rawBillable === "true" ? true : undefined,
    startDate: formData.get("startDate") || undefined,
    endDate: formData.get("endDate") || undefined,
  });

  // Validate parent exists, belongs to this org, and is not itself a sub-project
  const [parent] = await db
    .select({ id: projects.id, clientId: projects.clientId, parentId: projects.parentId, billable: projects.billable })
    .from(projects)
    .where(and(eq(projects.id, parsed.parentId), eq(projects.organizationId, organizationId)));

  const t = await getTranslations("errors");
  if (!parent) throw new Error(t("parentProjectNotFound"));
  if (parent.parentId) throw new Error(t("cannotCreateSubSubProject"));

  await db.insert(projects).values({
    name: parsed.name,
    parentId: parsed.parentId,
    clientId: parent.clientId,
    type: parsed.type ?? null,
    dailyRate: parsed.dailyRate ?? null,
    budget: parsed.budget ?? null,
    billable: parsed.billable ?? parent.billable,
    startDate: parsed.startDate ?? null,
    endDate: parsed.endDate ?? null,
    status: "active",
    organizationId,
  });

  revalidatePath("/");
}

const updateProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  type: z.enum(["service", "product", "training", "internal"]).optional(),
  dailyRate: z.string().nullable().optional(),
  budget: z.string().nullable().optional(),
  status: z.enum(["draft", "active", "closed"]).optional(),
  billable: z.boolean().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function updateProject(input: z.infer<typeof updateProjectSchema>) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);
  const parsed = updateProjectSchema.parse(input);
  const { id, ...fields } = parsed;

  // Build dynamic set — only include provided fields
  const set: Record<string, unknown> = {};
  if (fields.name !== undefined) set.name = fields.name;
  if (fields.type !== undefined) set.type = fields.type;
  if (fields.dailyRate !== undefined) set.dailyRate = fields.dailyRate;
  if (fields.budget !== undefined) set.budget = fields.budget;
  if (fields.status !== undefined) set.status = fields.status;
  if (fields.billable !== undefined) set.billable = fields.billable;
  if (fields.startDate !== undefined) set.startDate = fields.startDate;
  if (fields.endDate !== undefined) set.endDate = fields.endDate;

  if (Object.keys(set).length > 0) {
    await db.update(projects).set(set).where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)));
  }

  revalidatePath("/");
}

export async function deleteSubProject(id: string) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);
  // Verify it's actually a sub-project and belongs to this org
  const [project] = await db
    .select({ parentId: projects.parentId })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)));

  const t = await getTranslations("errors");
  if (!project?.parentId) throw new Error(t("notASubProject"));

  await db.delete(projects).where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)));
  revalidatePath("/");
}
