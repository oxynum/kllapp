"use server";

import { db } from "@/lib/db";
import { users, organizationMembers, organizations } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

export async function switchOrganization(orgId: string) {
  const t = await getTranslations("errors");
  const session = await auth();
  if (!session?.user?.appUserId) throw new Error(t("notAuthenticated"));

  // Verify the user is an active member of the target org
  const [membership] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, session.user.appUserId),
        eq(organizationMembers.organizationId, orgId),
        ne(organizationMembers.status, "declined")
      )
    );

  if (!membership) throw new Error(t("accessDenied"));

  await db
    .update(users)
    .set({ currentOrganizationId: orgId })
    .where(eq(users.id, session.user.appUserId));

  revalidatePath("/");
  redirect("/");
}

const updateOrgSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function updateOrganization(input: z.infer<typeof updateOrgSchema>) {
  const t = await getTranslations("errors");
  const session = await auth();
  if (!session?.user?.appUserId) throw new Error(t("notAuthenticated"));

  const orgId = session.user.currentOrganizationId;
  if (!orgId) throw new Error(t("noOrganization"));

  // Verify user is admin/owner of this org
  const [membership] = await db
    .select({ role: organizationMembers.role, isOwner: organizationMembers.isOwner })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, session.user.appUserId),
        eq(organizationMembers.organizationId, orgId),
        ne(organizationMembers.status, "declined")
      )
    );

  if (!membership || (membership.role !== "admin" && membership.role !== "manager")) {
    throw new Error(t("adminOnly"));
  }

  const parsed = updateOrgSchema.parse(input);

  await db
    .update(organizations)
    .set({ name: parsed.name })
    .where(eq(organizations.id, orgId));

  revalidatePath("/");
}

// ============================================================
// Helper
// ============================================================

function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "org"
  );
}

// ============================================================
// Create organization from dashboard
// ============================================================

export async function createOrganizationFromDashboard(formData: FormData) {
  const t = await getTranslations("errors");
  const session = await auth();
  if (!session?.user?.appUserId) throw new Error(t("notAuthenticated"));

  const rawName = formData.get("name") as string | null;
  if (!rawName || rawName.trim().length === 0) {
    throw new Error(t("nameRequired"));
  }
  const name = rawName.trim();
  if (name.length > 100) {
    throw new Error("Organization name must be 100 characters or less");
  }

  const slug = generateSlug(name) + "-" + Date.now().toString(36);

  const [newOrg] = await db
    .insert(organizations)
    .values({ name: name.trim(), slug })
    .returning({ id: organizations.id });

  await db.insert(organizationMembers).values({
    organizationId: newOrg.id,
    userId: session.user.appUserId,
    email: session.user.email!,
    role: "admin",
    isOwner: true,
    status: "active",
    joinedAt: new Date(),
  });

  await db
    .update(users)
    .set({ currentOrganizationId: newOrg.id })
    .where(eq(users.id, session.user.appUserId));

  revalidatePath("/");
  redirect("/");
}

// ============================================================
// Pending invitations
// ============================================================

export async function getPendingInvitationsForUser() {
  const session = await auth();
  if (!session?.user?.appUserId) return [];

  const invitations = await db
    .select({
      membershipId: organizationMembers.id,
      orgId: organizationMembers.organizationId,
      orgName: organizations.name,
      role: organizationMembers.role,
      invitedAt: organizationMembers.invitedAt,
    })
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizationMembers.organizationId, organizations.id)
    )
    .where(
      and(
        eq(organizationMembers.userId, session.user.appUserId),
        eq(organizationMembers.status, "pending")
      )
    );

  return invitations;
}

// ============================================================
// Accept invitation
// ============================================================

export async function acceptInvitationFromDashboard(membershipId: string) {
  const t = await getTranslations("errors");
  const session = await auth();
  if (!session?.user?.appUserId) throw new Error(t("notAuthenticated"));

  const [membership] = await db
    .select({
      id: organizationMembers.id,
      userId: organizationMembers.userId,
      organizationId: organizationMembers.organizationId,
      status: organizationMembers.status,
    })
    .from(organizationMembers)
    .where(eq(organizationMembers.id, membershipId));

  if (!membership || membership.userId !== session.user.appUserId || membership.status !== "pending") {
    throw new Error(t("accessDenied"));
  }

  await db
    .update(organizationMembers)
    .set({ status: "active", joinedAt: new Date() })
    .where(eq(organizationMembers.id, membershipId));

  await db
    .update(users)
    .set({ currentOrganizationId: membership.organizationId })
    .where(eq(users.id, session.user.appUserId));

  revalidatePath("/");
  redirect("/");
}

// ============================================================
// Decline invitation
// ============================================================

export async function declineInvitationFromDashboard(membershipId: string) {
  const t = await getTranslations("errors");
  const session = await auth();
  if (!session?.user?.appUserId) throw new Error(t("notAuthenticated"));

  const [membership] = await db
    .select({
      id: organizationMembers.id,
      userId: organizationMembers.userId,
      status: organizationMembers.status,
    })
    .from(organizationMembers)
    .where(eq(organizationMembers.id, membershipId));

  if (!membership || membership.userId !== session.user.appUserId || membership.status !== "pending") {
    throw new Error(t("accessDenied"));
  }

  await db
    .update(organizationMembers)
    .set({ status: "declined" })
    .where(eq(organizationMembers.id, membershipId));

  revalidatePath("/");
}
