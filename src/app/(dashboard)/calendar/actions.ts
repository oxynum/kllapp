"use server";

import { requireOrgContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { calendarIntegrations, calendarShares } from "@/lib/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  validateAndNormalizeIcsUrl,
  fetchCalendarEvents,
  getEventDates,
  invalidateCalendarCache,
} from "@/lib/calendar/ical-service";
import type { CalendarEventInfo } from "@/types";

// ============================================================
// Create
// ============================================================

const createSchema = z.object({
  provider: z.enum(["google", "outlook", "apple", "other"]),
  icsUrl: z.string().min(1),
  label: z.string().min(1),
  color: z.string().nullable().optional(),
});

export async function createCalendarIntegration(formData: FormData) {
  const { appUserId, organizationId } = await requireOrgContext();

  const parsed = createSchema.parse({
    provider: formData.get("provider"),
    icsUrl: formData.get("icsUrl"),
    label: formData.get("label"),
    color: formData.get("color") || null,
  });

  // Validate and normalize URL (SSRF check + HTTPS)
  const normalizedUrl = validateAndNormalizeIcsUrl(parsed.icsUrl);

  // Test-fetch to verify the URL works
  const now = new Date();
  const testEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  await fetchCalendarEvents(normalizedUrl, now, testEnd);

  await db.insert(calendarIntegrations).values({
    userId: appUserId,
    organizationId,
    provider: parsed.provider,
    icsUrl: normalizedUrl,
    label: parsed.label,
    color: parsed.color,
  });

  revalidatePath("/");
}

// ============================================================
// Update
// ============================================================

const updateSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).optional(),
  color: z.string().nullable().optional(),
  isEnabled: z.boolean().optional(),
});

export async function updateCalendarIntegration(
  input: z.infer<typeof updateSchema>
) {
  const { appUserId } = await requireOrgContext();
  const parsed = updateSchema.parse(input);
  const { id, ...fields } = parsed;

  const set: Record<string, unknown> = {};
  if (fields.label !== undefined) set.label = fields.label;
  if (fields.color !== undefined) set.color = fields.color;
  if (fields.isEnabled !== undefined) set.isEnabled = fields.isEnabled;

  if (Object.keys(set).length > 0) {
    await db
      .update(calendarIntegrations)
      .set(set)
      .where(
        and(
          eq(calendarIntegrations.id, id),
          eq(calendarIntegrations.userId, appUserId)
        )
      );
  }

  revalidatePath("/");
}

// ============================================================
// Delete
// ============================================================

export async function deleteCalendarIntegration(id: string) {
  const { appUserId } = await requireOrgContext();

  await db
    .delete(calendarIntegrations)
    .where(
      and(
        eq(calendarIntegrations.id, id),
        eq(calendarIntegrations.userId, appUserId)
      )
    );

  revalidatePath("/");
}

// ============================================================
// Share / Unshare calendar
// ============================================================

export async function shareCalendar(input: {
  calendarIntegrationId: string;
  sharedWithUserId: string;
}) {
  const { appUserId } = await requireOrgContext();

  // Verify ownership
  const [integration] = await db
    .select({ userId: calendarIntegrations.userId })
    .from(calendarIntegrations)
    .where(eq(calendarIntegrations.id, input.calendarIntegrationId));

  if (!integration || integration.userId !== appUserId) {
    throw new Error("Not the owner of this calendar");
  }

  // Prevent sharing with self
  if (input.sharedWithUserId === appUserId) {
    throw new Error("Cannot share with yourself");
  }

  await db
    .insert(calendarShares)
    .values({
      calendarIntegrationId: input.calendarIntegrationId,
      sharedWithUserId: input.sharedWithUserId,
    })
    .onConflictDoNothing();

  revalidatePath("/");
}

export async function unshareCalendar(input: {
  calendarIntegrationId: string;
  sharedWithUserId: string;
}) {
  const { appUserId } = await requireOrgContext();

  // Verify ownership
  const [integration] = await db
    .select({ userId: calendarIntegrations.userId })
    .from(calendarIntegrations)
    .where(eq(calendarIntegrations.id, input.calendarIntegrationId));

  if (!integration || integration.userId !== appUserId) {
    throw new Error("Not the owner of this calendar");
  }

  await db
    .delete(calendarShares)
    .where(
      and(
        eq(calendarShares.calendarIntegrationId, input.calendarIntegrationId),
        eq(calendarShares.sharedWithUserId, input.sharedWithUserId)
      )
    );

  revalidatePath("/");
}

// ============================================================
// Fetch events for a specific day
// ============================================================

export async function getCalendarEventsForDay(input: {
  integrationId: string;
  date: string;
}): Promise<CalendarEventInfo[]> {
  const { appUserId } = await requireOrgContext();

  // Allow owner OR shared-with user
  const [integration] = await db
    .select({ icsUrl: calendarIntegrations.icsUrl })
    .from(calendarIntegrations)
    .where(
      and(
        eq(calendarIntegrations.id, input.integrationId),
        sql`(${calendarIntegrations.userId} = ${appUserId} OR EXISTS (
          SELECT 1 FROM calendar_shares
          WHERE calendar_shares.calendar_integration_id = ${calendarIntegrations.id}
          AND calendar_shares.shared_with_user_id = ${appUserId}
        ))`
      )
    );

  if (!integration) return [];

  const dayStart = new Date(input.date + "T00:00:00");
  const dayEnd = new Date(input.date + "T23:59:59.999");

  return fetchCalendarEvents(integration.icsUrl, dayStart, dayEnd);
}

// ============================================================
// Get indicators (dates with events) for the grid
// ============================================================

export async function getCalendarIndicators(input: {
  integrationIds: string[];
  startDate: string;
  endDate: string;
  timezone?: string;
}): Promise<Record<string, string[]>> {
  const { appUserId } = await requireOrgContext();

  if (input.integrationIds.length === 0) return {};

  // Allow owner OR shared-with user
  const integrations = await db
    .select({
      id: calendarIntegrations.id,
      icsUrl: calendarIntegrations.icsUrl,
    })
    .from(calendarIntegrations)
    .where(
      and(
        inArray(calendarIntegrations.id, input.integrationIds),
        sql`(${calendarIntegrations.userId} = ${appUserId} OR EXISTS (
          SELECT 1 FROM calendar_shares
          WHERE calendar_shares.calendar_integration_id = ${calendarIntegrations.id}
          AND calendar_shares.shared_with_user_id = ${appUserId}
        ))`
      )
    );

  const from = new Date(input.startDate + "T00:00:00Z");
  const to = new Date(input.endDate + "T23:59:59.999Z");
  const tz = input.timezone || "UTC";

  const result: Record<string, string[]> = {};

  // Fetch in parallel
  await Promise.all(
    integrations.map(async (integration) => {
      result[integration.id] = await getEventDates(
        integration.icsUrl,
        from,
        to,
        tz
      );
    })
  );

  return result;
}

// ============================================================
// Refresh calendar cache
// ============================================================

export async function refreshCalendarCache(integrationId: string) {
  const { appUserId } = await requireOrgContext();

  const [integration] = await db
    .select({ icsUrl: calendarIntegrations.icsUrl })
    .from(calendarIntegrations)
    .where(
      and(
        eq(calendarIntegrations.id, integrationId),
        sql`(${calendarIntegrations.userId} = ${appUserId} OR EXISTS (
          SELECT 1 FROM calendar_shares
          WHERE calendar_shares.calendar_integration_id = ${calendarIntegrations.id}
          AND calendar_shares.shared_with_user_id = ${appUserId}
        ))`
      )
    );

  if (!integration) throw new Error("Calendar not found");

  await invalidateCalendarCache(integration.icsUrl);
  revalidatePath("/");
}
