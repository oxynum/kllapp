"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { CaretDown, MapPin, ArrowSquareOut, X, ArrowClockwise } from "@phosphor-icons/react";
import DOMPurify from "isomorphic-dompurify";
import { getCalendarEventsForDay, refreshCalendarCache } from "@/app/(dashboard)/calendar/actions";
import type { CalendarEventInfo } from "@/types";

interface CalendarEventsPanelProps {
  integrationId: string;
  integrationLabel: string;
  date: string; // YYYY-MM-DD
  color?: string | null;
  onClose: () => void;
  onEventSelect?: (event: CalendarEventInfo | null) => void;
}

// ─── Constants ────────────────────────────────────────────
const HOUR_HEIGHT = 60;
const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 22;
const TIME_LABEL_WIDTH = 28;

// ─── Color helpers ────────────────────────────────────────
const DEFAULT_COLOR = "#06b6d4";

function resolveColor(color?: string | null): string {
  return color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_COLOR;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── Linkify plain text ────────────────────────────────────
const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;

function linkifyText(text: string): string {
  return text.replace(URL_RE, (url) => {
    const display = url.length > 50 ? url.slice(0, 47) + "…" : url;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-cyan-600 underline hover:text-cyan-700">${display}</a>`;
  });
}

// ─── Sanitize HTML description using DOMPurify ─────────────
const PURIFY_CONFIG = {
  ALLOWED_TAGS: ["a", "b", "br", "em", "i", "li", "ol", "p", "span", "strong", "u", "ul", "div"],
  ALLOWED_ATTR: ["href", "target", "rel", "class"],
  ADD_ATTR: ["target"],
};

function sanitizeDescription(html?: string, plainText?: string): string | null {
  if (!html && !plainText) return null;

  if (html) {
    let clean = DOMPurify.sanitize(html, PURIFY_CONFIG);
    clean = clean.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" class="text-cyan-600 underline hover:text-cyan-700" ');
    return clean;
  }

  const escaped = (plainText ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const linked = linkifyText(escaped);
  return DOMPurify.sanitize(linked.replace(/\n/g, "<br>"), PURIFY_CONFIG);
}

// ─── Google Maps link ──────────────────────────────────────
function mapsUrl(location: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(location)}`;
}

// ─── Layout helpers ────────────────────────────────────────

interface EventPosition {
  top: number;
  height: number;
}

interface LayoutInfo {
  column: number;
  totalColumns: number;
}

function eventToPosition(event: CalendarEventInfo, startHour: number): EventPosition {
  const start = new Date(event.start);
  const end = new Date(event.end);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const top = ((startMinutes - startHour * 60) * HOUR_HEIGHT) / 60;
  const height = Math.max(((endMinutes - startMinutes) * HOUR_HEIGHT) / 60, HOUR_HEIGHT / 4);
  return { top, height };
}

function computeOverlapLayout(timedEvents: CalendarEventInfo[]): Map<string, LayoutInfo> {
  const sorted = [...timedEvents].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const layoutMap = new Map<string, LayoutInfo>();

  const clusters: CalendarEventInfo[][] = [];
  let currentCluster: CalendarEventInfo[] = [];
  let clusterEnd = -Infinity;

  for (const event of sorted) {
    const start = new Date(event.start).getTime();
    const end = new Date(event.end).getTime();

    if (start < clusterEnd) {
      currentCluster.push(event);
      clusterEnd = Math.max(clusterEnd, end);
    } else {
      if (currentCluster.length > 0) clusters.push(currentCluster);
      currentCluster = [event];
      clusterEnd = end;
    }
  }
  if (currentCluster.length > 0) clusters.push(currentCluster);

  for (const cluster of clusters) {
    const columns: number[] = [];
    for (const event of cluster) {
      const start = new Date(event.start).getTime();
      let col = columns.findIndex((colEnd) => colEnd <= start);
      if (col === -1) {
        col = columns.length;
        columns.push(0);
      }
      columns[col] = new Date(event.end).getTime();
      layoutMap.set(event.uid, { column: col, totalColumns: 0 });
    }
    const totalColumns = columns.length;
    for (const event of cluster) {
      layoutMap.get(event.uid)!.totalColumns = totalColumns;
    }
  }

  return layoutMap;
}

function computeHourRange(timedEvents: CalendarEventInfo[]): [number, number] {
  let minHour = DEFAULT_START_HOUR;
  let maxHour = DEFAULT_END_HOUR;
  for (const event of timedEvents) {
    const startH = new Date(event.start).getHours();
    const endDate = new Date(event.end);
    const endH = endDate.getHours() + (endDate.getMinutes() > 0 ? 1 : 0);
    if (startH < minHour) minHour = startH;
    if (endH > maxHour) maxHour = endH;
  }
  return [minHour, maxHour];
}

// ─── All-day section ───────────────────────────────────────
function AllDaySection({
  events,
  selectedId,
  onSelect,
  accentColor,
  t,
}: {
  events: CalendarEventInfo[];
  selectedId: string | null;
  onSelect: (uid: string) => void;
  accentColor: string;
  t: (key: string) => string;
}) {
  if (events.length === 0) return null;

  return (
    <div
      className="mx-4 mb-2 rounded-lg px-2 py-1.5 space-y-1"
      style={{ backgroundColor: hexToRgba(accentColor, 0.08) }}
    >
      {events.map((event) => {
        const isSelected = selectedId === event.uid;
        return (
          <button
            key={event.uid}
            type="button"
            onClick={() => onSelect(event.uid)}
            className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] transition-colors"
            style={{
              backgroundColor: isSelected ? hexToRgba(accentColor, 0.18) : undefined,
              boxShadow: isSelected ? `0 0 0 2px ${accentColor}` : undefined,
            }}
          >
            <CaretDown
              size={10}
              weight="bold"
              className={`shrink-0 transition-transform ${isSelected ? "" : "-rotate-90"}`}
              style={{ color: accentColor }}
            />
            <span className="truncate font-medium text-gray-800">{event.summary}</span>
            <span className="ml-auto shrink-0 text-[9px]" style={{ color: hexToRgba(accentColor, 0.7) }}>
              {t("allDay")}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Now indicator ─────────────────────────────────────────
function NowIndicator({ startHour, endHour }: { startHour: number; endHour: number }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const rangeStart = startHour * 60;
  const rangeEnd = endHour * 60;

  if (currentMinutes < rangeStart || currentMinutes > rangeEnd) return null;

  const top = ((currentMinutes - rangeStart) * HOUR_HEIGHT) / 60;

  return (
    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top }}>
      <div className="flex items-center">
        <div className="h-2 w-2 rounded-full bg-red-400 -ml-1" />
        <div className="flex-1 border-t-2 border-red-400" />
      </div>
    </div>
  );
}

// ─── Event block in timeline ───────────────────────────────
function EventBlock({
  event,
  position,
  layout,
  isSelected,
  accentColor,
  onSelect,
}: {
  event: CalendarEventInfo;
  position: EventPosition;
  layout: LayoutInfo;
  isSelected: boolean;
  accentColor: string;
  onSelect: () => void;
}) {
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  const widthPercent = 100 / layout.totalColumns;
  const leftPercent = layout.column * widthPercent;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`absolute rounded-r border-l-2 px-1.5 py-0.5 text-left transition-all overflow-hidden hover:shadow-sm ${
        isSelected ? "z-10" : "z-[1]"
      }`}
      style={{
        top: position.top,
        height: position.height,
        left: `${leftPercent}%`,
        width: `calc(${widthPercent}% - 2px)`,
        backgroundColor: hexToRgba(accentColor, isSelected ? 0.25 : 0.14),
        borderLeftColor: accentColor,
        boxShadow: isSelected ? `0 0 0 2px ${accentColor}` : undefined,
      }}
    >
      <p className="text-[10px] font-medium text-gray-800 truncate leading-tight">
        {event.summary}
      </p>
      {position.height >= HOUR_HEIGHT / 2 && (
        <p className="text-[9px] text-gray-500 truncate leading-tight">
          {formatTime(event.start)}
        </p>
      )}
    </button>
  );
}

// ─── Event detail (exported for use in SheetPanel fold-out) ─
export function CalendarEventDetail({
  event,
  color,
  onClose,
}: {
  event: CalendarEventInfo;
  color?: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("calendar");
  const accentColor = resolveColor(color);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  // All HTML is sanitized through DOMPurify before rendering
  const descriptionHtml = useMemo(
    () => sanitizeDescription(event.htmlDescription, event.description),
    [event.htmlDescription, event.description]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Color bar top */}
      <div className="h-1 flex-shrink-0" style={{ backgroundColor: accentColor }} />

      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 break-words leading-tight">{event.summary}</p>
          <p className="mt-0.5 text-[11px] text-gray-500">
            {event.allDay
              ? t("allDay")
              : `${formatTime(event.start)} – ${formatTime(event.end)}`}
          </p>
        </div>
        <button
          onClick={onClose}
          className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X size={14} weight="bold" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {event.location && (
          <a
            href={mapsUrl(event.location)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-1.5 rounded-md bg-gray-50 px-2.5 py-2 text-[11px] text-gray-600 transition-colors hover:text-gray-800 border border-gray-100"
            style={{ ["--hover-bg" as string]: hexToRgba(accentColor, 0.08) }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hexToRgba(accentColor, 0.08))}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
          >
            <MapPin size={13} weight="fill" className="mt-0.5 shrink-0" style={{ color: accentColor }} />
            <span className="flex-1 break-words">{event.location}</span>
            <ArrowSquareOut size={11} className="mt-0.5 shrink-0 text-gray-400" />
          </a>
        )}

        {descriptionHtml && (
          <div
            className="text-[11px] leading-relaxed text-gray-500 break-words [&_a]:text-cyan-600 [&_a]:underline [&_a:hover]:text-cyan-700"
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />
        )}

        {!event.location && !descriptionHtml && (
          <p className="text-[11px] text-gray-400 italic">{t("noDetails")}</p>
        )}
      </div>
    </div>
  );
}

// ─── Inline event detail (mobile fallback) ─────────────────
function InlineEventDetail({ event, accentColor }: { event: CalendarEventInfo; accentColor: string }) {
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  const descriptionHtml = useMemo(
    () => sanitizeDescription(event.htmlDescription, event.description),
    [event.htmlDescription, event.description]
  );

  return (
    <div
      className="mx-4 mb-3 rounded-lg border bg-white p-3 space-y-2"
      style={{ borderColor: hexToRgba(accentColor, 0.3) }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-gray-900 break-words">{event.summary}</p>
        {!event.allDay && (
          <span className="shrink-0 text-[10px]" style={{ color: accentColor }}>
            {formatTime(event.start)} – {formatTime(event.end)}
          </span>
        )}
      </div>

      {event.location && (
        <a
          href={mapsUrl(event.location)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-1.5 rounded-md bg-gray-50 px-2 py-1.5 text-[11px] text-gray-600 transition-colors hover:bg-cyan-50 hover:text-cyan-700 border border-gray-100"
        >
          <MapPin size={13} weight="fill" className="mt-0.5 shrink-0" style={{ color: accentColor }} />
          <span className="flex-1 break-words">{event.location}</span>
          <ArrowSquareOut size={11} className="mt-0.5 shrink-0 text-gray-400" />
        </a>
      )}

      {descriptionHtml && (
        <div
          className="text-[11px] leading-relaxed text-gray-500 break-words [&_a]:text-cyan-600 [&_a]:underline [&_a:hover]:text-cyan-700"
          dangerouslySetInnerHTML={{ __html: descriptionHtml }}
        />
      )}
    </div>
  );
}

// ─── Time grid ─────────────────────────────────────────────
function TimeGrid({
  timedEvents,
  isToday,
  selectedId,
  accentColor,
  onSelect,
}: {
  timedEvents: CalendarEventInfo[];
  isToday: boolean;
  selectedId: string | null;
  accentColor: string;
  onSelect: (uid: string) => void;
}) {
  const [startHour, endHour] = useMemo(() => computeHourRange(timedEvents), [timedEvents]);
  const totalHours = endHour - startHour;
  const gridHeight = totalHours * HOUR_HEIGHT;
  const layoutMap = useMemo(() => computeOverlapLayout(timedEvents), [timedEvents]);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gridRef.current) return;
    const scrollTo = isToday
      ? Math.max(((new Date().getHours() * 60 + new Date().getMinutes() - startHour * 60) * HOUR_HEIGHT) / 60 - 80, 0)
      : (Math.max(8, startHour) - startHour) * HOUR_HEIGHT;
    gridRef.current.scrollTop = scrollTo;
  }, [isToday, startHour]);

  const hours = Array.from({ length: totalHours + 1 }, (_, i) => startHour + i);

  return (
    <div ref={gridRef} className="flex-1 overflow-y-auto overflow-x-hidden">
      <div className="relative" style={{ height: gridHeight }}>
        {/* Hour lines */}
        {hours.map((hour) => {
          const top = (hour - startHour) * HOUR_HEIGHT;
          return (
            <div key={hour} className="absolute left-0 right-0" style={{ top }}>
              <div className="flex items-start">
                <span className="text-[10px] text-gray-300 leading-none -mt-[5px] tabular-nums" style={{ width: TIME_LABEL_WIDTH }}>
                  {String(hour).padStart(2, "0")}
                </span>
                <div className="flex-1 border-t border-gray-100" />
              </div>
            </div>
          );
        })}

        {/* Event blocks */}
        <div className="absolute top-0 bottom-0" style={{ left: TIME_LABEL_WIDTH, right: 4 }}>
          {timedEvents.map((event) => {
            const position = eventToPosition(event, startHour);
            const layout = layoutMap.get(event.uid) ?? { column: 0, totalColumns: 1 };
            return (
              <EventBlock
                key={event.uid}
                event={event}
                position={position}
                layout={layout}
                isSelected={selectedId === event.uid}
                accentColor={accentColor}
                onSelect={() => onSelect(event.uid)}
              />
            );
          })}
        </div>

        {/* Now indicator */}
        {isToday && (
          <div className="absolute" style={{ left: TIME_LABEL_WIDTH - 4, right: 0, top: 0, bottom: 0 }}>
            <NowIndicator startHour={startHour} endHour={endHour} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Client-side event cache (survives remounts, cleared on refresh) ───
const eventCache = new Map<string, { events: CalendarEventInfo[]; ts: number }>();
const CLIENT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ─── Main panel ────────────────────────────────────────────
export function CalendarEventsPanel({
  integrationId,
  integrationLabel,
  date,
  color,
  onClose,
  onEventSelect,
}: CalendarEventsPanelProps) {
  const t = useTranslations("calendar");
  const tCommon = useTranslations("common");
  const [events, setEvents] = useState<CalendarEventInfo[] | null>(null);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const accentColor = resolveColor(color);

  useEffect(() => {
    setError(false);
    setSelectedId(null);
    onEventSelect?.(null);

    const cacheKey = `${integrationId}:${date}`;
    const cached = eventCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CLIENT_CACHE_TTL) {
      setEvents(cached.events);
      return;
    }

    setEvents(null);
    getCalendarEventsForDay({ integrationId, date })
      .then((data) => {
        eventCache.set(cacheKey, { events: data, ts: Date.now() });
        setEvents(data);
      })
      .catch(() => setError(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrationId, date]);

  const formattedDate = new Date(date + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const isToday = date === new Date().toISOString().slice(0, 10);

  const { allDayEvents, timedEvents } = useMemo(() => {
    if (!events) return { allDayEvents: [], timedEvents: [] };
    return {
      allDayEvents: events.filter((e) => e.allDay),
      timedEvents: events.filter((e) => !e.allDay),
    };
  }, [events]);

  const selectedEvent = useMemo(
    () => events?.find((e) => e.uid === selectedId) ?? null,
    [events, selectedId]
  );

  const handleSelect = useCallback(
    (uid: string) => {
      setSelectedId((prev) => {
        const newId = prev === uid ? null : uid;
        const event = newId ? events?.find((e) => e.uid === newId) ?? null : null;
        onEventSelect?.(event);
        return newId;
      });
    },
    [events, onEventSelect]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-2">
        <div>
          <p className="text-xs font-medium" style={{ color: accentColor }}>{integrationLabel}</p>
          <p className="text-[11px] capitalize text-gray-500">{formattedDate}</p>
        </div>
        <button
          onClick={async () => {
            setEvents(null);
            eventCache.delete(`${integrationId}:${date}`);
            await refreshCalendarCache(integrationId);
            const fresh = await getCalendarEventsForDay({ integrationId, date });
            eventCache.set(`${integrationId}:${date}`, { events: fresh, ts: Date.now() });
            setEvents(fresh);
          }}
          className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          title="Rafraîchir"
        >
          <ArrowClockwise size={14} />
        </button>
      </div>

      {/* Loading */}
      {events === null && !error && (
        <div className="py-8 text-center text-xs text-gray-400">{tCommon("loading")}</div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {t("fetchError")}
        </div>
      )}

      {/* No events */}
      {events && events.length === 0 && (
        <div className="py-8 text-center text-xs text-gray-400">{t("noEvents")}</div>
      )}

      {/* Timeline view */}
      {events && events.length > 0 && (
        <>
          <AllDaySection
            events={allDayEvents}
            selectedId={selectedId}
            onSelect={handleSelect}
            accentColor={accentColor}
            t={t as unknown as (key: string) => string}
          />

          {timedEvents.length > 0 && (
            <TimeGrid
              timedEvents={timedEvents}
              isToday={isToday}
              selectedId={selectedId}
              accentColor={accentColor}
              onSelect={handleSelect}
            />
          )}

          {/* Inline detail for mobile (when no onEventSelect callback) */}
          {!onEventSelect && selectedEvent && (
            <InlineEventDetail event={selectedEvent} accentColor={accentColor} />
          )}
        </>
      )}
    </div>
  );
}
