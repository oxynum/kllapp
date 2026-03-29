"use server";

import { db } from "@/lib/db";
import { organizations, organizationMembers, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || "org";
}

export async function acceptInvitation(membershipId: string) {
  const t = await getTranslations("errors");
  const session = await auth();
  if (!session?.user?.appUserId) throw new Error(t("notAuthenticated"));

  // Verify membership belongs to this user
  const [membership] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.id, membershipId),
        eq(organizationMembers.userId, session.user.appUserId)
      )
    );

  if (!membership) throw new Error(t("invitationNotFound"));

  // Accept: set status to active, set joinedAt
  await db
    .update(organizationMembers)
    .set({ status: "active", joinedAt: new Date() })
    .where(eq(organizationMembers.id, membershipId));

  // Set as current org
  await db
    .update(users)
    .set({ currentOrganizationId: membership.organizationId })
    .where(eq(users.id, session.user.appUserId));

  revalidatePath("/");
  redirect("/");
}

export async function declineInvitation(membershipId: string) {
  const t = await getTranslations("errors");
  const session = await auth();
  if (!session?.user?.appUserId) throw new Error(t("notAuthenticated"));

  // Verify membership belongs to this user
  const [membership] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.id, membershipId),
        eq(organizationMembers.userId, session.user.appUserId)
      )
    );

  if (!membership) throw new Error(t("invitationNotFound"));

  // Delete the membership row
  await db
    .delete(organizationMembers)
    .where(eq(organizationMembers.id, membershipId));

  revalidatePath("/onboarding");
}

export async function createOrganization(formData: FormData) {
  const t = await getTranslations("errors");
  const session = await auth();
  if (!session?.user?.appUserId || !session?.user?.email) {
    throw new Error(t("notAuthenticated"));
  }

  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error(t("nameRequired"));
  if (name.length > 100) throw new Error("Organization name must be 100 characters or less");

  const slug = generateSlug(name) + "-" + Date.now().toString(36);

  // Create org
  const [org] = await db
    .insert(organizations)
    .values({ name, slug })
    .returning();

  // Create owner membership
  await db.insert(organizationMembers).values({
    organizationId: org.id,
    userId: session.user.appUserId,
    email: session.user.email,
    role: "admin",
    isOwner: true,
    status: "active",
    joinedAt: new Date(),
  });

  // Set as current org
  await db
    .update(users)
    .set({ currentOrganizationId: org.id })
    .where(eq(users.id, session.user.appUserId));

  revalidatePath("/");
  redirect("/");
}
