import { db } from "@/lib/db";
import { users, timeEntries, projects, organizationMembers } from "@/lib/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { Insight } from "../analyzer";

export async function checkTimeUnderEntry(
  organizationId: string,
  locale: string
): Promise<Insight[]> {
  const isFr = locale === "fr";
  const insights: Insight[] = [];

  // Only check on weekdays
  const today = new Date();
  const dayOfWeek = today.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return [];

  // Check for the current week (Monday to today)
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
  const mondayStr = monday.toISOString().split("T")[0];
  const todayStr = today.toISOString().split("T")[0];

  // Expected working days so far this week
  const workingDaysSoFar = Math.min(dayOfWeek === 0 ? 5 : dayOfWeek, 5);

  // Get all active members
  const members = await db
    .select({ userId: users.id, userName: users.name })
    .from(users)
    .innerJoin(
      organizationMembers,
      and(
        eq(organizationMembers.userId, users.id),
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.status, "active")
      )
    );

  if (members.length === 0) return [];

  const memberIds = members.map((m) => m.userId);

  // Get time entries this week per user
  const weekEntries = await db
    .select({
      userId: timeEntries.userId,
      totalDays: sql<string>`SUM(CAST(${timeEntries.value} AS DECIMAL))`,
    })
    .from(timeEntries)
    .innerJoin(projects, eq(timeEntries.projectId, projects.id))
    .where(
      and(
        eq(projects.organizationId, organizationId),
        eq(timeEntries.type, "worked"),
        gte(timeEntries.date, mondayStr),
        lte(timeEntries.date, todayStr),
        sql`${timeEntries.userId} IN (${sql.join(
          memberIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      )
    )
    .groupBy(timeEntries.userId);

  const entryMap = new Map(
    weekEntries.map((e) => [e.userId, parseFloat(e.totalDays)])
  );

  // Check for under-entry (less than 50% of expected)
  const threshold = workingDaysSoFar * 0.5;

  for (const member of members) {
    const logged = entryMap.get(member.userId) ?? 0;
    if (logged < threshold && workingDaysSoFar >= 3) {
      insights.push({
        id: `underentry-${member.userId}`,
        type: "warning",
        category: "time",
        title: isFr
          ? `${member.userName ?? "Collaborateur"} : sous-saisie cette semaine`
          : `${member.userName ?? "Collaborator"}: under-entry this week`,
        description: isFr
          ? `${logged.toFixed(1)} jour(s) saisis sur ${workingDaysSoFar} jours ouvrés cette semaine.`
          : `${logged.toFixed(1)} day(s) logged out of ${workingDaysSoFar} working days this week.`,
        actionSuggestion: isFr
          ? "Un rappel pourrait aider à compléter les saisies."
          : "A reminder could help complete the entries.",
        relatedEntityId: member.userId,
        relatedEntityType: "user",
        severity: 5,
      });
    }
  }

  return insights;
}
