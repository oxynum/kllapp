import { db } from "@/lib/db";
import { calendarIntegrations, calendarShares } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { fetchCalendarEvents } from "@/lib/calendar/ical-service";
import type { OrgRole } from "@/lib/auth-context";
import type { ToolDefinition } from "./index";

export const getCalendarEventsTool: ToolDefinition = {
  name: "get_calendar_events",
  description:
    "Retrieve calendar events (from Google Calendar, Outlook, etc.) for the current user in a date range. Use this when the user asks about their agenda, meetings, or schedule.",
  input_schema: {
    type: "object" as const,
    properties: {
      start_date: {
        type: "string",
        description: "Start date (YYYY-MM-DD). Required.",
      },
      end_date: {
        type: "string",
        description: "End date (YYYY-MM-DD). Required.",
      },
    },
    required: ["start_date", "end_date"],
  },
  execute: async (
    params: Record<string, unknown>,
    ctx: { userId: string; organizationId: string; role: OrgRole }
  ) => {
    const { start_date, end_date } = params as {
      start_date: string;
      end_date: string;
    };

    // Fetch user's enabled calendars (own + shared with them)
    const calendars = await db
      .select({
        id: calendarIntegrations.id,
        label: calendarIntegrations.label,
        icsUrl: calendarIntegrations.icsUrl,
        provider: calendarIntegrations.provider,
      })
      .from(calendarIntegrations)
      .where(
        and(
          eq(calendarIntegrations.isEnabled, true),
          sql`(${calendarIntegrations.userId} = ${ctx.userId} OR EXISTS (
            SELECT 1 FROM calendar_shares
            WHERE calendar_shares.calendar_integration_id = ${calendarIntegrations.id}
            AND calendar_shares.shared_with_user_id = ${ctx.userId}
          ))`
        )
      );

    if (calendars.length === 0) {
      return { events: [], message: "No calendars configured." };
    }

    const from = new Date(start_date + "T00:00:00");
    const to = new Date(end_date + "T23:59:59.999");

    // Fetch events from all calendars in parallel
    const allEvents: Array<{
      calendar: string;
      summary: string;
      start: string;
      end: string;
      allDay: boolean;
      location?: string;
    }> = [];

    await Promise.all(
      calendars.map(async (cal) => {
        try {
          const events = await fetchCalendarEvents(cal.icsUrl, from, to);
          for (const evt of events) {
            allEvents.push({
              calendar: cal.label,
              summary: evt.summary,
              start: evt.start,
              end: evt.end,
              allDay: evt.allDay,
              location: evt.location,
            });
          }
        } catch {
          // Skip calendars that fail to fetch
        }
      })
    );

    // Sort by start date
    allEvents.sort((a, b) => a.start.localeCompare(b.start));

    return {
      events: allEvents,
      count: allEvents.length,
      range: { from: start_date, to: end_date },
    };
  },
};
