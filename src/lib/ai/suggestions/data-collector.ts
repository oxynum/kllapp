import { db } from "@/lib/db";
import {
  timeEntries,
  absences,
  projectAssignments,
  projects,
  calendarIntegrations,
} from "@/lib/db/schema";
import { and, eq, gte, lte, desc } from "drizzle-orm";

export interface SuggestionContext {
  calendarEvents: { summary: string; start: string; end: string; allDay: boolean }[];
  recentTimeEntries: {
    date: string;
    value: string;
    projectId: string;
    projectName: string;
    type: string | null;
  }[];
  activeAssignments: { projectId: string; projectName: string; clientName: string | null }[];
  absencesToday: { type: string; value: string }[];
  existingEntries: { projectId: string; projectName: string; value: string }[];
  hoursPerDay: number;
}

export async function collectSuggestionData(
  userId: string,
  organizationId: string,
  targetDate: string,
  hoursPerDay: number
): Promise<SuggestionContext> {
  const fourWeeksAgo = new Date(targetDate);
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const fourWeeksAgoStr = fourWeeksAgo.toISOString().split("T")[0];

  // Parallel queries
  const [recentEntries, assignments, todayAbsences, todayEntries, calIntegrations] =
    await Promise.all([
      // Recent time entries (last 4 weeks)
      db
        .select({
          date: timeEntries.date,
          value: timeEntries.value,
          projectId: timeEntries.projectId,
          projectName: projects.name,
          type: timeEntries.type,
        })
        .from(timeEntries)
        .innerJoin(projects, eq(timeEntries.projectId, projects.id))
        .where(
          and(
            eq(timeEntries.userId, userId),
            eq(projects.organizationId, organizationId),
            gte(timeEntries.date, fourWeeksAgoStr),
            lte(timeEntries.date, targetDate),
            eq(timeEntries.type, "worked")
          )
        )
        .orderBy(desc(timeEntries.date))
        .limit(200),

      // Active project assignments
      db
        .select({
          projectId: projectAssignments.projectId,
          projectName: projects.name,
          clientName: projects.clientId,
        })
        .from(projectAssignments)
        .innerJoin(projects, eq(projectAssignments.projectId, projects.id))
        .where(
          and(
            eq(projectAssignments.userId, userId),
            eq(projects.organizationId, organizationId),
            eq(projects.status, "active")
          )
        ),

      // Today's absences
      db
        .select({ type: absences.type, value: absences.value })
        .from(absences)
        .where(
          and(
            eq(absences.userId, userId),
            eq(absences.date, targetDate),
            eq(absences.status, "approved")
          )
        ),

      // Already entered today
      db
        .select({
          projectId: timeEntries.projectId,
          projectName: projects.name,
          value: timeEntries.value,
        })
        .from(timeEntries)
        .innerJoin(projects, eq(timeEntries.projectId, projects.id))
        .where(
          and(
            eq(timeEntries.userId, userId),
            eq(timeEntries.date, targetDate)
          )
        ),

      // Calendar integrations for fetching events
      db
        .select({
          id: calendarIntegrations.id,
          icsUrl: calendarIntegrations.icsUrl,
          label: calendarIntegrations.label,
        })
        .from(calendarIntegrations)
        .where(
          and(
            eq(calendarIntegrations.userId, userId),
            eq(calendarIntegrations.organizationId, organizationId),
            eq(calendarIntegrations.isEnabled, true)
          )
        ),
    ]);

  // We don't fetch calendar events here to avoid ICS parsing complexity in the collector.
  // Calendar events will be fetched separately if integrations exist.

  return {
    calendarEvents: [], // Populated by caller if calendar integrations exist
    recentTimeEntries: recentEntries,
    activeAssignments: assignments.map((a) => ({
      projectId: a.projectId,
      projectName: a.projectName,
      clientName: null,
    })),
    absencesToday: todayAbsences,
    existingEntries: todayEntries,
    hoursPerDay,
  };
}
