"use server";

import { requireOrgContext, requireManagerOrAdmin } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { clients, projects, projectAssignments, organizationMembers } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ============================================================
// Absence Client (category group like "Absences & Congés")
// ============================================================

const absenceClientSchema = z.object({
  name: z.string().min(1),
});

export async function createAbsenceClient(formData: FormData) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);

  const parsed = absenceClientSchema.parse({
    name: formData.get("name"),
  });

  await db.insert(clients).values({
    name: parsed.name,
    isAbsence: true,
    organizationId,
  });
  revalidatePath("/");
}

const DEFAULT_ABSENCE_TYPES = [
  "Congés payés",
  "RTT",
  "Maladie",
  "Congé sans solde",
  "Formation",
  "Télétravail",
  "Jour férié",
  "Congé maternité / paternité",
];

export async function createAbsenceClientWithDefaults() {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);

  const [absenceClient] = await db.insert(clients).values({
    name: "Absences & Congés",
    isAbsence: true,
    organizationId,
  }).returning({ id: clients.id });

  await db.insert(projects).values(
    DEFAULT_ABSENCE_TYPES.map((name) => ({
      name,
      clientId: absenceClient.id,
      type: "internal" as const,
      billable: false,
      status: "active" as const,
      organizationId,
    }))
  );

  revalidatePath("/");
}

const updateAbsenceClientSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
});

export async function updateAbsenceClient(input: z.infer<typeof updateAbsenceClientSchema>) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);
  const parsed = updateAbsenceClientSchema.parse(input);
  const { id, ...fields } = parsed;

  const set: Record<string, unknown> = {};
  if (fields.name !== undefined) set.name = fields.name;

  if (Object.keys(set).length > 0) {
    await db.update(clients).set(set).where(
      and(eq(clients.id, id), eq(clients.organizationId, organizationId), eq(clients.isAbsence, true))
    );
  }

  revalidatePath("/");
}

export async function deleteAbsenceClient(id: string) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);

  await db.delete(clients).where(
    and(eq(clients.id, id), eq(clients.organizationId, organizationId), eq(clients.isAbsence, true))
  );
  revalidatePath("/");
}

// ============================================================
// Absence Type (project under an absence client)
// ============================================================

const absenceTypeSchema = z.object({
  name: z.string().min(1),
  clientId: z.string().uuid(),
  dailyCost: z.string().optional(),
});

export async function createAbsenceType(formData: FormData) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);

  const parsed = absenceTypeSchema.parse({
    name: formData.get("name"),
    clientId: formData.get("clientId"),
    dailyCost: formData.get("dailyCost") || undefined,
  });

  // Verify the client is an absence client belonging to this org
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(eq(clients.id, parsed.clientId), eq(clients.organizationId, organizationId), eq(clients.isAbsence, true))
    );
  if (!client) throw new Error("Absence client not found");

  await db.insert(projects).values({
    name: parsed.name,
    clientId: parsed.clientId,
    type: "internal",
    billable: false,
    status: "active",
    dailyRate: parsed.dailyCost ?? null,
    organizationId,
  });
  revalidatePath("/");
}

const updateAbsenceTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  dailyCost: z.string().nullable().optional(),
});

export async function updateAbsenceType(input: z.infer<typeof updateAbsenceTypeSchema>) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);
  const parsed = updateAbsenceTypeSchema.parse(input);
  const { id, ...fields } = parsed;

  const set: Record<string, unknown> = {};
  if (fields.name !== undefined) set.name = fields.name;
  if (fields.dailyCost !== undefined) set.dailyRate = fields.dailyCost;

  if (Object.keys(set).length > 0) {
    await db.update(projects).set(set).where(
      and(eq(projects.id, id), eq(projects.organizationId, organizationId))
    );
  }

  revalidatePath("/");
}

export async function deleteAbsenceType(id: string) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);

  await db.delete(projects).where(
    and(eq(projects.id, id), eq(projects.organizationId, organizationId))
  );
  revalidatePath("/");
}

// ============================================================
// Assign user to absence type
// ============================================================

const assignAbsenceUserSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  dailyCost: z.string().optional(),
});

export async function assignAbsenceUser(formData: FormData) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);

  const parsed = assignAbsenceUserSchema.parse({
    projectId: formData.get("projectId"),
    userId: formData.get("userId"),
    dailyCost: formData.get("dailyCost") || undefined,
  });

  // Verify project belongs to this org
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, parsed.projectId), eq(projects.organizationId, organizationId)));
  if (!project) throw new Error("Absence type not found");

  // Verify user is a member of this org
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
    dailyCost: parsed.dailyCost ?? null,
  });
  revalidatePath("/");
}
