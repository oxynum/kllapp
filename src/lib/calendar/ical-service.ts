import * as ical from "node-ical";
import { createHash } from "crypto";
import { getRedis } from "@/lib/redis";

export interface CalendarEventInfo {
  uid: string;
  summary: string;
  description?: string;
  htmlDescription?: string;
  location?: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
}

// ─── SSRF protection ────────────────────────────────────────

const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^0\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
];

function isPrivateHost(hostname: string): boolean {
  return PRIVATE_IP_RANGES.some((re) => re.test(hostname));
}

export function validateAndNormalizeIcsUrl(url: string): string {
  let normalized = url.trim();

  // webcal:// → https://
  if (normalized.startsWith("webcal://")) {
    normalized = normalized.replace("webcal://", "https://");
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("URL invalide");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Seules les URLs HTTPS sont autorisées");
  }

  if (isPrivateHost(parsed.hostname)) {
    throw new Error("Les adresses IP privées ne sont pas autorisées");
  }

  return normalized;
}

// ─── Helpers ────────────────────────────────────────────────

function extractString(val: ical.ParameterValue | undefined): string | undefined {
  if (val === undefined) return undefined;
  if (typeof val === "string") return val;
  return val.val;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractHtmlDescription(event: any): string | undefined {
  // Outlook/Google often store HTML in X-ALT-DESC property
  const altDesc = event["X-ALT-DESC"] || event["x-alt-desc"];
  if (altDesc) {
    const val = typeof altDesc === "string" ? altDesc : altDesc.val;
    if (val && typeof val === "string") return val;
  }
  // Some providers embed HTML directly in DESCRIPTION
  const desc = extractString(event.description);
  if (desc && /<[a-z][\s\S]*>/i.test(desc)) return desc;
  return undefined;
}

function urlHash(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

function cacheKey(url: string): string {
  return `cal:ics:${urlHash(url)}`;
}

// ─── Fetch + parse ──────────────────────────────────────────

const ICS_CACHE_TTL = 900; // 15 minutes
const PARSED_CACHE_TTL = 300; // 5 minutes for parsed results
const FETCH_TIMEOUT = 10_000; // 10 seconds

async function fetchIcsText(url: string): Promise<string> {
  const redis = getRedis();

  // Try cache first
  if (redis) {
    try {
      const cached = await redis.get(cacheKey(url));
      if (cached) return cached;
    } catch {
      // Redis unavailable, continue without cache
    }
  }

  // Fetch
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Erreur HTTP ${res.status}`);
    }
    const text = await res.text();

    // Store in cache
    if (redis) {
      try {
        await redis.set(cacheKey(url), text, "EX", ICS_CACHE_TTL);
      } catch {
        // cache write failure is non-critical
      }
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchCalendarEvents(
  icsUrl: string,
  from: Date,
  to: Date
): Promise<CalendarEventInfo[]> {
  try {
    // Check parsed events cache
    const redis = getRedis();
    const hash = urlHash(icsUrl);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);
    const evtCacheKey = `cal:evt:${hash}:${fromStr}:${toStr}`;

    if (redis) {
      try {
        const cached = await redis.get(evtCacheKey);
        if (cached) return JSON.parse(cached);
      } catch { /* continue without cache */ }
    }

    const text = await fetchIcsText(icsUrl);
    const data = ical.parseICS(text);
    const results: CalendarEventInfo[] = [];

    for (const key of Object.keys(data)) {
      const comp = data[key];
      if (!comp || comp.type !== "VEVENT") continue;
      const event = comp as ical.VEvent;

      if (event.rrule) {
        // Recurring event — expand instances in range
        const instances = ical.expandRecurringEvent(event, {
          from,
          to,
          expandOngoing: true,
        });
        for (const instance of instances) {
          results.push({
            uid: event.uid + "_" + instance.start.toISOString(),
            summary: extractString(instance.summary) || "(sans titre)",
            description: extractString(instance.event.description),
            htmlDescription: extractHtmlDescription(instance.event),
            location: extractString(instance.event.location),
            start: instance.start.toISOString(),
            end: instance.end.toISOString(),
            allDay: instance.isFullDay,
          });
        }
      } else {
        // Single event — check if it overlaps the range
        const start = event.start;
        const end = event.end || event.start;
        if (end < from || start > to) continue;

        results.push({
          uid: event.uid,
          summary: extractString(event.summary) || "(sans titre)",
          description: extractString(event.description),
          htmlDescription: extractHtmlDescription(event),
          location: extractString(event.location),
          start: start.toISOString(),
          end: end.toISOString(),
          allDay: event.datetype === "date",
        });
      }
    }

    results.sort((a, b) => a.start.localeCompare(b.start));

    // Cache parsed events
    if (redis) {
      try {
        await redis.set(evtCacheKey, JSON.stringify(results), "EX", PARSED_CACHE_TTL);
      } catch { /* non-critical */ }
    }

    return results;
  } catch (err) {
    console.error("[ical-service] fetchCalendarEvents error:", err);
    return [];
  }
}

/**
 * Format a Date as YYYY-MM-DD in the given IANA timezone.
 * Uses Intl so no external dependency is needed.
 * The 'sv-SE' locale natively formats as YYYY-MM-DD.
 */
function dateStrInTz(d: Date, tz: string): string {
  return d.toLocaleDateString("sv-SE", { timeZone: tz });
}

/**
 * Returns the set of dates (YYYY-MM-DD) that have events in the given range.
 * Dates are returned in the caller's timezone so they match the frontend grid.
 */
export async function getEventDates(
  icsUrl: string,
  from: Date,
  to: Date,
  timezone: string = "UTC"
): Promise<string[]> {
  // Check dates cache
  const redis = getRedis();
  const hash = urlHash(icsUrl);
  const year = from.getUTCFullYear();
  const datesCacheKey = `cal:dates:${hash}:${year}:${timezone}`;

  if (redis) {
    try {
      const cached = await redis.get(datesCacheKey);
      if (cached) return JSON.parse(cached);
    } catch { /* continue */ }
  }

  const events = await fetchCalendarEvents(icsUrl, from, to);
  const dates = new Set<string>();

  for (const event of events) {
    const start = new Date(event.start);
    const end = new Date(event.end);

    // For all-day events, iCal DTEND is exclusive (day after last day)
    const effectiveEnd = event.allDay
      ? new Date(end.getTime() - 1)
      : end;

    // Extract the date in the user's timezone for start and effective end
    const startDateStr = dateStrInTz(start, timezone);
    const endDateStr = dateStrInTz(effectiveEnd, timezone);

    // Add each day from start to end (inclusive)
    const cursor = new Date(startDateStr + "T12:00:00Z"); // noon UTC avoids DST edge cases
    const endCursor = new Date(endDateStr + "T12:00:00Z");

    while (cursor <= endCursor && cursor <= to) {
      if (cursor >= from) {
        dates.add(dateStrInTz(cursor, "UTC")); // cursor is already at noon UTC, safe to format as UTC
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  const result = Array.from(dates);

  // Cache dates
  if (redis) {
    try {
      await redis.set(datesCacheKey, JSON.stringify(result), "EX", PARSED_CACHE_TTL);
    } catch { /* non-critical */ }
  }

  return result;
}

/**
 * Invalidate all cached data for a given ICS URL (raw + parsed events + dates).
 */
export async function invalidateCalendarCache(icsUrl: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  const hash = urlHash(icsUrl);
  try {
    // Delete raw ICS cache
    await redis.del(`cal:ics:${hash}`);

    // Delete all parsed caches matching this URL hash
    const keys = await redis.keys(`cal:evt:${hash}:*`);
    const dateKeys = await redis.keys(`cal:dates:${hash}:*`);
    const allKeys = [...keys, ...dateKeys];
    if (allKeys.length > 0) {
      await redis.del(...allKeys);
    }
  } catch {
    // Non-critical
  }
}
