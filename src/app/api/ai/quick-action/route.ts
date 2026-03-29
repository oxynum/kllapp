import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, organizationMembers, projects, projectAssignments } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { parseQuickAction } from "@/lib/ai/quick-actions/parser";
import { executeQuickAction } from "@/lib/ai/quick-actions/executor";
import type { OrgRole } from "@/lib/auth-context";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { input: string; confirm?: boolean };
  if (!body.input || typeof body.input !== "string") {
    return NextResponse.json({ error: "Input is required" }, { status: 400 });
  }

  const appUserId = session.user.appUserId;
  if (!appUserId) {
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  const [appUser] = await db
    .select({
      id: users.id,
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

  // Get user's assigned projects for context
  const userProjects = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .innerJoin(
      projectAssignments,
      and(
        eq(projectAssignments.projectId, projects.id),
        eq(projectAssignments.userId, appUser.id)
      )
    )
    .where(
      and(
        eq(projects.organizationId, appUser.currentOrganizationId),
        eq(projects.status, "active")
      )
    );

  // Parse the input
  const parsed = await parseQuickAction(body.input, {
    projects: userProjects,
    userId: appUser.id,
    locale: appUser.locale ?? "fr",
  });

  if (!parsed) {
    return NextResponse.json({ error: "Could not understand the command" }, { status: 422 });
  }

  // If needs confirmation and not confirmed yet, return the parsed action
  if (parsed.needsConfirmation && !body.confirm) {
    return NextResponse.json({
      action: parsed,
      needsConfirmation: true,
    });
  }

  // Execute the action
  const result = await executeQuickAction(parsed, {
    userId: appUser.id,
    organizationId: appUser.currentOrganizationId,
    role,
  });

  return NextResponse.json({ action: parsed, result });
}
