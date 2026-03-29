"use server";

import { db } from "@/lib/db";
import {
  organizations,
  organizationMembers,
  users,
  clients,
  projects,
  timeEntries,
  projectAssignments,
  expenses,
  expenseCategories,
  projectDependencies,
} from "@/lib/db/schema";
import { eq, and, ne, inArray } from "drizzle-orm";
import { requireOrgContext, requireManagerOrAdmin } from "@/lib/auth-context";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

// ============================================================
// Get organization details for settings page
// ============================================================

export async function getOrganizationDetails() {
  const { organizationId, orgRole, isOrgOwner, appUserId } =
    await requireOrgContext();

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId));

  const members = await db
    .select({
      id: organizationMembers.id,
      userId: organizationMembers.userId,
      email: organizationMembers.email,
      role: organizationMembers.role,
      isOwner: organizationMembers.isOwner,
      status: organizationMembers.status,
      invitedAt: organizationMembers.invitedAt,
      joinedAt: organizationMembers.joinedAt,
      userName: users.name,
    })
    .from(organizationMembers)
    .leftJoin(users, eq(organizationMembers.userId, users.id))
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        ne(organizationMembers.status, "declined")
      )
    );

  return {
    org,
    members,
    currentUserRole: orgRole,
    isCurrentUserOwner: isOrgOwner,
    currentUserId: appUserId,
  };
}

// ============================================================
// Update member role
// ============================================================

const updateMemberRoleSchema = z.object({
  membershipId: z.string().uuid(),
  role: z.enum(["admin", "manager", "collaborator"]),
});

export async function updateMemberRole(
  input: z.infer<typeof updateMemberRoleSchema>
) {
  const t = await getTranslations("errors");
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);

  const parsed = updateMemberRoleSchema.parse(input);

  // Verify membership belongs to current org and is not the owner
  const [membership] = await db
    .select({
      id: organizationMembers.id,
      organizationId: organizationMembers.organizationId,
      isOwner: organizationMembers.isOwner,
    })
    .from(organizationMembers)
    .where(eq(organizationMembers.id, parsed.membershipId));

  if (!membership || membership.organizationId !== organizationId) {
    throw new Error(t("accessDenied"));
  }

  if (membership.isOwner) {
    throw new Error(t("accessDenied"));
  }

  await db
    .update(organizationMembers)
    .set({ role: parsed.role })
    .where(eq(organizationMembers.id, parsed.membershipId));

  revalidatePath("/");
}

// ============================================================
// Leave organization
// ============================================================

export async function leaveOrganization() {
  const t = await getTranslations("errors");
  const { organizationId, isOrgOwner, appUserId } = await requireOrgContext();

  if (isOrgOwner) {
    throw new Error(t("accessDenied"));
  }

  // Delete own membership
  await db
    .delete(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, appUserId),
        eq(organizationMembers.organizationId, organizationId)
      )
    );

  // Find another active org to switch to
  const [anotherOrg] = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, appUserId),
        ne(organizationMembers.status, "declined")
      )
    )
    .limit(1);

  if (anotherOrg) {
    await db
      .update(users)
      .set({ currentOrganizationId: anotherOrg.organizationId })
      .where(eq(users.id, appUserId));

    revalidatePath("/");
    redirect("/");
  } else {
    await db
      .update(users)
      .set({ currentOrganizationId: null })
      .where(eq(users.id, appUserId));

    revalidatePath("/");
    redirect("/onboarding");
  }
}

// ============================================================
// Delete organization (owner only)
// ============================================================

export async function deleteOrganization() {
  const t = await getTranslations("errors");
  const { organizationId, isOrgOwner, appUserId } = await requireOrgContext();

  if (!isOrgOwner) {
    throw new Error(t("accessDenied"));
  }

  // Delete all org data in a transaction
  await db.transaction(async (tx) => {
    const orgProjects = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.organizationId, organizationId));

    const projectIds = orgProjects.map((p) => p.id);

    if (projectIds.length > 0) {
      await tx.delete(timeEntries).where(inArray(timeEntries.projectId, projectIds));
      await tx.delete(projectAssignments).where(inArray(projectAssignments.projectId, projectIds));
      await tx.delete(expenses).where(inArray(expenses.projectId, projectIds));
    }

    await tx.delete(projectDependencies).where(eq(projectDependencies.organizationId, organizationId));
    await tx.delete(projects).where(eq(projects.organizationId, organizationId));
    await tx.delete(expenseCategories).where(eq(expenseCategories.organizationId, organizationId));
    await tx.delete(clients).where(eq(clients.organizationId, organizationId));
    await tx.delete(organizations).where(eq(organizations.id, organizationId));
    await tx.update(users).set({ currentOrganizationId: null }).where(eq(users.currentOrganizationId, organizationId));
  });

  // Find another active org for current user
  const [anotherOrg] = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, appUserId),
        ne(organizationMembers.status, "declined")
      )
    )
    .limit(1);

  if (anotherOrg) {
    await db
      .update(users)
      .set({ currentOrganizationId: anotherOrg.organizationId })
      .where(eq(users.id, appUserId));

    revalidatePath("/");
    redirect("/");
  } else {
    revalidatePath("/");
    redirect("/onboarding");
  }
}
