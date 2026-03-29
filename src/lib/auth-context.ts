import { auth } from "@/auth";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { users, organizationMembers } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";

export type OrgRole = "admin" | "manager" | "collaborator";

export async function requireOrgContext() {
  const session = await auth();
  const t = await getTranslations("errors");
  if (!session?.user) {
    console.error("[KLLAPP] requireOrgContext: no session", { timestamp: new Date().toISOString() });
    throw new Error(t("notAuthenticated"));
  }

  const appUserId = session.user.appUserId;
  if (!appUserId) {
    console.error("[KLLAPP] requireOrgContext: no appUserId", {
      authUserId: session.user.id,
      timestamp: new Date().toISOString(),
    });
    throw new Error(t("notAuthenticated"));
  }

  // Read currentOrganizationId from DB (not JWT) to handle immediate switches
  let appUser;
  try {
    [appUser] = await db
      .select({ currentOrganizationId: users.currentOrganizationId })
      .from(users)
      .where(eq(users.id, appUserId));
  } catch (err) {
    console.error("[KLLAPP] requireOrgContext: DB query failed (users)", {
      appUserId,
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    });
    throw err;
  }

  const organizationId = appUser?.currentOrganizationId;
  if (!organizationId) {
    console.error("[KLLAPP] requireOrgContext: no org", {
      appUserId,
      hasAppUser: !!appUser,
      timestamp: new Date().toISOString(),
    });
    throw new Error(t("noOrganization"));
  }

  // Fetch membership role from DB for accuracy
  const [membership] = await db
    .select({ role: organizationMembers.role, isOwner: organizationMembers.isOwner })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, appUserId),
        eq(organizationMembers.organizationId, organizationId),
        ne(organizationMembers.status, "declined")
      )
    );

  return {
    session,
    appUserId,
    organizationId,
    orgRole: (membership?.role as OrgRole) ?? "collaborator",
    isOrgOwner: membership?.isOwner ?? false,
  };
}

export async function requireManagerOrAdmin(role: OrgRole) {
  if (role !== "admin" && role !== "manager") {
    const t = await getTranslations("errors");
    throw new Error(t("managerAdminOnly"));
  }
}

export async function requireSuperAdmin() {
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    throw new Error("Forbidden: Super admin access required");
  }
  return session;
}
