import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, organizationMembers } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { collectSuggestionData } from "@/lib/ai/suggestions/data-collector";
import { generateSuggestions } from "@/lib/ai/suggestions/suggest-engine";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ suggestions: [] });
  }

  const body = (await request.json()) as { date?: string };
  const targetDate = body.date ?? new Date().toISOString().split("T")[0];

  const appUserId = session.user.appUserId;
  if (!appUserId) {
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  const [appUser] = await db
    .select({
      id: users.id,
      currentOrganizationId: users.currentOrganizationId,
      hoursPerDay: users.hoursPerDay,
      locale: users.locale,
    })
    .from(users)
    .where(eq(users.id, appUserId));

  if (!appUser?.currentOrganizationId) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  // Verify membership
  const [membership] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, appUserId),
        eq(organizationMembers.organizationId, appUser.currentOrganizationId),
        eq(organizationMembers.status, "active")
      )
    );

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  try {
    const ctx = await collectSuggestionData(
      appUser.id,
      appUser.currentOrganizationId,
      targetDate,
      parseFloat(appUser.hoursPerDay ?? "7")
    );

    const suggestions = await generateSuggestions(
      ctx,
      targetDate,
      appUser.locale ?? "fr"
    );

    return NextResponse.json({ suggestions, date: targetDate });
  } catch (err) {
    console.error("[ai-suggest] Error:", err);
    return NextResponse.json({ suggestions: [], date: targetDate });
  }
}
