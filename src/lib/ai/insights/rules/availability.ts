import { db } from "@/lib/db";
import { users, timeEntries, absences, projects, organizationMembers } from "@/lib/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { Insight } from "../analyzer";

export async function checkAvailability(
  organizationId: string,
  locale: string
): Promise<Insight[]> {
  const isFr = locale === "fr";
  const insights: Insight[] = [];

  // Check next 2 weeks
  const today = new Date();
  const twoWeeksLater = new Date(today);
  twoWeeksLater.setDate(today.getDate() + 14);

  const startStr = today.toISOString().split("T")[0];
  const endStr = twoWeeksLater.toISOString().split("T")[0];

  // Count working days in range
  let workingDays = 0;
  for (let d = new Date(today); d <= twoWeeksLater; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0 && d.getDay() !== 6) workingDays++;
  }

  if (workingDays === 0) return [];

  // Get active members
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

  // Forecast entries
  const forecastData = await db
    .select({
      userId: timeEntries.userId,
      totalDays: sql<string>`SUM(CAST(${timeEntries.value} AS DECIMAL))`,
    })
    .from(timeEntries)
    .innerJoin(projects, eq(timeEntries.projectId, projects.id))
    .where(
      and(
        eq(projects.organizationId, organizationId),
        gte(timeEntries.date, startStr),
        lte(timeEntries.date, endStr),
        sql`${timeEntries.userId} IN (${sql.join(
          memberIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      )
    )
    .groupBy(timeEntries.userId);

  // Absences
  const absenceData = await db
    .select({
      userId: absences.userId,
      totalDays: sql<string>`SUM(CAST(${absences.value} AS DECIMAL))`,
    })
    .from(absences)
    .where(
      and(
        gte(absences.date, startStr),
        lte(absences.date, endStr),
        eq(absences.status, "approved"),
        sql`${absences.userId} IN (${sql.join(
          memberIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      )
    )
    .groupBy(absences.userId);

  const forecastMap = new Map(
    forecastData.map((f) => [f.userId, parseFloat(f.totalDays)])
  );
  const absenceMap = new Map(
    absenceData.map((a) => [a.userId, parseFloat(a.totalDays)])
  );

  for (const member of members) {
    const forecast = forecastMap.get(member.userId) ?? 0;
    const absence = absenceMap.get(member.userId) ?? 0;
    const occupation = forecast + absence;
    const rate = Math.round((occupation / workingDays) * 100);

    if (rate > 90) {
      insights.push({
        id: `availability-${member.userId}`,
        type: "warning",
        category: "availability",
        title: isFr
          ? `${member.userName ?? "Collaborateur"} : occupation à ${rate}%`
          : `${member.userName ?? "Collaborator"}: ${rate}% occupied`,
        description: isFr
          ? `${member.userName} est planifié à ${rate}% sur les 2 prochaines semaines (${occupation.toFixed(1)}/${workingDays} jours).`
          : `${member.userName} is planned at ${rate}% over the next 2 weeks (${occupation.toFixed(1)}/${workingDays} days).`,
        actionSuggestion: isFr
          ? "Évitez d'ajouter des projets supplémentaires."
          : "Avoid adding extra projects.",
        relatedEntityId: member.userId,
        relatedEntityType: "user",
        severity: rate >= 100 ? 7 : 5,
      });
    }
  }

  return insights;
}
