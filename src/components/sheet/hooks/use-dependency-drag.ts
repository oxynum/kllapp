"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { createDependencyAction } from "@/app/(dashboard)/sheet/dependency-actions";
import { updateProject } from "@/app/(dashboard)/projects/actions";
import type { SheetRow } from "@/types";
import { format } from "date-fns";

const ROW_HEIGHT = 36;
const PLACEHOLDER_ROW_HEIGHT = 24;
const DAY_COL_WIDTH = 44;
const LABEL_WIDTH = 220;
const HEADER_HEIGHT = 80;
const RESIZE_HANDLE_WIDTH = 8;

function rowHeight(row: SheetRow): number {
  return row.type === "add-client-placeholder" ? PLACEHOLDER_ROW_HEIGHT : ROW_HEIGHT;
}

/** Find which row index corresponds to a grid Y coordinate, accounting for variable row heights. */
function getRowAtGridY(gridY: number, rows: SheetRow[]): number {
  let y = 0;
  for (let i = 0; i < rows.length; i++) {
    const h = rowHeight(rows[i]);
    if (gridY >= y && gridY < y + h) return i;
    y += h;
  }
  return -1;
}

/** Get the top Y pixel offset of a row, accounting for variable row heights. */
function getRowTopY(rowIdx: number, rows: SheetRow[]): number {
  let y = 0;
  for (let i = 0; i < rowIdx; i++) {
    y += rowHeight(rows[i]);
  }
  return y;
}

type DragMode = "dependency" | "move" | "resize-start" | "resize-end";

export interface DragState {
  sourceRowIdx: number;
  sourceEndCol: number;
  sourceY: number; // center Y of source row in grid coordinates
  mouseX: number;
  mouseY: number;
}

export interface GanttDragPreview {
  projectId: string;
  newStartCol: number;
  newEndCol: number;
}

interface UseDependencyDragOptions {
  ganttRows: SheetRow[];
  days: Date[];
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  viewMode: string;
  linkMode: boolean;
}

export function useDependencyDrag({
  ganttRows,
  days,
  gridContainerRef,
  viewMode,
  linkMode,
}: UseDependencyDragOptions) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [ganttDragPreview, setGanttDragPreview] = useState<GanttDragPreview | null>(null);
  const isDragging = useRef(false);
  const dragModeRef = useRef<DragMode | null>(null);
  const sourceProjectId = useRef<string | null>(null);
  const dragStartCol = useRef<number>(0);
  const dragEndCol = useRef<number>(0);
  const dragOriginX = useRef<number>(0);

  // Set cursor on scroller element
  const setCursorOnScroller = useCallback(
    (cursor: string | null) => {
      const container = gridContainerRef.current;
      if (!container) return;
      const scroller = container.querySelector(".dvn-scroller") as HTMLElement | null;
      if (!scroller) return;
      scroller.style.cursor = cursor ?? "";
    },
    [gridContainerRef]
  );

  // Hover cursor feedback
  const handleMouseMoveForCursor = useCallback(
    (e: MouseEvent) => {
      if (isDragging.current) return;
      if (viewMode !== "gantt") return;

      const container = gridContainerRef.current;
      if (!container) return;
      const scroller = container.querySelector(".dvn-scroller") as HTMLElement | null;
      if (!scroller) return;

      const rect = scroller.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const gridX = mouseX + scroller.scrollLeft - LABEL_WIDTH;
      const gridY = mouseY + scroller.scrollTop - HEADER_HEIGHT;

      if (gridX < 0 || gridY < 0) {
        setCursorOnScroller(null);
        return;
      }

      const rowIdx = getRowAtGridY(gridY, ganttRows);
      if (rowIdx < 0 || rowIdx >= ganttRows.length) {
        setCursorOnScroller(null);
        return;
      }

      const row = ganttRows[rowIdx];
      if (row.type !== "project" && row.type !== "sub-project") {
        setCursorOnScroller(null);
        return;
      }
      if (!row.startDate || !row.endDate) {
        setCursorOnScroller(null);
        return;
      }

      const startCol = days.findIndex((d) => format(d, "yyyy-MM-dd") === row.startDate);
      const endCol = days.findIndex((d) => format(d, "yyyy-MM-dd") === row.endDate);
      if (startCol < 0 || endCol < 0) {
        setCursorOnScroller(null);
        return;
      }

      const barLeftX = startCol * DAY_COL_WIDTH;
      const barRightX = (endCol + 1) * DAY_COL_WIDTH;

      if (gridX < barLeftX || gridX > barRightX) {
        setCursorOnScroller(null);
        return;
      }

      // Zone detection
      if (linkMode) {
        setCursorOnScroller("crosshair");
      } else if (gridX <= barLeftX + RESIZE_HANDLE_WIDTH) {
        setCursorOnScroller("col-resize");
      } else if (gridX >= barRightX - RESIZE_HANDLE_WIDTH) {
        setCursorOnScroller("col-resize");
      } else {
        setCursorOnScroller("grab");
      }
    },
    [ganttRows, days, gridContainerRef, viewMode, linkMode, setCursorOnScroller]
  );

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (viewMode !== "gantt") return;

      const container = gridContainerRef.current;
      if (!container) return;

      const scroller = container.querySelector(".dvn-scroller") as HTMLElement | null;
      if (!scroller) return;

      const rect = scroller.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const scrollLeft = scroller.scrollLeft;
      const scrollTop = scroller.scrollTop;
      const gridX = mouseX + scrollLeft - LABEL_WIDTH;
      const gridY = mouseY + scrollTop - HEADER_HEIGHT;

      if (gridX < 0 || gridY < 0) return;

      const rowIdx = getRowAtGridY(gridY, ganttRows);
      if (rowIdx < 0 || rowIdx >= ganttRows.length) return;

      const row = ganttRows[rowIdx];
      if (row.type !== "project" && row.type !== "sub-project") return;
      if (!row.endDate || !row.startDate || !row.projectId) return;

      const endCol = days.findIndex((d) => format(d, "yyyy-MM-dd") === row.endDate);
      const startCol = days.findIndex((d) => format(d, "yyyy-MM-dd") === row.startDate);
      if (endCol < 0 || startCol < 0) return;

      const barRightX = (endCol + 1) * DAY_COL_WIDTH;
      const barLeftX = startCol * DAY_COL_WIDTH;

      // Determine drag mode based on click zone and linkMode
      let mode: DragMode;
      if (linkMode) {
        if (gridX < barLeftX || gridX > barRightX) return;
        mode = "dependency";
      } else {
        if (gridX < barLeftX || gridX > barRightX) return;
        if (gridX <= barLeftX + RESIZE_HANDLE_WIDTH) {
          mode = "resize-start";
        } else if (gridX >= barRightX - RESIZE_HANDLE_WIDTH) {
          mode = "resize-end";
        } else {
          mode = "move";
        }
      }

      isDragging.current = true;
      dragModeRef.current = mode;
      sourceProjectId.current = row.projectId;
      dragStartCol.current = startCol;
      dragEndCol.current = endCol;
      dragOriginX.current = gridX;

      if (mode === "move") {
        setCursorOnScroller("grabbing");
      }

      const sourceRowTop = getRowTopY(rowIdx, ganttRows);
      setDragState({
        sourceRowIdx: rowIdx,
        sourceEndCol: endCol,
        sourceY: sourceRowTop + rowHeight(row) / 2,
        mouseX,
        mouseY,
      });

      e.preventDefault();
    },
    [ganttRows, days, gridContainerRef, viewMode, linkMode, setCursorOnScroller]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging.current) return;

      const container = gridContainerRef.current;
      if (!container) return;

      const scroller = container.querySelector(".dvn-scroller") as HTMLElement | null;
      if (!scroller) return;

      const rect = scroller.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setDragState((prev) =>
        prev
          ? { ...prev, mouseX, mouseY }
          : null
      );

      // Live preview for move/resize modes
      const mode = dragModeRef.current;
      if (
        (mode === "move" || mode === "resize-start" || mode === "resize-end") &&
        sourceProjectId.current
      ) {
        const gridX = mouseX + scroller.scrollLeft - LABEL_WIDTH;
        const deltaX = gridX - dragOriginX.current;
        const deltaCols = Math.round(deltaX / DAY_COL_WIDTH);

        let newStartCol = dragStartCol.current;
        let newEndCol = dragEndCol.current;

        if (mode === "move") {
          newStartCol += deltaCols;
          newEndCol += deltaCols;
        } else if (mode === "resize-start") {
          newStartCol += deltaCols;
          if (newStartCol > newEndCol) newStartCol = newEndCol;
        } else if (mode === "resize-end") {
          newEndCol += deltaCols;
          if (newEndCol < newStartCol) newEndCol = newStartCol;
        }

        // Clamp to valid range
        newStartCol = Math.max(0, Math.min(newStartCol, days.length - 1));
        newEndCol = Math.max(0, Math.min(newEndCol, days.length - 1));

        setGanttDragPreview({
          projectId: sourceProjectId.current,
          newStartCol,
          newEndCol,
        });
      }
    },
    [gridContainerRef, days.length]
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (!isDragging.current || !sourceProjectId.current) {
        isDragging.current = false;
        dragModeRef.current = null;
        setDragState(null);
        setGanttDragPreview(null);
        setCursorOnScroller(null);
        return;
      }

      const mode = dragModeRef.current;
      const projId = sourceProjectId.current;

      const container = gridContainerRef.current;
      if (!container) {
        isDragging.current = false;
        dragModeRef.current = null;
        setDragState(null);
        setGanttDragPreview(null);
        setCursorOnScroller(null);
        return;
      }

      const scroller = container.querySelector(".dvn-scroller") as HTMLElement | null;
      if (!scroller) {
        isDragging.current = false;
        dragModeRef.current = null;
        setDragState(null);
        setGanttDragPreview(null);
        setCursorOnScroller(null);
        return;
      }

      const rect = scroller.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const scrollLeft = scroller.scrollLeft;
      const scrollTop = scroller.scrollTop;
      const gridX = mouseX + scrollLeft - LABEL_WIDTH;
      const gridY = mouseY + scrollTop - HEADER_HEIGHT;

      if (mode === "dependency") {
        // Dependency creation — accept drop on any project/sub-project row
        const rowIdx = getRowAtGridY(gridY, ganttRows);
        if (rowIdx >= 0 && rowIdx < ganttRows.length) {
          const targetRow = ganttRows[rowIdx];
          if (
            (targetRow.type === "project" || targetRow.type === "sub-project") &&
            targetRow.projectId &&
            targetRow.projectId !== projId
          ) {
            createDependencyAction({
              sourceProjectId: projId,
              targetProjectId: targetRow.projectId,
            }).catch((err) => console.error("Failed to create dependency:", err));
          }
        }
      } else if (mode === "move" || mode === "resize-start" || mode === "resize-end") {
        const deltaX = gridX - dragOriginX.current;
        const deltaCols = Math.round(deltaX / DAY_COL_WIDTH);

        if (deltaCols !== 0) {
          let newStartCol = dragStartCol.current;
          let newEndCol = dragEndCol.current;

          if (mode === "move") {
            newStartCol += deltaCols;
            newEndCol += deltaCols;
          } else if (mode === "resize-start") {
            newStartCol += deltaCols;
            if (newStartCol > newEndCol) newStartCol = newEndCol;
          } else if (mode === "resize-end") {
            newEndCol += deltaCols;
            if (newEndCol < newStartCol) newEndCol = newStartCol;
          }

          // Clamp to valid range
          if (newStartCol >= 0 && newEndCol < days.length) {
            const newStartDate = format(days[newStartCol], "yyyy-MM-dd");
            const newEndDate = format(days[newEndCol], "yyyy-MM-dd");

            updateProject({
              id: projId,
              startDate: newStartDate,
              endDate: newEndDate,
            }).catch((err) => console.error("Failed to update project dates:", err));
          }
        }
      }

      isDragging.current = false;
      dragModeRef.current = null;
      sourceProjectId.current = null;
      setDragState(null);
      setGanttDragPreview(null);
      setCursorOnScroller(null);
    },
    [ganttRows, days, gridContainerRef, setCursorOnScroller]
  );

  useEffect(() => {
    if (viewMode !== "gantt") return;

    const container = gridContainerRef.current;
    if (!container) return;

    const scroller = container.querySelector(".dvn-scroller") as HTMLElement | null;
    if (!scroller) return;

    scroller.addEventListener("mousedown", handleMouseDown);
    scroller.addEventListener("mousemove", handleMouseMoveForCursor);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      scroller.removeEventListener("mousedown", handleMouseDown);
      scroller.removeEventListener("mousemove", handleMouseMoveForCursor);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [viewMode, gridContainerRef, handleMouseDown, handleMouseMove, handleMouseUp, handleMouseMoveForCursor]);

  // Only expose dragState when in dependency mode (avoid drawing arrows during move/resize)
  // eslint-disable-next-line react-hooks/refs
  const depDragState = dragState && dragModeRef.current === "dependency" ? dragState : null;
  return { dragState: depDragState, ganttDragPreview };
}
