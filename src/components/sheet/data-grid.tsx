"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DataEditor, {
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  EditableGridCell,
  EditListItem,
  Theme,
  type DrawCellCallback,
  type DrawHeaderCallback,
  type CellClickedEventArgs,
  type GridMouseEventArgs,
  type Rectangle,
  type DataEditorRef,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import type { CellData } from "@/lib/db/queries/sheet-data";
import {
  getDaysOfYear,
  isWorkingDay,
} from "@/lib/utils/dates";
import { format, getMonth, getDay } from "date-fns";
import { useTranslations, useLocale } from "next-intl";
import { getDateLocale } from "@/i18n/date-locale";
import { updateCellAction, updateNoteAction, createExpenseAction, deleteExpenseAction, upsertForecastAction } from "@/app/(dashboard)/sheet/actions";
import { setUserWorkplace, removeUserWorkplace } from "@/app/(dashboard)/workplace/actions";
import { CellContextMenu } from "./cell-context-menu";
import { CommentPopover } from "./comment-popover";
import { ExpensePopover } from "./expense-popover";
import { SheetHeader } from "./sheet-header";
import { MobileHeader } from "./mobile-header";
import type { SheetRow, DependencyInfo, SheetFilters, ClientInfo, ProjectInfo, UserInfo, ExpenseData, WorkplaceInfo } from "@/types";
import type { OrgRole } from "@/lib/auth-context";
import { useDisplayMode } from "./display-mode-context";
import { GanttDependencyOverlay } from "./gantt-dependency-overlay";
import { useDependencyDrag } from "./hooks/use-dependency-drag";
import {
  labelCellRenderer,
  type LabelCell,
  type LabelCellData,
} from "./renderers/label-cell-renderer";
import { PathArrow } from "iconoir-react";
import { PALETTE } from "@/lib/colors";
import { useUpdateMyPresence, useOthers } from "@liveblocks/react/suspense";

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const CLIENT_COLORS = PALETTE;

const customTheme: Partial<Theme> = {
  accentColor: "#111827",
  accentLight: "#f3f4f6",
  borderColor: "#f3f4f6",
  headerBottomBorderColor: "#e5e7eb",
  horizontalBorderColor: "#f9fafb",
  bgHeader: "#ffffff",
  bgHeaderHasFocus: "#f9fafb",
  bgHeaderHovered: "#f9fafb",
  textHeader: "#6b7280",
  textDark: "#111827",
  textMedium: "#6b7280",
  textLight: "#d1d5db",
  bgCell: "#ffffff",
  bgCellMedium: "#f9fafb",
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  headerFontStyle: "500 11px",
  baseFontStyle: "13px",
  cellHorizontalPadding: 6,
  cellVerticalPadding: 4,
  lineHeight: 1.5,
};

const customRenderers = [labelCellRenderer];

function fmt2(n: number): string {
  return parseFloat(n.toFixed(2)).toString();
}

/** Draw vertical stripe hatches inside a rectangle (clipped). */
function drawHatchedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  alpha: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // Light background fill
  ctx.globalAlpha = alpha * 0.15;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);

  // Vertical lines
  ctx.globalAlpha = alpha * 0.35;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  const spacing = 5;
  for (let lx = x + spacing / 2; lx < x + w; lx += spacing) {
    ctx.beginPath();
    ctx.moveTo(lx, y);
    ctx.lineTo(lx, y + h);
    ctx.stroke();
  }

  ctx.restore();
}

export interface SheetDataGridProps {
  rows: SheetRow[];
  year: number;
  onAssignUser?: (projectId: string, projectName: string, clientName: string) => void;
  onAddProject?: (clientId: string, clientName: string) => void;
  onUserDetail?: (userId: string, projectId: string, userName: string) => void;
  onAddSubProject?: (projectId: string, projectName: string, clientName: string) => void;
  onProjectDetail?: (projectId: string, projectName: string, clientName: string) => void;
  onClientDetail?: (clientId: string, clientName: string) => void;
  onSelectProject?: (projectId: string, label: string) => void;
  onSelectClient?: (clientId: string, label: string) => void;
  onAddClient?: () => void;
  onAddUser?: () => void;
  onAddAbsenceClient?: () => void;
  onAddAbsenceType?: (clientId: string, clientName: string) => void;
  onAssignAbsenceUser?: (projectId: string, projectName: string, clientName: string) => void;
  onAbsenceClientDetail?: (clientId: string, clientName: string) => void;
  onAbsenceTypeDetail?: (projectId: string, projectName: string, clientName: string) => void;
  onAddCalendar?: () => void;
  onCalendarDetail?: (integrationId: string, integrationLabel: string) => void;
  onCalendarEvents?: (integrationId: string, integrationLabel: string, date: string) => void;
  calendarIndicators?: Record<string, string[]>;
  allDependencies?: DependencyInfo[];
  userName?: string;
  userImage?: string | null;
  currentOrgId?: string;
  currentOrgName?: string;
  userOrganizations?: { id: string; name: string }[];
  userRole?: OrgRole;
  pendingInvitations?: Array<{
    membershipId: string;
    orgId: string;
    orgName: string;
    role: string | null;
    invitedAt: Date | null;
  }>;
  allClients?: ClientInfo[];
  allProjects?: ProjectInfo[];
  allUsers?: UserInfo[];
  filters?: SheetFilters;
  onFiltersChange?: (filters: SheetFilters) => void;
  isMobile?: boolean;
  weekDays?: Date[];
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  onTodayWeek?: () => void;
  weekLabel?: string;
  expenseMap?: Record<string, ExpenseData[]>;
  expenseCategories?: { id: string; name: string }[];
  onExpenseCreated?: () => void;
  onExpenseDeleted?: () => void;
  allWorkplaces?: WorkplaceInfo[];
  userWorkplaceMap?: Record<string, string>;
  onBookDesk?: (userId: string, date: string, workplaceId: string, userName: string) => void;
  cells: Record<string, CellData>;
  onUpdateCell: (cellKey: string, value: string, note?: string | null) => void;
  onUpdateNote: (cellKey: string, note: string | null) => void;
}

export function SheetDataGrid({
  rows,
  year,
  onAssignUser,
  onAddProject,
  onUserDetail,
  onAddSubProject,
  onProjectDetail,
  onClientDetail,
  onSelectProject,
  onSelectClient,
  onAddClient,
  onAddUser,
  onAddAbsenceClient,
  onAddAbsenceType,
  onAssignAbsenceUser,
  onAbsenceClientDetail,
  onAbsenceTypeDetail,
  onAddCalendar,
  onCalendarDetail,
  onCalendarEvents,
  calendarIndicators,
  allDependencies,
  userName,
  userImage,
  currentOrgId,
  currentOrgName,
  userOrganizations,
  userRole,
  pendingInvitations,
  allClients,
  allProjects,
  allUsers,
  filters,
  onFiltersChange,
  isMobile,
  weekDays,
  onPrevWeek,
  onNextWeek,
  onTodayWeek,
  weekLabel,
  expenseMap,
  expenseCategories,
  onExpenseCreated,
  onExpenseDeleted,
  allWorkplaces = [],
  userWorkplaceMap = {},
  onBookDesk,
  cells: cellsData,
  onUpdateCell,
  onUpdateNote,
}: SheetDataGridProps) {
  const canManage = userRole === "admin" || userRole === "manager";
  const t = useTranslations("header");
  const tGrid = useTranslations("grid");
  const tExpense = useTranslations("expense");
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const weekdayAbbr = WEEKDAY_KEYS.map((key) => tGrid(`weekdays.${key}`));

  // Liveblocks presence hooks
  const updateMyPresence = useUpdateMyPresence();
  const others = useOthers();
  const [followingUserId, setFollowingUserId] = useState<string | null>(null);
  const [availabilityUserId, setAvailabilityUserId] = useState<string | null>(null);

  const [activeMonth, setActiveMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(year);
  const gridRef = useRef<DataEditorRef>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const { displayMode, setDisplayMode, viewMode, setViewMode } = useDisplayMode();

  const [isLabelColFocused, setIsLabelColFocused] = useState(false);
  const [linkMode, setLinkMode] = useState(false);

  const fullYearDays = useMemo(() => getDaysOfYear(currentYear), [currentYear]);
  const activeDays = isMobile && weekDays ? weekDays : fullYearDays;
  const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 768);
  useEffect(() => {
    if (!isMobile) return;
    const handler = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [isMobile]);

  const visibleRows = useMemo(() => {
    let filtered: SheetRow[];
    if (viewMode === "gantt") {
      filtered = rows.filter(
        (r) => r.type === "client" || r.type === "project" || r.type === "sub-project"
      );
    } else {
      filtered = rows;
    }

    if (!canManage) return filtered;

    // Split into regular, absence, and calendar rows
    const regularRows = filtered.filter((r) => !r.isAbsence && r.type !== "calendar" && r.type !== "add-calendar-placeholder");
    const absenceRows = filtered.filter((r) => r.isAbsence);
    const calendarRows = filtered.filter((r) => r.type === "calendar" || r.type === "add-calendar-placeholder");

    // Calendar rows at the top for quick access without scrolling
    const result: SheetRow[] = [];
    for (const r of calendarRows) {
      result.push(r);
    }

    // Insert add-client-placeholder after each regular client group
    // If no clients exist, add the placeholder at the top (empty state)
    if (regularRows.length === 0 && canManage) {
      result.push({
        id: "add-client-placeholder:empty",
        type: "add-client-placeholder",
        label: "",
        depth: 0,
      });
    }
    for (let i = 0; i < regularRows.length; i++) {
      result.push(regularRows[i]);
      const current = regularRows[i];
      const next = regularRows[i + 1];
      if (
        current.type !== "add-client-placeholder" &&
        (current.type === "client" || current.clientId) &&
        (!next || next.type === "client")
      ) {
        result.push({
          id: `add-client-placeholder:${i}`,
          type: "add-client-placeholder",
          label: "",
          depth: 0,
        });
      }
    }

    // Add absence rows
    for (const r of absenceRows) {
      result.push(r);
    }

    // Add absence placeholder
    result.push({
      id: `add-absence-placeholder`,
      type: "add-absence-placeholder",
      label: "",
      depth: 0,
      isAbsence: true,
    });

    return result;
  }, [rows, viewMode, canManage]);

  const { dragState, ganttDragPreview } = useDependencyDrag({
    ganttRows: visibleRows,
    days: activeDays,
    gridContainerRef,
    viewMode,
    linkMode,
  });

  const clientColorMap = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const row of rows) {
      if ((row.type === "client" || row.type === "absence-client") && row.clientId && !map.has(row.clientId)) {
        map.set(row.clientId, idx % CLIENT_COLORS.length);
        idx++;
      }
    }
    return map;
  }, [rows]);

  const cellsSnapshot = useMemo(() => {
    const result: Record<string, string> = {};
    for (const [key, cell] of Object.entries(cellsData)) {
      result[key] = cell.value;
    }
    return result;
  }, [cellsData]);

  // Per-user daily totals for cross-project overallocation detection
  const userDayTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const [key, val] of Object.entries(cellsSnapshot)) {
      const numVal = Number(val);
      if (!numVal || numVal <= 0) continue;
      const firstColon = key.indexOf(":");
      const userId = key.substring(0, firstColon);
      const dateStr = key.substring(key.length - 10);
      const totalKey = `${userId}:${dateStr}`;
      totals.set(totalKey, (totals.get(totalKey) ?? 0) + numVal);
    }
    return totals;
  }, [cellsSnapshot]);

  // Budget consumption per project (for label gauge)
  // Budget is in € — compare CA réalisé (days × dailyRate) vs budget €
  const projectBudgetData = useMemo(() => {
    const map = new Map<string, { pct: number; consumed: number; budget: number; unit: string }>();
    for (const row of rows) {
      if ((row.type !== "project" && row.type !== "sub-project") || !row.budget || !row.projectId) continue;

      // Sum consumed days for this project
      let consumedDays = 0;
      for (const [key, val] of Object.entries(cellsSnapshot)) {
        if (key.startsWith("forecast:")) continue;
        const parts = key.split(":");
        if (parts[1] === row.projectId) consumedDays += Number(val) || 0;
      }

      // Budget in € → compare revenue (days × rate) vs budget
      if (row.dailyRate && row.dailyRate > 0) {
        const revenue = consumedDays * row.dailyRate;
        map.set(row.projectId, {
          pct: revenue / row.budget,
          consumed: Math.round(revenue),
          budget: row.budget,
          unit: "€",
        });
      } else {
        // No rate → compare raw days vs budget (assume budget is in days)
        map.set(row.projectId, {
          pct: consumedDays / row.budget,
          consumed: Math.round(consumedDays * 10) / 10,
          budget: row.budget,
          unit: "j",
        });
      }
    }
    return map;
  }, [rows, cellsSnapshot]);

  // Availability per day for selected user (fill bars in headers)
  const availabilityByDay = useMemo(() => {
    if (!availabilityUserId) return null;
    const map = new Map<string, number>();
    const prefix = availabilityUserId + ":";
    for (const [key, val] of userDayTotals) {
      if (key.startsWith(prefix)) {
        const dateStr = key.substring(prefix.length);
        map.set(dateStr, val);
      }
    }
    return map;
  }, [availabilityUserId, userDayTotals]);

  // Remote cursors indexed by "col:row" for fast lookup in drawCell
  const otherCursors = useMemo(() => {
    const map = new Map<string, { name: string; color: string }[]>();
    for (const other of others) {
      const cursor = other.presence.cursor;
      if (!cursor) continue;
      const key = `${cursor.col}:${cursor.row}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ name: other.info.name, color: other.info.color });
    }
    return map;
  }, [others]);

  const notesSnapshot = useMemo(() => {
    const result: Record<string, string> = {};
    for (const [key, cell] of Object.entries(cellsData)) {
      if (cell.note) result[key] = cell.note;
    }
    return result;
  }, [cellsData]);

  // Map projectId → last date with logged work (for Gantt margin/overflow indicators)
  const lastWorkDateMap = useMemo(() => {
    const map = new Map<string, string>();

    // Build sub-project → parent project lookup
    const subToParent = new Map<string, string>();
    for (const row of rows) {
      if (row.type === "sub-project" && row.projectId && row.parentId) {
        const parentId = row.parentId.replace("project:", "");
        subToParent.set(row.projectId, parentId);
      }
    }

    for (const key of Object.keys(cellsSnapshot ?? {})) {
      const val = parseFloat(cellsSnapshot[key]);
      if (!val || val <= 0) continue;
      const parts = key.split(":");
      if (parts.length !== 3) continue;
      const projectId = parts[1];
      const dateStr = parts[2];

      const cur = map.get(projectId);
      if (!cur || dateStr > cur) map.set(projectId, dateStr);

      // Propagate to parent project
      const parentId = subToParent.get(projectId);
      if (parentId) {
        const curParent = map.get(parentId);
        if (!curParent || dateStr > curParent) map.set(parentId, dateStr);
      }
    }

    return map;
  }, [cellsSnapshot, rows]);

  // Optimistic cell updates (via parent state)
  const updateLocalCell = useCallback(
    (cellKey: string, value: string) => {
      onUpdateCell(cellKey, value);
    },
    [onUpdateCell]
  );

  const updateLocalNote = useCallback(
    (cellKey: string, note: string | null) => {
      onUpdateNote(cellKey, note);
    },
    [onUpdateNote]
  );

  // Context menu & comment states
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    cellKey: string;
    userId: string;
    projectId: string;
    dateStr: string;
    hasNote: boolean;
  } | null>(null);

  const [commentPopover, setCommentPopover] = useState<{
    x: number;
    y: number;
    cellKey: string;
    userId: string;
    projectId: string;
    dateStr: string;
    initialNote: string;
  } | null>(null);

  const [expensePopover, setExpensePopover] = useState<{
    x: number;
    y: number;
    cellKey: string;
    userId: string;
    projectId: string;
    dateStr: string;
  } | null>(null);

  const [hoveredNote, setHoveredNote] = useState<{
    x: number;
    y: number;
    note: string;
  } | null>(null);

  // Month groups for header grouping
  const monthGroups = useMemo(() => {
    if (isMobile) {
      // Single group covering label + 7 days (no month header on mobile)
      return [{ name: "", span: 1 + activeDays.length }];
    }

    const groups: { name: string; span: number }[] = [];
    let currentMonthIdx = -1;
    let count = 0;

    for (const day of activeDays) {
      const m = getMonth(day);
      if (m !== currentMonthIdx) {
        if (count > 0) {
          groups.push({
            name: format(activeDays[activeDays.indexOf(day) - 1], "MMMM", { locale: dateLocale }),
            span: count,
          });
        }
        currentMonthIdx = m;
        count = 1;
      } else {
        count++;
      }
    }
    // Push last month
    if (count > 0) {
      groups.push({
        name: format(activeDays[activeDays.length - 1], "MMMM", { locale: dateLocale }),
        span: count,
      });
    }

    return [{ name: "", span: 1 }, ...groups]; // +1 for label column
  }, [activeDays, dateLocale, isMobile]);

  const columns = useMemo<GridColumn[]>(() => {
    const labelWidth = isMobile ? 120 : 220;
    const labelCol: GridColumn = {
      title: "",
      id: "label",
      width: labelWidth,
      group: "",
    };

    const dayColWidth = isMobile
      ? Math.floor((windowWidth - labelWidth) / 7)
      : 44;

    const dayCols: GridColumn[] = activeDays.map((day) => {
      const dayOfWeek = getDay(day);
      const dayNum = format(day, "d");
      const weekdayAbbrStr = weekdayAbbr[dayOfWeek];
      const monthName = format(day, "MMMM", { locale: dateLocale });

      return {
        title: `${weekdayAbbrStr}\n${dayNum}`,
        id: format(day, "yyyy-MM-dd"),
        width: dayColWidth,
        group: isMobile ? "" : monthName,
      };
    });

    return [labelCol, ...dayCols];
  }, [activeDays, dateLocale, weekdayAbbr, isMobile, windowWidth]);

  // Find the internal GDG scroll container for smooth scrolling
  const getScrollContainer = useCallback((): HTMLElement | null => {
    if (!gridContainerRef.current) return null;
    const scroller = gridContainerRef.current.querySelector(".dvn-scroller") as HTMLElement | null;
    if (scroller) return scroller;
    // Fallback: find any horizontally scrollable div
    const divs = gridContainerRef.current.querySelectorAll("div");
    for (const div of divs) {
      if (div.scrollWidth > div.clientWidth + 50) return div;
    }
    return null;
  }, []);

  const DAY_COL_WIDTH = 44;

  // Scroll to month (smooth) — desktop only
  const scrollToMonth = useCallback(
    (monthIdx: number) => {
      if (isMobile) return;
      setActiveMonth(monthIdx);
      const firstDayOfMonth = activeDays.findIndex((d) => getMonth(d) === monthIdx);
      if (firstDayOfMonth < 0) return;

      const container = getScrollContainer();
      if (container) {
        container.scrollTo({
          left: firstDayOfMonth * DAY_COL_WIDTH,
          behavior: "smooth",
        });
      } else if (gridRef.current) {
        gridRef.current.scrollTo(firstDayOfMonth + 1, 0, "both", 0, 0, {
          hAlign: "start",
        });
      }
    },
    [activeDays, getScrollContainer, isMobile]
  );

  // Sync active month tab when user scrolls horizontally — desktop only
  const onVisibleRegionChanged = useCallback(
    (range: Rectangle) => {
      if (!isMobile) {
        const centerCol = range.x + Math.floor(range.width / 2);
        const dayIdx = centerCol - 1;
        if (dayIdx >= 0 && dayIdx < activeDays.length) {
          const monthIdx = getMonth(activeDays[dayIdx]);
          setActiveMonth(monthIdx);
        }
      }
      updateMyPresence({ visibleRegion: { x: range.x, y: range.y, width: range.width, height: range.height } });
    },
    [activeDays, isMobile, updateMyPresence]
  );

  const scrollToToday = useCallback(() => {
    if (isMobile) return; // mobile uses week navigation instead
    const today = new Date();
    const todayMonth = getMonth(today);
    setActiveMonth(todayMonth);
    const todayStr = format(today, "yyyy-MM-dd");
    const colIdx = activeDays.findIndex(
      (d) => format(d, "yyyy-MM-dd") === todayStr
    );
    if (colIdx < 0) return;

    const container = getScrollContainer();
    if (container) {
      const targetLeft = colIdx * DAY_COL_WIDTH - container.clientWidth / 2 + DAY_COL_WIDTH / 2;
      container.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: "smooth",
      });
    } else if (gridRef.current) {
      gridRef.current.scrollTo(colIdx + 1, 0, "both", 0, 0, {
        hAlign: "center",
      });
    }
  }, [activeDays, getScrollContainer, isMobile]);

  // Follow mode: sync scroll with followed user + stop if disconnected
  const isFollowScrollRef = useRef(false);
  const followedUser = followingUserId ? others.find(o => o.id === followingUserId) : undefined;

  useEffect(() => {
    if (!followingUserId || !followedUser) return;
    if (!followedUser.presence.visibleRegion) return;
    const { x, y } = followedUser.presence.visibleRegion;
    isFollowScrollRef.current = true;
    gridRef.current?.scrollTo(x, y, "both", 0, 0, { hAlign: "start", vAlign: "start" });
  }, [followingUserId, followedUser]);

  // Stop following when user scrolls manually or followed user disconnects
  useEffect(() => {
    if (!followingUserId) return;

    // User disconnected
    if (!followedUser) {
      // Use queueMicrotask to avoid setState-in-effect lint
      queueMicrotask(() => setFollowingUserId(null));
      return;
    }

    const container = getScrollContainer();
    if (!container) return;
    const handleScroll = () => {
      if (isFollowScrollRef.current) {
        isFollowScrollRef.current = false;
        return;
      }
      setFollowingUserId(null);
    };
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [followingUserId, followedUser, getScrollContainer]);

  // Scroll to today on initial mount (desktop only)
  const hasScrolledToToday = useRef(false);
  useEffect(() => {
    if (isMobile || hasScrolledToToday.current) return;
    hasScrolledToToday.current = true;

    const today = new Date();
    setActiveMonth(getMonth(today));
    const todayFmt = format(today, "yyyy-MM-dd");
    const colIdx = activeDays.findIndex((d) => format(d, "yyyy-MM-dd") === todayFmt);
    if (colIdx < 0) return;

    // Retry until the scroll container is mounted AND has a real width
    // In production, Liveblocks ClientSideSuspense delays the grid mount
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tryScroll = () => {
      attempts++;
      const container = getScrollContainer();
      if (container && container.clientWidth > 0 && container.scrollWidth > container.clientWidth) {
        const targetLeft = colIdx * DAY_COL_WIDTH - container.clientWidth / 2 + DAY_COL_WIDTH / 2;
        container.scrollTo({ left: Math.max(0, targetLeft) });
      } else if (attempts < 50) {
        timer = setTimeout(tryScroll, 100);
      }
    };
    timer = setTimeout(tryScroll, 150);
    return () => clearTimeout(timer);
  }, [activeDays, getScrollContainer, isMobile]);

  // Build a lookup for parent labels (client name for project rows, project name for user rows)
  const parentLookup = useMemo(() => {
    // Pre-build Maps for O(1) lookups
    const clientByClientId = new Map<string, SheetRow>();
    const projectByProjectId = new Map<string, SheetRow>();
    for (const row of rows) {
      if ((row.type === "client" || row.type === "absence-client") && row.clientId) {
        clientByClientId.set(row.clientId, row);
      }
      if ((row.type === "project" || row.type === "absence-type") && row.projectId) {
        projectByProjectId.set(row.projectId, row);
      }
    }

    const map: Record<string, { clientName?: string; projectName?: string }> = {};
    for (const row of rows) {
      if ((row.type === "client" || row.type === "absence-client") && row.clientId) {
        map[`client:${row.clientId}`] = { clientName: row.label };
      }
      if ((row.type === "project" || row.type === "absence-type") && row.projectId) {
        const parentClient = row.clientId ? clientByClientId.get(row.clientId) : undefined;
        map[`project:${row.projectId}`] = {
          clientName: parentClient?.label ?? "",
          projectName: row.label,
        };
      }
      if (row.type === "sub-project" && row.projectId) {
        const parentProjectId = row.parentId?.replace("project:", "");
        const parentProject = parentProjectId ? projectByProjectId.get(parentProjectId) : undefined;
        const parentClient = row.clientId ? clientByClientId.get(row.clientId) : undefined;
        map[`project:${row.projectId}`] = {
          clientName: parentClient?.label ?? "",
          projectName: parentProject?.label ?? row.label,
        };
      }
    }
    return map;
  }, [rows]);

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, rowIdx] = cell;
      const row = visibleRows[rowIdx];

      if (!row) {
        return {
          kind: GridCellKind.Text,
          data: "",
          displayData: "",
          allowOverlay: false,
        };
      }

      // Placeholder rows
      if (row.type === "add-absence-placeholder") {
        if (col === 0) {
          const data: LabelCellData = {
            kind: "label-cell",
            rowType: "add-absence-placeholder",
            label: "",
            depth: 0,
            rowId: row.id,
            placeholderText: t("addAbsence"),
          };
          return {
            kind: GridCellKind.Custom,
            data,
            copyData: "",
            allowOverlay: false,
            readonly: true,
          } as LabelCell;
        }
        return {
          kind: GridCellKind.Text,
          data: "",
          displayData: "",
          allowOverlay: false,
          readonly: true,
          themeOverride: { bgCell: "#ffffff" },
        };
      }

      if (row.type === "add-client-placeholder") {
        if (col === 0) {
          const data: LabelCellData = {
            kind: "label-cell",
            rowType: "add-client-placeholder",
            label: "",
            depth: 0,
            rowId: row.id,
            placeholderText: t("addClient"),
          };
          return {
            kind: GridCellKind.Custom,
            data,
            copyData: "",
            allowOverlay: false,
            readonly: true,
          } as LabelCell;
        }
        return {
          kind: GridCellKind.Text,
          data: "",
          displayData: "",
          allowOverlay: false,
          readonly: true,
          themeOverride: { bgCell: "#ffffff" },
        };
      }

      if (row.type === "add-calendar-placeholder") {
        if (col === 0) {
          const data: LabelCellData = {
            kind: "label-cell",
            rowType: "add-calendar-placeholder",
            label: "",
            depth: 0,
            rowId: row.id,
            placeholderText: t("addCalendar"),
          };
          return {
            kind: GridCellKind.Custom,
            data,
            copyData: "",
            allowOverlay: false,
            readonly: true,
          } as LabelCell;
        }
        return {
          kind: GridCellKind.Text,
          data: "",
          displayData: "",
          allowOverlay: false,
          readonly: true,
          themeOverride: { bgCell: "#ffffff" },
        };
      }

      if (row.type === "calendar") {
        if (col === 0) {
          const data: LabelCellData = {
            kind: "label-cell",
            rowType: "calendar",
            label: row.label,
            depth: 0,
            rowId: row.id,
            canManage: true,
            calendarOwnerName: row.calendarOwnerName,
          };
          return {
            kind: GridCellKind.Custom,
            data,
            copyData: row.label,
            allowOverlay: false,
            readonly: true,
          } as LabelCell;
        }
        // Day columns for calendar rows — show indicator dot via drawCell
        const day = activeDays[col - 1];
        if (!day) {
          return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
        }
        const dateStr = format(day, "yyyy-MM-dd");
        const hasEvents = row.calendarIntegrationId
          && calendarIndicators?.[row.calendarIntegrationId]?.includes(dateStr);
        return {
          kind: GridCellKind.Text,
          data: hasEvents ? "event" : "",
          displayData: "",
          allowOverlay: false,
          readonly: true,
          themeOverride: { bgCell: hasEvents ? (row.calendarColor ? `${row.calendarColor}18` : "#0891b218") : "#ffffff" },
        };
      }

      // Label column — use custom renderer
      if (col === 0) {
        const lookupKey =
          row.type === "project" || row.type === "sub-project" || row.type === "absence-type"
            ? `project:${row.projectId}`
            : row.type === "user" || row.type === "absence-user"
              ? `project:${row.projectId}`
              : `client:${row.clientId}`;
        const parent = parentLookup[lookupKey];

        // Map row types to their visual equivalents for the renderer
        const rendererRowType =
          row.type === "absence-client" ? "absence-client" as const
          : row.type === "absence-type" ? "absence-type" as const
          : row.type === "absence-user" ? "absence-user" as const
          : row.type === "absence-total" ? "absence-total" as const
          : row.type as "client" | "project" | "sub-project" | "user" | "total" | "calendar";

        const data: LabelCellData = {
          kind: "label-cell",
          rowType: rendererRowType,
          label: row.label,
          depth: row.depth,
          rowId: row.id,
          projectId: row.projectId,
          clientId: row.clientId,
          userId: row.userId,
          clientName: parent?.clientName,
          projectName: parent?.projectName,
          hasSubProjects: row.hasSubProjects,
          userImage: row.userImage,
          canManage,
          budgetPct: row.projectId ? projectBudgetData.get(row.projectId)?.pct : undefined,
        };

        return {
          kind: GridCellKind.Custom,
          data,
          copyData: row.label,
          allowOverlay: false,
          readonly: true,
        } as LabelCell;
      }

      // Day columns
      const day = activeDays[col - 1];
      if (!day) {
        return {
          kind: GridCellKind.Text,
          data: "",
          displayData: "",
          allowOverlay: false,
        };
      }

      const dateStr = format(day, "yyyy-MM-dd");
      const isNonWorking = !isWorkingDay(day);
      const isSunday = getDay(day) === 0;

      // Non-editable rows
      if (
        row.type === "client" ||
        row.type === "project" ||
        row.type === "sub-project" ||
        row.type === "total" ||
        row.type === "absence-client" ||
        row.type === "absence-type" ||
        row.type === "absence-total"
      ) {
        if ((row.type === "total" || row.type === "absence-total") && row.projectId) {
          // Determine if this is a parent-project total (aggregates all sub-project users)
          const isParentTotal = row.id.startsWith("total:parent-project:");
          let childRows: SheetRow[];

          if (isParentTotal) {
            // Collect all sub-project IDs for this parent
            const subProjectIds = rows
              .filter((r) => r.type === "sub-project" && r.parentId === `project:${row.projectId}`)
              .map((r) => r.projectId!);
            childRows = rows.filter(
              (r) => r.type === "user" && r.projectId && subProjectIds.includes(r.projectId)
            );
          } else {
            childRows = rows.filter(
              (r) => (r.type === "user" || r.type === "absence-user") && r.projectId === row.projectId
            );
          }

          let sum = 0;
          for (const child of childRows) {
            const key = `${child.userId}:${child.projectId}:${dateStr}`;
            const val = cellsSnapshot?.[key];
            if (val) {
              const daysVal = Number(val);
              sum += displayMode === "hours"
                ? daysVal * (child.hoursPerDay ?? 7)
                : daysVal;
            }
          }
          const unit = displayMode === "hours" ? tGrid("unitHour") : tGrid("unitDay");
          const displaySum = sum > 0 ? `${fmt2(sum)}${unit}` : "";
          return {
            kind: GridCellKind.Number,
            data: sum || undefined,
            displayData: displaySum,
            allowOverlay: false,
            readonly: true,
            themeOverride: {
              textDark: sum > 0 ? "#6b7280" : "#e5e7eb",
              bgCell: isNonWorking ? "#f3f4f6" : "#fafafa",
              baseFontStyle: isParentTotal ? "600 12px" : "500 12px",
            },
          };
        }

        // Project/sub-project rows — editable forecast cells (previsionnel)
        if (viewMode === "spreadsheet" && (row.type === "project" || row.type === "sub-project") && row.projectId) {
          const forecastKey = `forecast:${row.projectId}:${dateStr}`;
          const rawVal = cellsSnapshot?.[forecastKey] ?? "";
          const numVal = rawVal ? Number(rawVal) : 0;
          const hasValue = numVal > 0;
          const displayVal = hasValue
            ? displayMode === "hours" ? numVal * 7 : numVal
            : 0;
          const unit = displayMode === "hours" ? tGrid("unitHour") : tGrid("unitDay");
          return {
            kind: GridCellKind.Number,
            data: displayVal || undefined,
            displayData: hasValue ? `${fmt2(displayVal)}${unit}` : "",
            allowOverlay: canManage && !isNonWorking,
            readonly: !canManage || isNonWorking,
            themeOverride: {
              bgCell: isNonWorking ? "#f5f5f5" : hasValue ? "#f0f4ff" : "#fafafa",
              textDark: hasValue ? "#6366f1" : "#d1d5db",
              baseFontStyle: hasValue ? "italic 500 12px" : "12px",
            },
          };
        }

        return {
          kind: GridCellKind.Text,
          data: "",
          displayData: "",
          allowOverlay: false,
          readonly: true,
          themeOverride: {
            bgCell: viewMode === "gantt"
              ? "#ffffff"
              : isNonWorking
                ? "#f3f4f6"
                : (row.type === "client" || row.type === "absence-client")
                  ? "#f8fafc"
                  : "#ffffff",
          },
        };
      }

      // Workplace view — show workplace labels instead of values
      if (viewMode === "workplace" && (row.type === "user" || row.type === "absence-user") && row.userId) {
        // No workplace on non-working days
        if (isNonWorking) {
          return {
            kind: GridCellKind.Text, data: "", displayData: "",
            allowOverlay: false, readonly: true,
            themeOverride: { bgCell: "#f5f5f5" },
          };
        }

        // 1. Explicit assignment for this day
        const explicitWpId = userWorkplaceMap[`${row.userId}:${dateStr}`];
        // 2. User's default workplace
        const userRow = rows.find(r => r.userId === row.userId && r.type === "user");
        const defaultWpId = userRow?.defaultWorkplaceId;
        const wpId = explicitWpId ?? defaultWpId;
        const wp = wpId ? allWorkplaces.find(w => w.id === wpId) : undefined;

        if (!wp) {
          return {
            kind: GridCellKind.Text, data: "", displayData: "",
            allowOverlay: false, readonly: true,
            themeOverride: { bgCell: "#ffffff", textDark: "#d1d5db" },
          };
        }

        const wpColor = wp.color ?? "#9ca3af";
        const abbr = wp.name.substring(0, 3).toUpperCase();

        return {
          kind: GridCellKind.Text,
          data: wp.name,
          displayData: abbr,
          allowOverlay: false,
          readonly: true,
          themeOverride: {
            bgCell: `${wpColor}15`,
            textDark: wpColor,
            baseFontStyle: "600 10px",
          },
        };
      }

      // User rows — editable
      const cellKey = `${row.userId}:${row.projectId}:${dateStr}`;
      const cellValue = cellsSnapshot?.[cellKey] ?? "";
      const numVal = cellValue ? Number(cellValue) : undefined;
      const hpd = row.hoursPerDay ?? 7;

      const displayVal = numVal
        ? displayMode === "hours"
          ? numVal * hpd
          : numVal
        : undefined;
      const unit = displayMode === "hours" ? tGrid("unitHour") : tGrid("unitDay");
      const displayData = displayVal ? `${fmt2(displayVal)}${unit}` : "";

      // Overtime & overallocation detection
      const isOvertime = numVal ? numVal > 1 : false;
      const isOverallocated = numVal
        ? (userDayTotals.get(`${row.userId}:${dateStr}`) ?? 0) > 1
        : false;
      const isAbsenceUser = row.type === "absence-user";

      return {
        kind: GridCellKind.Number,
        data: displayVal,
        displayData,
        allowOverlay: !isNonWorking,
        readonly: isNonWorking,
        themeOverride: {
          bgCell: isNonWorking
            ? isSunday
              ? "#f0f0f0"
              : "#f5f5f5"
            : isOverallocated
              ? "#fff7ed"
              : isOvertime
                ? "#fef3c7"
                : numVal
                  ? isAbsenceUser ? "#fef2f2" : "#ecfdf5"
                  : "#ffffff",
          textDark: isOverallocated
            ? "#ea580c"
            : isOvertime
              ? "#d97706"
              : numVal
                ? (isAbsenceUser ? "#dc2626" : "#059669")
                : "#d1d5db",
          baseFontStyle: numVal ? "600 13px" : "13px",
        },
      };
    },
    [visibleRows, activeDays, cellsSnapshot, parentLookup, displayMode, viewMode, t, canManage, rows, tGrid, userDayTotals, calendarIndicators]
  );

  const onCellEdited = useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      const [col, rowIdx] = cell;
      const row = visibleRows[rowIdx];
      if (!row || col === 0) return;

      const day = activeDays[col - 1];
      if (!day) return;

      const dateStr = format(day, "yyyy-MM-dd");
      const rawNum =
        newValue.kind === GridCellKind.Number ? (newValue.data ?? 0) : 0;

      // Project/sub-project rows → forecast
      if ((row.type === "project" || row.type === "sub-project") && row.projectId) {
        const valueInDays = displayMode === "hours" && rawNum ? rawNum / 7 : rawNum;
        const value = valueInDays ? String(valueInDays) : "";
        const forecastKey = `forecast:${row.projectId}:${dateStr}`;
        updateLocalCell(forecastKey, value);
        upsertForecastAction({ projectId: row.projectId, date: dateStr, value }).catch((err) => {
          console.error("Failed to persist forecast:", err);
        });
        return;
      }

      // User rows → time entry
      if (row.type !== "user" && row.type !== "absence-user") return;
      if (!row.userId || !row.projectId) return;

      const hpd = row.hoursPerDay ?? 7;
      const valueInDays =
        displayMode === "hours" && rawNum ? rawNum / hpd : rawNum;
      const value = valueInDays ? String(valueInDays) : "";

      const cellKey = `${row.userId}:${row.projectId}:${dateStr}`;

      updateLocalCell(cellKey, value);

      updateCellAction({
        userId: row.userId,
        projectId: row.projectId,
        date: dateStr,
        value,
        type: "worked",
      }).catch((err) => {
        console.error("Failed to persist cell:", err);
      });
    },
    [visibleRows, activeDays, updateLocalCell, displayMode]
  );

  const onCellsEdited = useCallback(
    (edits: readonly EditListItem[]) => {
      for (const edit of edits) {
        const [col, rowIdx] = edit.location;
        const row = visibleRows[rowIdx];
        if (!row || col === 0) continue;

        // Forecast cells for project/sub-project rows
        if ((row.type === "project" || row.type === "sub-project") && row.projectId) {
          const day = activeDays[col - 1];
          if (!day || !isWorkingDay(day)) continue;
          const dateStr = format(day, "yyyy-MM-dd");
          const rawNum = edit.value.kind === GridCellKind.Number ? (edit.value.data ?? 0) : 0;
          const valueInDays = displayMode === "hours" && rawNum ? rawNum / 7 : rawNum;
          const value = valueInDays ? String(valueInDays) : "";
          updateLocalCell(`forecast:${row.projectId}:${dateStr}`, value);
          upsertForecastAction({ projectId: row.projectId, date: dateStr, value }).catch(console.error);
          continue;
        }

        if (row.type !== "user" && row.type !== "absence-user") continue;

        const day = activeDays[col - 1];
        if (!day || !row.userId || !row.projectId) continue;
        if (!isWorkingDay(day)) continue;

        const dateStr = format(day, "yyyy-MM-dd");
        const rawNum =
          edit.value.kind === GridCellKind.Number ? (edit.value.data ?? 0) : 0;

        const hpd = row.hoursPerDay ?? 7;
        const valueInDays =
          displayMode === "hours" && rawNum ? rawNum / hpd : rawNum;
        const value = valueInDays ? String(valueInDays) : "";

        const cellKey = `${row.userId}:${row.projectId}:${dateStr}`;
        updateLocalCell(cellKey, value);

        updateCellAction({
          userId: row.userId,
          projectId: row.projectId,
          date: dateStr,
          value,
          type: "worked",
        }).catch((err) => {
          console.error("Failed to persist cell (fill):", err);
        });
      }
      return true;
    },
    [visibleRows, activeDays, updateLocalCell, displayMode]
  );

  // Custom header: two-line layout (abbr + number) with today highlight
  const drawHeader: DrawHeaderCallback = useCallback(
    (args, _drawContent) => {
      const { ctx, column, rect, columnIndex } = args;

      // Label column — draw view mode toggle (Spreadsheet / Gantt)
      if (columnIndex === 0) {
        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        const font = "500 11px 'Inter', -apple-system, sans-serif";
        ctx.font = font;

        const labels = [
          { key: "spreadsheet" as const, label: t("spreadsheet") },
          { key: "gantt" as const, label: t("gantt") },
          { key: "workplace" as const, label: t("workplaceView") },
        ];

        const padH = 8;
        const gap = 2;
        const btnH = 20;
        const btnWidths = labels.map(l => ctx.measureText(l.label).width + padH * 2);
        const totalW = btnWidths.reduce((a, b) => a + b, 0) + gap * (labels.length - 1);
        const startX = centerX - totalW / 2;

        // Background pill
        const pillRadius = 6;
        const pillH = btnH + 6;
        const pillY = centerY - pillH / 2;
        ctx.fillStyle = "#f3f4f6";
        ctx.beginPath();
        ctx.roundRect(startX - 3, pillY, totalW + 6, pillH, pillRadius);
        ctx.fill();

        let curX = startX;
        const btnY = centerY - btnH / 2;
        for (let bi = 0; bi < labels.length; bi++) {
          const { key, label } = labels[bi];
          const w = btnWidths[bi];
          if (viewMode === key) {
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.roundRect(curX, btnY, w, btnH, 4);
            ctx.fill();
            ctx.shadowColor = "rgba(0,0,0,0.05)";
            ctx.shadowBlur = 2;
            ctx.shadowOffsetY = 1;
            ctx.fill();
            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
          }
          ctx.fillStyle = viewMode === key ? "#111827" : "#9ca3af";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, curX + w / 2, centerY);
          curX += w + gap;
        }

        ctx.restore();
        return;
      }

      const isToday = column.id === todayStr;
      const parts = (column.title ?? "").split("\n");
      const abbr = parts[0] ?? "";
      const num = parts[1] ?? "";
      const cx = rect.x + rect.width / 2;

      ctx.save();

      // Background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

      // Day abbreviation (top) — lighter for normal, bold for today
      ctx.font = isToday
        ? "600 9px 'Inter', -apple-system, sans-serif"
        : "400 9px 'Inter', -apple-system, sans-serif";
      ctx.fillStyle = isToday ? "#111827" : "#9ca3af";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(abbr, cx, rect.y + rect.height * 0.33);

      const numY = rect.y + rect.height * 0.70;

      if (isToday) {
        // Dark circle behind the number
        ctx.beginPath();
        ctx.arc(cx, numY, 11, 0, Math.PI * 2);
        ctx.fillStyle = "#111827";
        ctx.fill();

        // White number
        ctx.font = "600 11px 'Inter', -apple-system, sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(num, cx, numY);
      } else {
        // Normal number
        ctx.font = "500 11px 'Inter', -apple-system, sans-serif";
        ctx.fillStyle = "#6b7280";
        ctx.fillText(num, cx, numY);
      }

      // Availability fill bar at bottom of header
      if (availabilityByDay && columnIndex > 0) {
        const dayIdx = columnIndex - 1;
        if (dayIdx < activeDays.length) {
          const dateStr = format(activeDays[dayIdx], "yyyy-MM-dd");
          const fill = availabilityByDay.get(dateStr) ?? 0;
          if (fill > 0) {
            const barX = rect.x + 4;
            const barY = rect.y + rect.height - 5;
            const trackWidth = rect.width - 8;
            const barWidth = Math.max(trackWidth * Math.min(fill, 1), 3);
            const color = fill <= 0.7 ? "#86efac" : fill <= 1.0 ? "#fcd34d" : "#fb923c";
            // Track
            ctx.fillStyle = "#f3f4f6";
            ctx.beginPath();
            ctx.roundRect(barX, barY, trackWidth, 3, 1.5);
            ctx.fill();
            // Fill
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.roundRect(barX, barY, barWidth, 3, 1.5);
            ctx.fill();
          }
        }
      }

      ctx.restore();
    },
    [todayStr, viewMode, t, availabilityByDay, activeDays]
  );

  // Draw Gantt bars or note indicators depending on view mode
  const drawCell: DrawCellCallback = useCallback(
    (args, drawContent) => {
      const { ctx, rect, col, row: rowIdx } = args;

      // Gantt bar rendering — fill entire cell + text overflows across cells
      if (viewMode === "gantt" && col > 0) {
        const row = visibleRows[rowIdx];
        if (row && (row.type === "project" || row.type === "sub-project") && row.startDate && row.endDate) {
          const day = activeDays[col - 1];
          if (day) {
            const dateStr = format(day, "yyyy-MM-dd");

            // Use preview dates when dragging this project's bar
            const isPreview = ganttDragPreview && row.projectId === ganttDragPreview.projectId;
            const effectiveStart = isPreview
              ? format(activeDays[ganttDragPreview.newStartCol], "yyyy-MM-dd")
              : row.startDate;
            const effectiveEnd = isPreview
              ? format(activeDays[ganttDragPreview.newEndCol], "yyyy-MM-dd")
              : row.endDate;

            const lastWork = lastWorkDateMap.get(row.projectId ?? "");
            const hasWork = !!lastWork;
            const isSubProject = row.type === "sub-project";
            const baseAlpha = (isSubProject ? 0.4 : 1) * (isPreview ? 0.7 : 1);
            const colorIdx = clientColorMap.get(row.clientId ?? "") ?? 0;
            const baseColor = CLIENT_COLORS[colorIdx];

            // Determine which zone this cell falls into
            let zone: "solid" | "margin" | "overflow" | null = null;

            if (!hasWork || isPreview) {
              // No work logged or preview mode — entire bar is solid
              if (dateStr >= effectiveStart && dateStr <= effectiveEnd) zone = "solid";
            } else {
              const solidEnd = lastWork < effectiveEnd ? lastWork : effectiveEnd;
              if (dateStr >= effectiveStart && dateStr <= solidEnd) {
                zone = "solid";
              } else if (lastWork < effectiveEnd && dateStr > lastWork && dateStr <= effectiveEnd) {
                zone = "margin";
              } else if (lastWork > effectiveEnd && dateStr > effectiveEnd && dateStr <= lastWork) {
                zone = "overflow";
              }
            }

            if (zone) {
              if (zone === "solid") {
                ctx.save();
                ctx.globalAlpha = baseAlpha;
                ctx.fillStyle = baseColor;
                ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
                ctx.restore();
              } else if (zone === "margin") {
                drawHatchedRect(ctx, rect.x, rect.y, rect.width, rect.height, baseColor, baseAlpha);
              } else {
                // overflow — red hatches
                drawHatchedRect(ctx, rect.x, rect.y, rect.width, rect.height, "#DC2626", baseAlpha * 0.8);
              }

              // Draw label text — positioned from the first cell of the bar, overflows into subsequent cells
              const barStart = effectiveStart;
              const barEnd = hasWork && !isPreview && lastWork > effectiveEnd ? lastWork : effectiveEnd;
              const dayColW = isMobile ? Math.floor((windowWidth - 120) / 7) : DAY_COL_WIDTH;
              const startColIdx = activeDays.findIndex(d => format(d, "yyyy-MM-dd") === barStart) + 1;
              const colOffset = col - startColIdx;
              const textX = rect.x - colOffset * dayColW + 8;
              const textY = rect.y + rect.height / 2;

              ctx.save();
              ctx.fillStyle = "#ffffff";
              ctx.font = "500 11px Inter, -apple-system, sans-serif";
              ctx.textBaseline = "middle";
              // Clip text to bar extent
              const endColIdx = activeDays.findIndex(d => format(d, "yyyy-MM-dd") === barEnd) + 1;
              const barPixelEnd = rect.x + (endColIdx - col) * dayColW + dayColW;
              ctx.beginPath();
              ctx.rect(rect.x, rect.y, barPixelEnd - rect.x, rect.height);
              ctx.clip();
              ctx.fillText(row.label, textX, textY);
              ctx.restore();

              return;
            }
          }
        }
      }

      // Draw normal content
      drawContent();

      // Remote cursor indicators
      const cursorUsers = otherCursors.get(`${col}:${rowIdx}`);
      if (cursorUsers && cursorUsers.length > 0) {
        const user = cursorUsers[0];
        ctx.save();
        ctx.strokeStyle = user.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
        const label = user.name.split(" ")[0];
        ctx.font = "500 9px Inter, -apple-system, sans-serif";
        const textWidth = ctx.measureText(label).width;
        const labelX = rect.x + 2;
        const labelY = rect.y;
        ctx.fillStyle = user.color;
        ctx.beginPath();
        ctx.roundRect(labelX, labelY - 14, textWidth + 8, 14, 3);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "middle";
        ctx.fillText(label, labelX + 4, labelY - 7);
        ctx.restore();
      }

      // Calendar event dot indicator
      if (col > 0) {
        const row = visibleRows[rowIdx];
        if (row?.type === "calendar" && row.calendarIntegrationId) {
          const day = activeDays[col - 1];
          if (day) {
            const dateStr = format(day, "yyyy-MM-dd");
            const hasEvents = calendarIndicators?.[row.calendarIntegrationId]?.includes(dateStr);
            if (hasEvents) {
              const dotColor = row.calendarColor || "#0891b2";
              const cx = rect.x + rect.width / 2;
              const cy = rect.y + rect.height / 2;
              ctx.beginPath();
              ctx.arc(cx, cy, 4, 0, Math.PI * 2);
              ctx.fillStyle = dotColor;
              ctx.fill();
            }
          }
        }
      }

      // Note indicator (spreadsheet mode only)
      if (viewMode !== "gantt" && col > 0) {
        const row = visibleRows[rowIdx];
        if (!row || (row.type !== "user" && row.type !== "absence-user") || !row.userId || !row.projectId) return;
        const day = activeDays[col - 1];
        if (!day) return;
        const dateStr = format(day, "yyyy-MM-dd");
        const cellKey = `${row.userId}:${row.projectId}:${dateStr}`;
        const hasNote = !!notesSnapshot?.[cellKey];
        if (hasNote) {
          ctx.save();
          ctx.beginPath();
          const x = rect.x + rect.width;
          const y = rect.y;
          ctx.moveTo(x - 8, y);
          ctx.lineTo(x, y);
          ctx.lineTo(x, y + 8);
          ctx.closePath();
          ctx.fillStyle = "#3b82f6";
          ctx.fill();
          ctx.restore();
        }

        // Expense indicator (orange triangle bottom-left)
        const hasExpense = expenseMap && expenseMap[cellKey]?.length > 0;
        if (hasExpense) {
          ctx.save();
          ctx.beginPath();
          const x = rect.x;
          const y = rect.y + rect.height;
          ctx.moveTo(x, y);
          ctx.lineTo(x + 8, y);
          ctx.lineTo(x, y - 8);
          ctx.closePath();
          ctx.fillStyle = "#f59e0b";
          ctx.fill();
          ctx.restore();
        }

        // Overallocation indicator (bottom-right circle with "i")
        const totalKey = `${row.userId}:${dateStr}`;
        const dayTotal = userDayTotals.get(totalKey) ?? 0;
        if (dayTotal > 1) {
          const cx = rect.x + rect.width - 7;
          const cy = rect.y + rect.height - 7;
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, 5, 0, Math.PI * 2);
          ctx.fillStyle = "#ea580c";
          ctx.globalAlpha = 0.85;
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 7px Inter, -apple-system, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("i", cx, cy);
          ctx.restore();
        }
      }
    },
    [visibleRows, activeDays, notesSnapshot, viewMode, clientColorMap, lastWorkDateMap, isMobile, windowWidth, calendarIndicators, expenseMap, ganttDragPreview, userDayTotals, otherCursors]
  );

  // Context menu handler (right-click)
  const onCellContextMenu = useCallback(
    (cell: Item, event: CellClickedEventArgs) => {
      const [col, rowIdx] = cell;
      const row = visibleRows[rowIdx];
      if (!row || (row.type !== "user" && row.type !== "absence-user") || col === 0) return;
      if (!row.userId || !row.projectId) return;

      const day = activeDays[col - 1];
      if (!day) return;

      event.preventDefault();
      const dateStr = format(day, "yyyy-MM-dd");
      const cellKey = `${row.userId}:${row.projectId}:${dateStr}`;

      setContextMenu({
        x: event.bounds.x + event.localEventX,
        y: event.bounds.y + event.localEventY,
        cellKey,
        userId: row.userId,
        projectId: row.projectId,
        dateStr,
        hasNote: !!notesSnapshot?.[cellKey],
      });
    },
    [visibleRows, activeDays, notesSnapshot]
  );

  // Track mouse position for remote cursors
  const onMouseMove = useCallback((args: GridMouseEventArgs) => {
    if (args.kind === "cell") {
      updateMyPresence({ cursor: { col: args.location[0], row: args.location[1] } });
    } else {
      updateMyPresence({ cursor: null });
    }
  }, [updateMyPresence]);

  // Tooltip on hover
  const onItemHovered = useCallback(
    (args: GridMouseEventArgs) => {
      if (args.kind !== "cell") {
        setHoveredNote(null);
        return;
      }

      const [col, rowIdx] = args.location;
      const row = visibleRows[rowIdx];
      if (!row) { setHoveredNote(null); return; }

      // Budget tooltip on project label (col 0)
      if (col === 0 && (row.type === "project" || row.type === "sub-project") && row.projectId) {
        const bd = projectBudgetData.get(row.projectId);
        if (bd) {
          const pctStr = Math.round(bd.pct * 100);
          const remaining = bd.unit === "€"
            ? `${Math.round(bd.budget - bd.consumed).toLocaleString("fr-FR")} €`
            : `${Math.round((bd.budget - bd.consumed) * 10) / 10}j`;
          const consumedStr = bd.unit === "€"
            ? `${bd.consumed.toLocaleString("fr-FR")} €`
            : `${bd.consumed}j`;
          const budgetStr = bd.unit === "€"
            ? `${Math.round(bd.budget).toLocaleString("fr-FR")} €`
            : `${bd.budget}j`;
          const status = bd.pct <= 0.7 ? "En bonne voie" : bd.pct <= 0.9 ? "Attention" : bd.pct <= 1 ? "Critique" : "Dépassé";
          setHoveredNote({
            x: args.bounds.x + args.bounds.width - 40,
            y: args.bounds.y - 4,
            note: `Budget : ${consumedStr} / ${budgetStr} (${pctStr}%)\nReste : ${remaining}\n${status}`,
          });
          return;
        }
        setHoveredNote(null);
        return;
      }

      if (row.type !== "user" && row.type !== "absence-user") { setHoveredNote(null); return; }
      if (col === 0) { setHoveredNote(null); return; }

      const day = activeDays[col - 1];
      if (!day) {
        setHoveredNote(null);
        return;
      }

      const dateStr = format(day, "yyyy-MM-dd");
      const cellKey = `${row.userId}:${row.projectId}:${dateStr}`;
      const note = notesSnapshot?.[cellKey];
      const cellVal = cellsSnapshot?.[cellKey];
      const numCellVal = cellVal ? Number(cellVal) : 0;
      const isOvertime = numCellVal > 1;
      const hpd = row.hoursPerDay ?? 7;

      const overtimeText = isOvertime
        ? displayMode === "hours"
          ? tGrid("overtimeHours", { count: ((numCellVal - 1) * hpd) % 1 === 0 ? String((numCellVal - 1) * hpd) : ((numCellVal - 1) * hpd).toFixed(1) })
          : tGrid("overtimeDays", { count: (numCellVal - 1) % 1 === 0 ? String(numCellVal - 1) : (numCellVal - 1).toFixed(2) })
        : null;

      // Overallocation tooltip
      const dayTotal = userDayTotals.get(`${row.userId}:${dateStr}`) ?? 0;
      const overallocText = dayTotal > 1
        ? displayMode === "hours"
          ? tGrid("overallocHours", { total: (dayTotal * hpd) % 1 === 0 ? String(dayTotal * hpd) : (dayTotal * hpd).toFixed(1), capacity: String(hpd) })
          : tGrid("overallocDays", { total: dayTotal % 1 === 0 ? String(dayTotal) : dayTotal.toFixed(2), capacity: "1" })
        : null;

      // Expense tooltip
      const cellExpenses = expenseMap?.[cellKey];
      const expenseText = cellExpenses && cellExpenses.length > 0
        ? tExpense("expenseTooltip", {
            count: cellExpenses.length,
            total: cellExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0).toFixed(2),
          })
        : null;

      const tooltipParts = [note, overallocText, overtimeText, expenseText].filter(Boolean);

      if (tooltipParts.length > 0) {
        setHoveredNote({
          x: args.bounds.x + args.bounds.width / 2,
          y: args.bounds.y - 4,
          note: tooltipParts.join("\n"),
        });
      } else {
        setHoveredNote(null);
      }
    },
    [visibleRows, activeDays, notesSnapshot, cellsSnapshot, displayMode, tGrid, expenseMap, tExpense, userDayTotals, projectBudgetData]
  );

  // Handle comment save
  const handleSaveComment = useCallback(
    (note: string) => {
      if (!commentPopover) return;
      const { cellKey, userId, projectId, dateStr } = commentPopover;

      updateLocalNote(cellKey, note || null);
      updateNoteAction({ userId, projectId, date: dateStr, note: note || null }).catch(
        (err) => console.error("Failed to persist note:", err)
      );
      setCommentPopover(null);
    },
    [commentPopover, updateLocalNote]
  );

  // Handle comment delete
  const handleDeleteComment = useCallback(() => {
    if (!contextMenu) return;
    const { cellKey, userId, projectId, dateStr } = contextMenu;

    updateLocalNote(cellKey, null);
    updateNoteAction({ userId, projectId, date: dateStr, note: null }).catch(
      (err) => console.error("Failed to delete note:", err)
    );
    setContextMenu(null);
  }, [contextMenu, updateLocalNote]);

  // Handle clicks on header column 0 (view mode toggle)
  const onHeaderClicked = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (colIndex: number, event: any) => {
      if (colIndex !== 0) return;
      const bounds = event.bounds;
      if (!bounds) return;

      // Replicate the same geometry from drawHeader (3-button toggle)
      const centerX = bounds.width / 2;
      const localX = event.localEventX;

      const padH = 8;
      const gap = 2;
      const charW = 6.5;
      const labels = [
        { key: "spreadsheet" as const, label: t("spreadsheet") },
        { key: "gantt" as const, label: t("gantt") },
        { key: "workplace" as const, label: t("workplaceView") },
      ];
      const btnWidths = labels.map(l => l.label.length * charW + padH * 2);
      const totalW = btnWidths.reduce((a, b) => a + b, 0) + gap * (labels.length - 1);
      const startX = centerX - totalW / 2;

      let curX = startX;
      for (let i = 0; i < labels.length; i++) {
        if (localX >= curX && localX <= curX + btnWidths[i]) {
          setViewMode(labels[i].key);
          if (labels[i].key !== "gantt") setLinkMode(false);
          break;
        }
        curX += btnWidths[i] + gap;
      }
    },
    [t, setViewMode]
  );

  // Position-based [+] button hit-test (same constants as renderer)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isPlusButtonClick = useCallback((event: any): boolean => {
    const BTN_RADIUS = 10;
    const BTN_RIGHT_MARGIN = 12;
    const bounds = event.bounds;
    if (!bounds) return false;
    const btnCenterX = bounds.width - BTN_RIGHT_MARGIN - BTN_RADIUS;
    const btnCenterY = bounds.height / 2;
    const dx = event.localEventX - btnCenterX;
    const dy = event.localEventY - btnCenterY;
    return dx * dx + dy * dy <= BTN_RADIUS * BTN_RADIUS;
  }, []);

  // Handle clicks on custom label cells (buttons [+] and label clicks)
  const onCellClicked = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (cell: Item, event: any) => {
      const [col, rowIdx] = cell;
      setIsLabelColFocused(col === 0);

      const row = visibleRows[rowIdx];
      if (!row) return;

      // Empty state: if no clients exist and user clicks anywhere, open add-client
      const hasClients = rows.some(r => r.type === "client");
      if (!hasClients && canManage) {
        onAddClient?.();
        return;
      }

      // Calendar day cell clicks (col > 0)
      if (col > 0 && row.type === "calendar" && row.calendarIntegrationId) {
        const day = activeDays[col - 1];
        if (day) {
          const dateStr = format(day, "yyyy-MM-dd");
          onCalendarEvents?.(row.calendarIntegrationId, row.label, dateStr);
        }
        return;
      }

      if (col !== 0) return;

      if (row.type === "add-client-placeholder") {
        onAddClient?.();
        return;
      }

      if (row.type === "add-absence-placeholder") {
        onAddAbsenceClient?.();
        return;
      }

      if (row.type === "add-calendar-placeholder") {
        onAddCalendar?.();
        return;
      }

      if (row.type === "calendar" && row.calendarIntegrationId) {
        onCalendarDetail?.(row.calendarIntegrationId, row.label);
        return;
      }

      const isButtonClick = isPlusButtonClick(event);
      const parent = parentLookup[`project:${row.projectId}`];
      const clientName = parent?.clientName ?? "";

      if (row.type === "client" && row.clientId) {
        if (isButtonClick && canManage) {
          onAddProject?.(row.clientId, row.label);
        } else if (!isButtonClick) {
          onClientDetail?.(row.clientId, row.label);
          onSelectClient?.(row.clientId, row.label);
        }
      } else if (row.type === "project" && row.projectId && row.clientId) {
        if (isButtonClick && canManage) {
          if (row.hasSubProjects) {
            onAddSubProject?.(row.projectId, row.label, clientName);
          } else {
            onAssignUser?.(row.projectId, row.label, clientName);
          }
        } else if (!isButtonClick) {
          onProjectDetail?.(row.projectId, row.label, clientName);
          onSelectProject?.(row.projectId, row.label);
        }
      } else if (row.type === "sub-project" && row.projectId && row.clientId) {
        if (isButtonClick && canManage) {
          onAssignUser?.(row.projectId, row.label, clientName);
        } else if (!isButtonClick) {
          onProjectDetail?.(row.projectId, row.label, clientName);
          onSelectProject?.(row.projectId, row.label);
        }
      } else if (row.type === "user" && row.userId && row.projectId) {
        onUserDetail?.(row.userId, row.projectId, row.label);
      } else if (row.type === "absence-client" && row.clientId) {
        if (isButtonClick && canManage) {
          onAddAbsenceType?.(row.clientId, row.label);
        } else if (!isButtonClick) {
          onAbsenceClientDetail?.(row.clientId, row.label);
        }
      } else if (row.type === "absence-type" && row.projectId && row.clientId) {
        if (isButtonClick && canManage) {
          onAssignAbsenceUser?.(row.projectId, row.label, clientName);
        } else if (!isButtonClick) {
          onAbsenceTypeDetail?.(row.projectId, row.label, clientName);
        }
      } else if (row.type === "absence-user" && row.userId && row.projectId) {
        onUserDetail?.(row.userId, row.projectId, row.label);
      }
    },
    [visibleRows, parentLookup, isPlusButtonClick, canManage, onAssignUser, onAddProject, onUserDetail, onAddSubProject, onProjectDetail, onClientDetail, onSelectProject, onSelectClient, onAddClient, onAddAbsenceClient, onAddAbsenceType, onAssignAbsenceUser, onAbsenceClientDetail, onAbsenceTypeDetail, onAddCalendar, onCalendarDetail, onCalendarEvents, activeDays]
  );

  // Dynamic theme: hide focus ring in Gantt mode or when label column (col 0) is focused
  const dynamicTheme = useMemo<Partial<Theme>>(() => {
    const base = viewMode === "gantt"
      ? { ...customTheme, borderColor: "transparent", horizontalBorderColor: "#f3f4f6", accentColor: "transparent" }
      : customTheme;
    if (isLabelColFocused) {
      return { ...base, accentColor: "transparent" };
    }
    return base;
  }, [isLabelColFocused, viewMode]);

  // Mobile theme overrides
  const mobileThemeOverrides = useMemo<Partial<Theme>>(() => {
    if (!isMobile) return {};
    return {
      cellVerticalPadding: 6,
      baseFontStyle: "12px",
      headerFontStyle: "500 10px",
    };
  }, [isMobile]);

  const finalTheme = useMemo<Partial<Theme>>(
    () => ({ ...dynamicTheme, ...mobileThemeOverrides }),
    [dynamicTheme, mobileThemeOverrides]
  );

  return (
    <div className="flex h-full flex-col">
      {isMobile ? (
        <MobileHeader
          weekLabel={weekLabel ?? ""}
          onPrevWeek={onPrevWeek ?? (() => {})}
          onNextWeek={onNextWeek ?? (() => {})}
          onTodayClick={onTodayWeek ?? (() => {})}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
          userName={userName}
          userImage={userImage}
          currentOrgId={currentOrgId}
          currentOrgName={currentOrgName}
          userOrganizations={userOrganizations}
          userRole={userRole}
          pendingInvitations={pendingInvitations}
        />
      ) : (
        <SheetHeader
          year={currentYear}
          activeMonth={activeMonth}
          onMonthChange={scrollToMonth}
          onYearChange={setCurrentYear}
          onTodayClick={scrollToToday}
          onAddClient={canManage ? onAddClient : undefined}
          onAddUser={canManage ? onAddUser : undefined}
          onAddAbsenceClient={canManage ? onAddAbsenceClient : undefined}
          onAddCalendar={onAddCalendar}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
          userName={userName}
          userImage={userImage}
          currentOrgId={currentOrgId}
          currentOrgName={currentOrgName}
          userOrganizations={userOrganizations}
          userRole={userRole}
          pendingInvitations={pendingInvitations}
          allClients={allClients}
          allProjects={allProjects}
          allUsers={allUsers}
          filters={filters}
          onFiltersChange={onFiltersChange}
          followingUserId={followingUserId}
          onFollowUser={setFollowingUserId}
          availabilityUserId={availabilityUserId}
          onAvailabilityUserChange={setAvailabilityUserId}
        />
      )}
      <div ref={gridContainerRef} className="relative flex-1 overflow-hidden" onMouseLeave={() => updateMyPresence({ cursor: null })}>
        {viewMode === "gantt" && ((allDependencies && allDependencies.length > 0) || dragState) && (
          <GanttDependencyOverlay
            dependencies={allDependencies ?? []}
            rows={visibleRows}
            days={activeDays}
            gridContainerRef={gridContainerRef}
            dragState={dragState}
          />
        )}
        {viewMode === "gantt" && (
          <button
            onClick={() => setLinkMode((v) => !v)}
            className={`absolute bottom-4 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-colors ${
              linkMode
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-400 border border-gray-200"
            }`}
            title={linkMode ? t("linkModeOn") : t("linkModeOff")}
          >
            <PathArrow width={18} height={18} />
          </button>
        )}
        <DataEditor
          ref={gridRef}
          getCellContent={getCellContent}
          columns={columns}
          rows={visibleRows.length}
          onCellEdited={onCellEdited}
          onCellsEdited={onCellsEdited}
          onCellClicked={onCellClicked}
          onHeaderClicked={onHeaderClicked}
          fillHandle={true}
          drawHeader={drawHeader}
          drawCell={drawCell}
          onCellContextMenu={onCellContextMenu}
          onItemHovered={onItemHovered}
          onVisibleRegionChanged={onVisibleRegionChanged}
          onMouseMove={onMouseMove}
          customRenderers={customRenderers}
          width="100%"
          height="100%"
          rangeSelect={viewMode === "gantt" ? "none" : "rect"}
          columnSelect={viewMode === "gantt" || isMobile ? "none" : "multi"}
          rowSelect="none"
          rowMarkers="none"
          smoothScrollX={!isMobile}
          smoothScrollY
          freezeColumns={1}
          theme={finalTheme}
          rowHeight={(rowIdx) => {
              const t = visibleRows[rowIdx]?.type;
              return t === "add-client-placeholder" || t === "add-absence-placeholder" || t === "add-calendar-placeholder" ? 24 : isMobile ? 40 : 36;
            }}
          headerHeight={isMobile ? 44 : 48}
          groupHeaderHeight={isMobile ? 0 : 32}
          overscrollX={0}
          overscrollY={0}
          getCellsForSelection={true}
        />
      </div>

      {/* Context menu */}
      {contextMenu && (
        <CellContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          hasNote={contextMenu.hasNote}
          hasExpenses={!!(expenseMap?.[contextMenu.cellKey]?.length)}
          expenseCount={expenseMap?.[contextMenu.cellKey]?.length ?? 0}
          onAddComment={() => {
            setCommentPopover({
              x: contextMenu.x,
              y: contextMenu.y,
              cellKey: contextMenu.cellKey,
              userId: contextMenu.userId,
              projectId: contextMenu.projectId,
              dateStr: contextMenu.dateStr,
              initialNote: notesSnapshot?.[contextMenu.cellKey] ?? "",
            });
            setContextMenu(null);
          }}
          onDeleteComment={handleDeleteComment}
          onAddExpense={() => {
            setExpensePopover({
              x: contextMenu.x,
              y: contextMenu.y,
              cellKey: contextMenu.cellKey,
              userId: contextMenu.userId,
              projectId: contextMenu.projectId,
              dateStr: contextMenu.dateStr,
            });
            setContextMenu(null);
          }}
          onViewExpenses={() => {
            setExpensePopover({
              x: contextMenu.x,
              y: contextMenu.y,
              cellKey: contextMenu.cellKey,
              userId: contextMenu.userId,
              projectId: contextMenu.projectId,
              dateStr: contextMenu.dateStr,
            });
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
          workplaces={allWorkplaces}
          currentWorkplaceId={userWorkplaceMap[`${contextMenu.userId}:${contextMenu.dateStr}`] ?? null}
          onSetWorkplace={(wpId) => {
            setUserWorkplace({ userId: contextMenu.userId, date: contextMenu.dateStr, workplaceId: wpId }).catch(console.error);
            setContextMenu(null);
          }}
          onRemoveWorkplace={() => {
            removeUserWorkplace(contextMenu.userId, contextMenu.dateStr).catch(console.error);
            setContextMenu(null);
          }}
          showBookDesk={(() => {
            const wpId = userWorkplaceMap[`${contextMenu.userId}:${contextMenu.dateStr}`];
            if (!wpId) return false;
            const wp = allWorkplaces.find((w) => w.id === wpId);
            return wp?.type === "office";
          })()}
          onBookDesk={() => {
            const wpId = userWorkplaceMap[`${contextMenu.userId}:${contextMenu.dateStr}`];
            if (!wpId || !onBookDesk) return;
            const user = allUsers?.find((u) => u.id === contextMenu.userId);
            onBookDesk(contextMenu.userId, contextMenu.dateStr, wpId, user?.name ?? "");
            setContextMenu(null);
          }}
        />
      )}

      {/* Comment popover */}
      {commentPopover && (
        <CommentPopover
          x={commentPopover.x}
          y={commentPopover.y}
          initialNote={commentPopover.initialNote}
          onSave={handleSaveComment}
          onCancel={() => setCommentPopover(null)}
        />
      )}

      {/* Expense popover */}
      {expensePopover && expenseCategories && (
        <ExpensePopover
          x={expensePopover.x}
          y={expensePopover.y}
          cellKey={expensePopover.cellKey}
          userId={expensePopover.userId}
          projectId={expensePopover.projectId}
          dateStr={expensePopover.dateStr}
          expenses={expenseMap?.[expensePopover.cellKey] ?? []}
          categories={expenseCategories}
          onSave={async (data) => {
            await createExpenseAction({
              userId: expensePopover.userId,
              projectId: expensePopover.projectId,
              date: expensePopover.dateStr,
              amount: data.amount,
              description: data.description || null,
              categoryId: data.categoryId,
              attachmentUrl: data.attachmentUrl ?? null,
            });
            onExpenseCreated?.();
          }}
          onDelete={async (expenseId) => {
            await deleteExpenseAction({ expenseId });
            onExpenseDeleted?.();
          }}
          onClose={() => setExpensePopover(null)}
        />
      )}

      {/* Note tooltip */}
      {hoveredNote && !contextMenu && !commentPopover && (
        <div
          className="pointer-events-none fixed z-40 max-w-[200px] rounded-md bg-gray-900 px-2.5 py-1.5 text-[11px] leading-tight text-white shadow-lg"
          style={{
            left: hoveredNote.x,
            top: hoveredNote.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          {hoveredNote.note}
        </div>
      )}
    </div>
  );
}
