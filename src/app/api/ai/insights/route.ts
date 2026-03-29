import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, organizationMembers } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { generateInsights } from "@/lib/ai/insights/analyzer";
import type { OrgRole } from "@/lib/auth-context";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUserId = session.user.appUserId;
  if (!appUserId) {
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  const [appUser] = await db
    .select({
      currentOrganizationId: users.currentOrganizationId,
      locale: users.locale,
    })
    .from(users)
    .where(eq(users.id, appUserId));

  if (!appUser?.currentOrganizationId) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  const [membership] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, appUserId),
        eq(organizationMembers.organizationId, appUser.currentOrganizationId),
        eq(organizationMembers.status, "active")
      )
    );

  const role = (membership?.role as OrgRole) ?? "collaborator";

  const insights = await generateInsights(
    appUser.currentOrganizationId,
    role,
    appUser.locale ?? "fr"
  );

  return NextResponse.json({ insights });
}
