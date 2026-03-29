"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import type { DependencyInfo, SheetRow } from "@/types";
import { format } from "date-fns";
import { deleteDependencyAction } from "@/app/(dashboard)/sheet/dependency-actions";

const ROW_HEIGHT = 36;
const PLACEHOLDER_ROW_HEIGHT = 24;
const DAY_COL_WIDTH = 44;
const LABEL_WIDTH = 220;
const HEADER_HEIGHT = 80; // headerHeight (48) + groupHeaderHeight (32)

function getRowTopY(rowIdx: number, rows: SheetRow[]): number {
  let y = 0;
  for (let i = 0; i < rowIdx; i++) {
    y += rows[i].type === "add-client-placeholder" ? PLACEHOLDER_ROW_HEIGHT : ROW_HEIGHT;
  }
  return y;
}

function getRowHeight(row: SheetRow): number {
  return row.type === "add-client-placeholder" ? PLACEHOLDER_ROW_HEIGHT : ROW_HEIGHT;
}

interface GanttDependencyOverlayProps {
  dependencies: DependencyInfo[];
  rows: SheetRow[];
  days: Date[];
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  dragState?: {
    sourceRowIdx: number;
    sourceEndCol: number;
    sourceY: number;
    mouseX: number;
    mouseY: number;
  } | null;
}

interface ArrowPosition {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Build a cubic bezier S-curve path between two points */
function buildCurvePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x2 - x1);
  const cpOffset = Math.max(dx * 0.4, 30);
  return `M ${x1} ${y1} C ${x1 + cpOffset} ${y1}, ${x2 - cpOffset} ${y2}, ${x2} ${y2}`;
}

export function GanttDependencyOverlay({
  dependencies,
  rows,
  days,
  gridContainerRef,
  dragState,
}: GanttDependencyOverlayProps) {
  const [scrollOffset, setScrollOffset] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Sync scroll from .dvn-scroller
  useEffect(() => {
    const container = gridContainerRef.current;
    if (!container) return;

    const scroller = container.querySelector(".dvn-scroller") as HTMLElement | null;
    if (!scroller) return;

    const handleScroll = () => {
      setScrollOffset({ x: scroller.scrollLeft, y: scroller.scrollTop });
    };

    const handleResize = () => {
      setContainerSize({ width: scroller.clientWidth, height: scroller.clientHeight });
    };

    handleScroll();
    handleResize();

    scroller.addEventListener("scroll", handleScroll, { passive: true });
    const ro = new ResizeObserver(handleResize);
    ro.observe(scroller);

    return () => {
      scroller.removeEventListener("scroll", handleScroll);
      ro.disconnect();
    };
  }, [gridContainerRef]);

  // rows already equals visibleRows (gantt-filtered + placeholders)
  const arrows = useMemo<ArrowPosition[]>(() => {
    const result: ArrowPosition[] = [];

    for (const dep of dependencies) {
      const sourceRow = rows.findIndex(
        (r) => (r.type === "project" || r.type === "sub-project") && r.projectId === dep.sourceProjectId
      );
      const targetRow = rows.findIndex(
        (r) => (r.type === "project" || r.type === "sub-project") && r.projectId === dep.targetProjectId
      );

      if (sourceRow < 0 || targetRow < 0) continue;

      const sourceData = rows[sourceRow];
      const targetData = rows[targetRow];

      if (!sourceData.endDate || !targetData.startDate) continue;

      const sourceEndCol = days.findIndex((d) => format(d, "yyyy-MM-dd") === sourceData.endDate);
      const targetStartCol = days.findIndex((d) => format(d, "yyyy-MM-dd") === targetData.startDate);

      if (sourceEndCol < 0 || targetStartCol < 0) continue;

      const x1 = LABEL_WIDTH + (sourceEndCol + 1) * DAY_COL_WIDTH;
      const y1 = HEADER_HEIGHT + getRowTopY(sourceRow, rows) + getRowHeight(sourceData) / 2;
      const x2 = LABEL_WIDTH + targetStartCol * DAY_COL_WIDTH;
      const y2 = HEADER_HEIGHT + getRowTopY(targetRow, rows) + getRowHeight(targetData) / 2;

      result.push({ id: dep.id, x1, y1, x2, y2 });
    }

    return result;
  }, [dependencies, rows, days]);

  // Culling: only render arrows at least partially visible
  const visibleArrows = useMemo(() => {
    if (!containerSize.width || !containerSize.height) return arrows;

    const viewLeft = scrollOffset.x;
    const viewRight = scrollOffset.x + containerSize.width;
    const viewTop = scrollOffset.y;
    const viewBottom = scrollOffset.y + containerSize.height;

    return arrows.filter((a) => {
      const minX = Math.min(a.x1, a.x2) - LABEL_WIDTH;
      const maxX = Math.max(a.x1, a.x2) - LABEL_WIDTH;
      const minY = Math.min(a.y1, a.y2) - HEADER_HEIGHT;
      const maxY = Math.max(a.y1, a.y2) - HEADER_HEIGHT;

      return maxX >= viewLeft && minX <= viewRight && maxY >= viewTop && minY <= viewBottom;
    });
  }, [arrows, scrollOffset, containerSize]);

  const handleArrowClick = useCallback((depId: string) => {
    deleteDependencyAction(depId).catch((err) =>
      console.error("Failed to delete dependency:", err)
    );
  }, []);

  if (visibleArrows.length === 0 && !dragState) return null;

  const tx = -scrollOffset.x + LABEL_WIDTH;
  const ty = -scrollOffset.y + HEADER_HEIGHT;

  return (
    <svg
      className="absolute left-0 top-0 z-10"
      style={{
        width: containerSize.width || "100%",
        height: containerSize.height || "100%",
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <defs>
        <marker
          id="dep-arrowhead"
          markerWidth="6"
          markerHeight="5"
          refX="5.5"
          refY="2.5"
          orient="auto"
        >
          <polygon points="0 0, 6 2.5, 0 5" fill="#9ca3af" />
        </marker>
        <marker
          id="dep-arrowhead-drag"
          markerWidth="6"
          markerHeight="5"
          refX="5.5"
          refY="2.5"
          orient="auto"
        >
          <polygon points="0 0, 6 2.5, 0 5" fill="#9ca3af" />
        </marker>
      </defs>

      <g transform={`translate(${tx}, ${ty})`}>
        {visibleArrows.map((a) => {
          const ax1 = a.x1 - LABEL_WIDTH;
          const ay1 = a.y1 - HEADER_HEIGHT;
          const ax2 = a.x2 - LABEL_WIDTH;
          const ay2 = a.y2 - HEADER_HEIGHT;
          const path = buildCurvePath(ax1, ay1, ax2, ay2);

          return (
            <g key={a.id}>
              {/* Invisible wide hit area for click */}
              <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth={14}
                style={{ pointerEvents: "stroke", cursor: "pointer" }}
                onClick={() => handleArrowClick(a.id)}
              />
              {/* Visible dashed curved arrow */}
              <path
                d={path}
                fill="none"
                stroke="#9ca3af"
                strokeWidth={1}
                strokeDasharray="5 3"
                markerEnd="url(#dep-arrowhead)"
                style={{ pointerEvents: "none" }}
              />
            </g>
          );
        })}

        {/* Temporary drag line — also curved & dashed */}
        {dragState && (() => {
          const dx1 = dragState.sourceEndCol * DAY_COL_WIDTH + DAY_COL_WIDTH;
          const dy1 = dragState.sourceY;
          const dx2 = dragState.mouseX - LABEL_WIDTH + scrollOffset.x;
          const dy2 = dragState.mouseY - HEADER_HEIGHT + scrollOffset.y;
          const dragPath = buildCurvePath(dx1, dy1, dx2, dy2);
          return (
            <path
              d={dragPath}
              fill="none"
              stroke="#9ca3af"
              strokeWidth={1}
              strokeDasharray="4 3"
              markerEnd="url(#dep-arrowhead-drag)"
              style={{ pointerEvents: "none" }}
            />
          );
        })()}
      </g>
    </svg>
  );
}
