"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { Stage, Layer, Rect, Line, Text, Group, Circle, Arc } from "react-konva";
import type Konva from "konva";
import type { FloorPlanElement, DeskBookingStatus } from "@/types";

const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface BookableDesk {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  status: DeskBookingStatus;
  bookedByUserName?: string | null;
  bookedByUserImage?: string | null;
}

interface DeskBookingCanvasProps {
  width: number;
  height: number;
  layout: FloorPlanElement[];
  desks: BookableDesk[];
  selectedDeskId: string | null;
  onSelectDesk: (deskId: string) => void;
  containerWidth: number;
  containerHeight: number;
}

const STATUS_COLORS: Record<DeskBookingStatus, { fill: string; stroke: string; dash: number[] }> = {
  available: { fill: "rgba(110,231,183,0.08)", stroke: "#059669", dash: [4, 3] },
  booked: { fill: "rgba(209,213,219,0.08)", stroke: "#9ca3af", dash: [4, 3] },
  team: { fill: "rgba(249,168,212,0.08)", stroke: "#db2777", dash: [4, 3] },
  yours: { fill: "rgba(147,197,253,0.12)", stroke: "#2563eb", dash: [4, 3] },
  unavailable: { fill: "rgba(252,165,165,0.06)", stroke: "#dc2626", dash: [4, 3] },
};

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;

export function DeskBookingCanvas({
  width,
  height,
  layout,
  desks,
  selectedDeskId,
  onSelectDesk,
  containerWidth,
  containerHeight,
}: DeskBookingCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);

  // Compute initial zoom to fit the plan in the container with padding
  const fitZoom = Math.min(
    (containerWidth - 40) / width,
    (containerHeight - 40) / height,
    1.5 // Don't zoom in too much on small plans
  );

  const [zoom, setZoom] = useState(fitZoom);
  const [stagePos, setStagePos] = useState({
    x: Math.max(0, (containerWidth - width * fitZoom) / 2),
    y: Math.max(0, (containerHeight - height * fitZoom) / 2),
  });

  // Re-center when container resizes
  useEffect(() => {
    const newFit = Math.min(
      (containerWidth - 40) / width,
      (containerHeight - 40) / height,
      1.5
    );
    queueMicrotask(() => {
      setZoom(newFit);
      setStagePos({
        x: Math.max(0, (containerWidth - width * newFit) / 2),
        y: Math.max(0, (containerHeight - height * newFit) / 2),
      });
    });
  }, [containerWidth, containerHeight, width, height]);

  // ─── Zoom with mouse wheel ────────────────────────────────
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const scaleBy = 1.08;
      const oldZoom = zoom;
      const newZoom = e.evt.deltaY < 0
        ? Math.min(oldZoom * scaleBy, MAX_ZOOM)
        : Math.max(oldZoom / scaleBy, MIN_ZOOM);

      // Zoom toward pointer position
      const mousePointTo = {
        x: (pointer.x - stagePos.x) / oldZoom,
        y: (pointer.y - stagePos.y) / oldZoom,
      };

      setZoom(newZoom);
      setStagePos({
        x: pointer.x - mousePointTo.x * newZoom,
        y: pointer.y - mousePointTo.y * newZoom,
      });
    },
    [zoom, stagePos]
  );

  // ─── Drag to pan ──────────────────────────────────────────
  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    setStagePos({ x: e.target.x(), y: e.target.y() });
  }, []);

  const handleDeskClick = useCallback(
    (deskId: string, status: DeskBookingStatus) => {
      if (status === "available" || status === "yours") {
        onSelectDesk(deskId);
      }
    },
    [onSelectDesk]
  );

  return (
    <Stage
      ref={stageRef}
      width={containerWidth}
      height={containerHeight}
      scaleX={zoom}
      scaleY={zoom}
      x={stagePos.x}
      y={stagePos.y}
      draggable
      onDragEnd={handleDragEnd}
      onWheel={handleWheel}
      style={{ cursor: "grab" }}
    >
      {/* Layout layer (non-interactive) */}
      <Layer listening={false}>
        {/* Canvas background — transparent to show dot grid behind */}

        {layout.map((el) => {
          // In booking mode, always show all structural elements (walls, rooms, doors)
          // The "visible" flag is an editor-only feature for layer toggling

          if (el.type === "wall") {
            return (
              <Line
                key={el.id}
                x={el.x}
                y={el.y}
                rotation={el.rotation ?? 0}
                points={el.points ?? [0, 0, 120, 0]}
                stroke={el.stroke ?? "#1e293b"}
                strokeWidth={el.strokeWidth ?? 4}
                lineCap="butt"
              />
            );
          }
          if (el.type === "door") {
            const doorWidth = el.width ?? 40;
            const hingeX = el.flipX ? doorWidth : 0;
            const arcRotation = el.flipY
              ? (el.flipX ? 90 : 0)
              : (el.flipX ? 180 : -90);
            return (
              <Group key={el.id} x={el.x} y={el.y} rotation={el.rotation ?? 0}>
                <Line points={[0, 0, doorWidth, 0]} stroke="#ffffff" strokeWidth={6} />
                <Line points={[hingeX, 0, hingeX, el.flipY ? doorWidth : -doorWidth]} stroke={el.stroke ?? "#1e293b"} strokeWidth={2} />
                <Arc
                  x={hingeX} y={0}
                  innerRadius={0} outerRadius={doorWidth}
                  angle={90} rotation={arcRotation}
                  fill="rgba(59,130,246,0.04)"
                  stroke={el.stroke ?? "#1e293b"}
                  strokeWidth={0.6} dash={[3, 3]}
                />
              </Group>
            );
          }
          if (el.type === "label") {
            return (
              <Text
                key={el.id}
                x={el.x}
                y={el.y}
                text={el.name ?? ""}
                fontSize={12}
                fontFamily="Inter, system-ui, sans-serif"
                fill="#64748b"
              />
            );
          }
          return (
            <Group key={el.id}>
              <Rect
                x={el.x}
                y={el.y}
                width={el.width ?? 120}
                height={el.height ?? 80}
                rotation={el.rotation ?? 0}
                fill={el.fill ?? "#f8fafc"}
                stroke={el.strokeStyle === "none" ? "transparent" : (el.stroke ?? "#e2e8f0")}
                strokeWidth={el.strokeStyle === "none" ? 0 : (el.strokeWidth ?? 1)}
                dash={el.strokeStyle === "dashed" ? [8, 4] : el.strokeStyle === "dotted" ? [2, 3] : undefined}
              />
              {el.type === "room" && el.name && (
                <Text
                  x={el.x + 6}
                  y={el.y + 6}
                  text={el.name}
                  fontSize={11}
                  fontFamily="Inter, system-ui, sans-serif"
                  fill="#94a3b8"
                />
              )}
            </Group>
          );
        })}
      </Layer>

      {/* Desks layer (interactive) */}
      <Layer>
        {desks.map((desk) => {
          const colors = STATUS_COLORS[desk.status];
          const isSelected = selectedDeskId === desk.id;
          const isClickable = desk.status === "available" || desk.status === "yours";

          return (
            <Group
              key={desk.id}
              x={desk.x}
              y={desk.y}
              rotation={desk.rotation}
              onClick={() => handleDeskClick(desk.id, desk.status)}
              onTap={() => handleDeskClick(desk.id, desk.status)}
              listening={isClickable}
            >
              {/* Desk surface */}
              <Rect
                width={desk.width}
                height={desk.height}
                fill={isSelected ? "rgba(147,197,253,0.15)" : colors.fill}
                stroke={isSelected ? "#2563eb" : colors.stroke}
                strokeWidth={isSelected ? 2 : 1}
                dash={isSelected ? [6, 3] : colors.dash}
                cornerRadius={3}
              />
              {/* Chair */}
              <Circle
                x={desk.width / 2}
                y={desk.height + 8}
                radius={5}
                fill="transparent"
                stroke={isSelected ? "#2563eb" : colors.stroke}
                strokeWidth={1}
                dash={[3, 2]}
              />
              {/* Label */}
              <Text
                x={2}
                y={desk.height / 2 - 5}
                width={desk.width - 4}
                text={desk.label}
                fontSize={9}
                fontFamily="Inter, system-ui, sans-serif"
                fill={desk.status === "booked" ? "#6b7280" : "#1e293b"}
                align="center"
                listening={false}
              />
              {/* Occupant avatar for booked/team */}
              {desk.bookedByUserName && desk.status !== "available" && (
                <Group x={desk.width / 2} y={-12} listening={false}>
                  <Circle
                    radius={9}
                    fill={getAvatarColor(desk.bookedByUserName)}
                  />
                  <Text
                    x={-9}
                    y={-5}
                    width={18}
                    text={getInitials(desk.bookedByUserName)}
                    fontSize={7}
                    fontFamily="Inter, system-ui, sans-serif"
                    fill="#ffffff"
                    fontStyle="bold"
                    align="center"
                  />
                </Group>
              )}
            </Group>
          );
        })}
      </Layer>
    </Stage>
  );
}
