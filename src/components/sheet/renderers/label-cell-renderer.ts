import {
  type CustomCell,
  type CustomRenderer,
  GridCellKind,
  type Rectangle,
} from "@glideapps/glide-data-grid";
import { getInitials, getAvatarColor } from "@/lib/utils/avatars";

export interface LabelCellData {
  readonly kind: "label-cell";
  readonly rowType: "client" | "project" | "sub-project" | "user" | "total" | "add-client-placeholder" | "absence-client" | "absence-type" | "absence-user" | "absence-total" | "add-absence-placeholder" | "calendar" | "add-calendar-placeholder";
  readonly label: string;
  readonly depth: number;
  readonly rowId: string;
  readonly projectId?: string;
  readonly clientId?: string;
  readonly userId?: string;
  readonly clientName?: string;
  readonly projectName?: string;
  readonly hasSubProjects?: boolean;
  readonly userImage?: string | null;
  readonly canManage?: boolean;
  readonly placeholderText?: string;
  readonly calendarOwnerName?: string;
  readonly budgetPct?: number; // 0-1+ consumption ratio (consumed/budget)
}

export type LabelCell = CustomCell<LabelCellData>;

const BUTTON_RADIUS = 10;
const BUTTON_RIGHT_MARGIN = 12;
const AVATAR_RADIUS = 12;

// Module-level image cache for canvas avatar rendering
const imageCache = new Map<string, HTMLImageElement | "loading" | "error">();

function isInsideButton(
  bounds: Rectangle,
  posX: number,
  posY: number
): boolean {
  const btnCenterX = bounds.width - BUTTON_RIGHT_MARGIN - BUTTON_RADIUS;
  const btnCenterY = bounds.height / 2;
  const dx = posX - btnCenterX;
  const dy = posY - btnCenterY;
  return dx * dx + dy * dy <= BUTTON_RADIUS * BUTTON_RADIUS;
}

// Absence accent color
const ABSENCE_ACCENT = "#E06B62";
const ABSENCE_ACCENT_LIGHT = "#fef2f2";
const ABSENCE_ACCENT_HOVER = "#fce8e8";

// Calendar accent color
const CALENDAR_ACCENT = "#0891b2";
const CALENDAR_ACCENT_LIGHT = "#f0fdfa";
const CALENDAR_ACCENT_HOVER = "#e0f7fa";

export const labelCellRenderer: CustomRenderer<LabelCell> = {
  kind: GridCellKind.Custom,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isMatch: (c): c is LabelCell => (c.data as any).kind === "label-cell",
  needsHover: true,
  needsHoverPosition: true,

  draw: (args, cell) => {
    const { ctx, rect, theme, hoverX, hoverY, highlighted } = args;
    const { rowType, label, depth } = cell.data;
    const padLeft = 12 + depth * 16;

    // Placeholder rows — special rendering
    if (rowType === "add-client-placeholder" || rowType === "add-absence-placeholder" || rowType === "add-calendar-placeholder") {
      const isHovered = hoverX !== undefined;
      const isAbsence = rowType === "add-absence-placeholder";
      const isCalendar = rowType === "add-calendar-placeholder";
      const accentColor = isCalendar ? CALENDAR_ACCENT : isAbsence ? ABSENCE_ACCENT : "#6366f1";
      const accentBg = isCalendar ? "#ccfbf1" : isAbsence ? "#fecdd3" : "#e0e7ff";

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

      if (isHovered) {
        const centerY = rect.y + rect.height / 2;
        const circleX = rect.x + 20;
        const circleR = 8;

        // Circle with "+"
        ctx.beginPath();
        ctx.arc(circleX, centerY, circleR, 0, Math.PI * 2);
        ctx.fillStyle = accentBg;
        ctx.fill();

        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(circleX - 3.5, centerY);
        ctx.lineTo(circleX + 3.5, centerY);
        ctx.moveTo(circleX, centerY - 3.5);
        ctx.lineTo(circleX, centerY + 3.5);
        ctx.stroke();

        // Text
        ctx.fillStyle = accentColor;
        ctx.font = "500 11px Inter, -apple-system, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const text = cell.data.placeholderText ?? "";
        const textX = circleX + circleR + 10;
        ctx.fillText(text, textX, centerY);

        // Dashed line AFTER text (not crossing it)
        const textWidth = ctx.measureText(text).width;
        const lineStartX = textX + textWidth + 8;
        if (lineStartX < rect.x + rect.width - 20) {
          ctx.save();
          ctx.setLineDash([4, 3]);
          ctx.strokeStyle = accentColor;
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          ctx.moveTo(lineStartX, centerY);
          ctx.lineTo(rect.x + rect.width - 12, centerY);
          ctx.stroke();
          ctx.restore();
        }

        args.overrideCursor?.("pointer");
      }

      return true;
    }

    const isHovered = hoverX !== undefined;
    const isActive = isHovered || highlighted;
    const isAbsenceRow = rowType === "absence-client" || rowType === "absence-type" || rowType === "absence-user" || rowType === "absence-total";
    const isCalendarRow = rowType === "calendar";

    // Background — subtle highlight on hover/focus
    let bgColor = "#ffffff";
    if (rowType === "client") bgColor = isActive ? "#f0f4f8" : "#f8fafc";
    else if (rowType === "absence-client") bgColor = isActive ? ABSENCE_ACCENT_HOVER : ABSENCE_ACCENT_LIGHT;
    else if (isCalendarRow) bgColor = isActive ? CALENDAR_ACCENT_HOVER : CALENDAR_ACCENT_LIGHT;
    else if (rowType === "total" || rowType === "absence-total") bgColor = isActive ? "#f3f4f6" : "#fafafa";
    else bgColor = isActive ? "#f5f7fa" : "#ffffff";

    ctx.fillStyle = bgColor;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

    // Content rendering based on row type
    if (rowType === "user" || rowType === "absence-user") {
      drawUserRow(ctx, rect, label, padLeft, cell.data.userImage, () => args.requestAnimationFrame?.());
    } else {
      drawTextRow(ctx, rect, label, padLeft, rowType, theme, cell.data.calendarOwnerName, cell.data.budgetPct);
    }

    // [+] button for interactive rows (managers/admins only)
    if (cell.data.canManage !== false && (
      rowType === "client" || rowType === "project" || rowType === "sub-project" ||
      rowType === "absence-client" || rowType === "absence-type"
    )) {
      drawPlusButton(ctx, rect, hoverX, hoverY, args.overrideCursor);
    }

    return true;
  },

  onClick: (args) => {
    const { cell, posX, posY, bounds, preventDefault } = args;
    const { rowType } = cell.data;

    // All interactive row types: prevent default overlay and signal click
    if (
      rowType === "client" ||
      rowType === "project" ||
      rowType === "sub-project" ||
      rowType === "user" ||
      rowType === "add-client-placeholder" ||
      rowType === "absence-client" ||
      rowType === "absence-type" ||
      rowType === "absence-user" ||
      rowType === "add-absence-placeholder" ||
      rowType === "calendar" ||
      rowType === "add-calendar-placeholder"
    ) {
      preventDefault();
      return {
        ...cell,
        data: { ...cell.data, kind: "label-cell" as const },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    }

    return undefined;
  },
};

function drawUserRow(
  ctx: CanvasRenderingContext2D,
  rect: Rectangle,
  label: string,
  padLeft: number,
  userImage?: string | null,
  requestAnimation?: () => void
) {
  const x = rect.x + padLeft;
  const centerY = rect.y + rect.height / 2;
  const avatarCx = x + AVATAR_RADIUS;

  let drewImage = false;

  if (userImage) {
    const cached = imageCache.get(userImage);
    if (cached === "loading") {
      // Still loading — draw fallback, will re-render when loaded
    } else if (cached === "error") {
      // Failed — draw fallback
    } else if (cached) {
      // Image loaded — draw circular clip
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarCx, centerY, AVATAR_RADIUS, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(cached, avatarCx - AVATAR_RADIUS, centerY - AVATAR_RADIUS, AVATAR_RADIUS * 2, AVATAR_RADIUS * 2);
      ctx.restore();
      drewImage = true;
    } else {
      // Not yet cached — start loading
      imageCache.set(userImage, "loading");
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.referrerPolicy = "no-referrer";
      img.onload = () => {
        imageCache.set(userImage, img);
        requestAnimation?.();
      };
      img.onerror = () => {
        imageCache.set(userImage, "error");
        requestAnimation?.();
      };
      img.src = userImage;
    }
  }

  if (!drewImage) {
    // Fallback: colored circle with initials
    const color = getAvatarColor(label);
    const initials = getInitials(label);

    ctx.beginPath();
    ctx.arc(avatarCx, centerY, AVATAR_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "600 10px Inter, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, avatarCx, centerY + 1);
  }

  // Name
  ctx.fillStyle = "#374151";
  ctx.font = "13px Inter, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + AVATAR_RADIUS * 2 + 8, centerY);
}

function drawTextRow(
  ctx: CanvasRenderingContext2D,
  rect: Rectangle,
  label: string,
  padLeft: number,
  rowType: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _theme: any,
  calendarOwnerName?: string,
  budgetPct?: number,
) {
  const x = rect.x + padLeft;
  const centerY = rect.y + rect.height / 2;

  if (rowType === "client") {
    ctx.fillStyle = "#111827";
    ctx.font = "600 13px Inter, -apple-system, sans-serif";
  } else if (rowType === "absence-client") {
    ctx.fillStyle = ABSENCE_ACCENT;
    ctx.font = "600 13px Inter, -apple-system, sans-serif";
  } else if (rowType === "calendar") {
    ctx.fillStyle = CALENDAR_ACCENT;
    ctx.font = "500 13px Inter, -apple-system, sans-serif";
  } else if (rowType === "project") {
    ctx.fillStyle = "#374151";
    ctx.font = "500 13px Inter, -apple-system, sans-serif";
  } else if (rowType === "absence-type") {
    ctx.fillStyle = "#b91c1c";
    ctx.font = "500 13px Inter, -apple-system, sans-serif";
  } else if (rowType === "sub-project") {
    ctx.fillStyle = "#4b5563";
    ctx.font = "400 13px Inter, -apple-system, sans-serif";
  } else {
    // total / absence-total
    ctx.fillStyle = "#9ca3af";
    ctx.font = "500 12px Inter, -apple-system, sans-serif";
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, centerY);

  // For shared calendars, draw owner name suffix
  if (rowType === "calendar" && calendarOwnerName) {
    const labelWidth = ctx.measureText(label).width;
    ctx.fillStyle = "#9ca3af";
    ctx.font = "400 11px Inter, -apple-system, sans-serif";
    ctx.fillText(`(${calendarOwnerName})`, x + labelWidth + 6, centerY);
  }

  // Budget consumption gauge — thin bar at bottom of the row
  if ((rowType === "project" || rowType === "sub-project") && budgetPct !== undefined && budgetPct >= 0) {
    const barHeight = 3;
    const barX = rect.x + padLeft;
    const barY = rect.y + rect.height - barHeight - 1;
    const maxBarWidth = rect.width - padLeft - BUTTON_RIGHT_MARGIN - BUTTON_RADIUS * 2 - 8;

    // Track
    ctx.fillStyle = "#f0f0f0";
    ctx.beginPath();
    ctx.roundRect(barX, barY, maxBarWidth, barHeight, 1.5);
    ctx.fill();

    // Fill
    const fillColor = budgetPct <= 0.7 ? "#86efac"
      : budgetPct <= 0.9 ? "#fcd34d"
      : budgetPct <= 1.0 ? "#fb923c"
      : "#ef4444";
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.roundRect(barX, barY, Math.min(maxBarWidth * budgetPct, maxBarWidth), barHeight, 1.5);
    ctx.fill();
  }
}

function drawPlusButton(
  ctx: CanvasRenderingContext2D,
  rect: Rectangle,
  hoverX: number | undefined,
  hoverY: number | undefined,
  overrideCursor?: (cursor: string) => void
) {
  const btnCenterX = rect.x + rect.width - BUTTON_RIGHT_MARGIN - BUTTON_RADIUS;
  const btnCenterY = rect.y + rect.height / 2;

  // Check hover
  const isHovered =
    hoverX !== undefined &&
    hoverY !== undefined &&
    isInsideButton(rect, hoverX, hoverY);

  if (isHovered && overrideCursor) {
    overrideCursor("pointer");
  }

  // Circle
  ctx.beginPath();
  ctx.arc(btnCenterX, btnCenterY, BUTTON_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = isHovered ? "#e0e7ff" : "#f3f4f6";
  ctx.fill();

  // Plus icon
  ctx.strokeStyle = isHovered ? "#4f46e5" : "#9ca3af";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(btnCenterX - 4, btnCenterY);
  ctx.lineTo(btnCenterX + 4, btnCenterY);
  ctx.moveTo(btnCenterX, btnCenterY - 4);
  ctx.lineTo(btnCenterX, btnCenterY + 4);
  ctx.stroke();
}
