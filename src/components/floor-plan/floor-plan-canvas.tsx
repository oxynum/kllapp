"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { Stage, Layer, Rect, Line, Circle } from "react-konva";
import type Konva from "konva";
import type { FloorPlanElement, DeskData, EditorTool, GridStyle, LayerGroup } from "@/types";
import { FloorPlanShapeElement } from "./floor-plan-element";
import { DeskNode } from "./desk-node";

interface FloorPlanCanvasProps {
  canvasWidth: number;
  canvasHeight: number;
  containerWidth: number;
  containerHeight: number;
  zoom: number;
  stagePos: { x: number; y: number };
  elements: FloorPlanElement[];
  desks: DeskData[];
  groups: LayerGroup[];
  selectedIds: Set<string>;
  activeTool: EditorTool;
  gridStyle: GridStyle;
  onCanvasClick: (x: number, y: number) => void;
  onSelectId: (id: string | null) => void;
  onToggleSelection: (id: string) => void;
  onUpdateElement: (id: string, updates: Partial<FloorPlanElement>) => void;
  onUpdateDesk: (id: string, updates: Partial<DeskData>) => void;
  onDeleteId: (id: string) => void;
  onMoveSelectedBy: (dx: number, dy: number) => void;
  onWheelZoom: (pointer: { x: number; y: number }, deltaY: number) => void;
  onStagePosChange: (pos: { x: number; y: number }) => void;
  snap: (val: number) => number;
  gridSnap: boolean;
}

const GRID_SIZE = 20;

function isItemVisible(
  item: { visible?: boolean; groupId?: string | null },
  groups: LayerGroup[]
): boolean {
  if (item.visible === false) return false;
  if (item.groupId) {
    const group = groups.find((g) => g.id === item.groupId);
    if (group && !group.visible) return false;
  }
  return true;
}

function isItemLocked(
  item: { locked?: boolean; groupId?: string | null },
  groups: LayerGroup[]
): boolean {
  if (item.locked) return true;
  if (item.groupId) {
    const group = groups.find((g) => g.id === item.groupId);
    if (group?.locked) return true;
  }
  return false;
}

export function FloorPlanCanvas({
  canvasWidth,
  canvasHeight,
  containerWidth,
  containerHeight,
  zoom,
  stagePos,
  elements,
  desks,
  groups,
  selectedIds,
  activeTool,
  gridStyle,
  onCanvasClick,
  onSelectId,
  onToggleSelection,
  onUpdateElement,
  onUpdateDesk,
  onDeleteId,
  onMoveSelectedBy,
  onWheelZoom,
  onStagePosChange,
  snap,
}: FloorPlanCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const isDrawingTool = activeTool !== "select" && activeTool !== "delete";
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragInitialPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const draggedItemIdRef = useRef<string | null>(null);

  // Space key held = pan mode (like Figma)
  const [spaceHeld, setSpaceHeld] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // ─── Manual pan via mouse when Space held ──────────────────
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!spaceHeld) return;
      e.evt.preventDefault();
      isPanningRef.current = true;
      panStartRef.current = { x: e.evt.clientX - stagePos.x, y: e.evt.clientY - stagePos.y };
    },
    [spaceHeld, stagePos]
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isPanningRef.current) return;
      onStagePosChange({
        x: e.evt.clientX - panStartRef.current.x,
        y: e.evt.clientY - panStartRef.current.y,
      });
    },
    [onStagePosChange]
  );

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isDrawingTool && e.target !== e.currentTarget) return;
      const stage = stageRef.current;
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      // Convert screen coords to canvas coords
      const x = (pos.x - stagePos.x) / zoom;
      const y = (pos.y - stagePos.y) / zoom;
      onCanvasClick(x, y);
    },
    [zoom, stagePos, onCanvasClick, isDrawingTool]
  );

  // ─── Multi-drag helpers ─────────────────────────────────

  const handleMultiDragStart = useCallback(
    (itemId: string, startX: number, startY: number) => {
      draggedItemIdRef.current = itemId;
      dragStartPosRef.current = { x: startX, y: startY };

      // Record initial positions of all selected items
      const positions = new Map<string, { x: number; y: number }>();
      if (selectedIds.size > 1 && selectedIds.has(itemId)) {
        for (const el of elements) {
          if (selectedIds.has(el.id) && el.id !== itemId) {
            positions.set(el.id, { x: el.x, y: el.y });
          }
        }
        for (const d of desks) {
          if (selectedIds.has(d.id) && d.id !== itemId) {
            positions.set(d.id, { x: d.x, y: d.y });
          }
        }
      }
      dragInitialPositionsRef.current = positions;
    },
    [selectedIds, elements, desks]
  );

  const handleMultiDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (!dragStartPosRef.current || dragInitialPositionsRef.current.size === 0) return;

      const dx = e.target.x() - dragStartPosRef.current.x;
      const dy = e.target.y() - dragStartPosRef.current.y;

      // Move other selected Konva nodes directly (no React re-render)
      const stage = stageRef.current;
      if (!stage) return;

      dragInitialPositionsRef.current.forEach((pos, id) => {
        const node = stage.findOne(`#${id}`);
        if (node) {
          node.x(pos.x + dx);
          node.y(pos.y + dy);
        }
      });
    },
    []
  );

  const handleMultiDragEnd = useCallback(
    (itemId: string, finalX: number, finalY: number) => {
      if (selectedIds.has(itemId) && selectedIds.size > 1 && dragStartPosRef.current) {
        const dx = finalX - dragStartPosRef.current.x;
        const dy = finalY - dragStartPosRef.current.y;
        onMoveSelectedBy(dx, dy);
      } else {
        // Single item drag
        const isDesk = desks.some((d) => d.id === itemId);
        if (isDesk) {
          onUpdateDesk(itemId, { x: finalX, y: finalY });
        } else {
          onUpdateElement(itemId, { x: finalX, y: finalY });
        }
      }
      dragStartPosRef.current = null;
      dragInitialPositionsRef.current.clear();
      draggedItemIdRef.current = null;
    },
    [selectedIds, desks, onMoveSelectedBy, onUpdateElement, onUpdateDesk]
  );

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      onWheelZoom(pointer, e.evt.deltaY);
    },
    [onWheelZoom]
  );

  // Grid rendering (only inside the canvas area)
  const gridElements: React.ReactNode[] = [];
  if (gridStyle === "lines") {
    for (let x = 0; x <= canvasWidth; x += GRID_SIZE) {
      gridElements.push(
        <Line key={`gv-${x}`} points={[x, 0, x, canvasHeight]} stroke="#e5e7eb" strokeWidth={0.5} listening={false} />
      );
    }
    for (let y = 0; y <= canvasHeight; y += GRID_SIZE) {
      gridElements.push(
        <Line key={`gh-${y}`} points={[0, y, canvasWidth, y]} stroke="#e5e7eb" strokeWidth={0.5} listening={false} />
      );
    }
  } else if (gridStyle === "dots") {
    for (let x = GRID_SIZE; x < canvasWidth; x += GRID_SIZE) {
      for (let y = GRID_SIZE; y < canvasHeight; y += GRID_SIZE) {
        gridElements.push(
          <Circle key={`gd-${x}-${y}`} x={x} y={y} radius={0.8} fill="#d1d5db" listening={false} />
        );
      }
    }
  }

  const visibleElements = elements.filter((el) => isItemVisible(el, groups));
  const visibleDesks = desks.filter((d) => isItemVisible(d, groups));

  return (
    <Stage
      ref={stageRef}
      width={containerWidth}
      height={containerHeight}
      scaleX={zoom}
      scaleY={zoom}
      x={stagePos.x}
      y={stagePos.y}
      draggable={false}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleStageClick}
      onWheel={handleWheel}
      style={{
        cursor: spaceHeld ? "grabbing" : isDrawingTool ? "crosshair" : activeTool === "delete" ? "not-allowed" : "default",
      }}
    >
      {/* Background + grid layer */}
      <Layer listening={false}>
        {/* Infinite gray background */}
        <Rect
          x={-10000}
          y={-10000}
          width={20000}
          height={20000}
          fill="#f3f4f6"
          listening={false}
        />
        {/* Canvas area (white) */}
        <Rect
          x={0}
          y={0}
          width={canvasWidth}
          height={canvasHeight}
          fill="#ffffff"
          listening={false}
        />
        {gridElements}
      </Layer>

      {/* Elements layer */}
      <Layer listening={!isDrawingTool && !spaceHeld}>
        {visibleElements.map((el) => (
          <FloorPlanShapeElement
            key={el.id}
            element={el}
            nodeId={el.id}
            isSelected={selectedIds.has(el.id)}
            activeTool={activeTool}
            isLocked={isItemLocked(el, groups)}
            onSelect={(e?: { metaKey?: boolean; altKey?: boolean }) => {
              if (activeTool === "delete" && !isItemLocked(el, groups)) {
                onDeleteId(el.id);
              } else if (e?.metaKey || e?.altKey) {
                onToggleSelection(el.id);
              } else {
                onSelectId(el.id);
              }
            }}
            onUpdate={(updates) => onUpdateElement(el.id, updates)}
            onDragStart={() => handleMultiDragStart(el.id, el.x, el.y)}
            onDragMove={handleMultiDragMove}
            onDragEnd={(newX: number, newY: number) => handleMultiDragEnd(el.id, newX, newY)}
            snap={snap}
          />
        ))}
      </Layer>

      {/* Desks layer */}
      <Layer listening={!isDrawingTool && !spaceHeld}>
        {visibleDesks.map((desk) => (
          <DeskNode
            key={desk.id}
            desk={desk}
            nodeId={desk.id}
            isSelected={selectedIds.has(desk.id)}
            activeTool={activeTool}
            isLocked={isItemLocked(desk, groups)}
            onSelect={(e?: { metaKey?: boolean; altKey?: boolean }) => {
              if (activeTool === "delete" && !isItemLocked(desk, groups)) {
                onDeleteId(desk.id);
              } else if (e?.metaKey || e?.altKey) {
                onToggleSelection(desk.id);
              } else {
                onSelectId(desk.id);
              }
            }}
            onUpdate={(updates) => onUpdateDesk(desk.id, updates)}
            onDragStart={() => handleMultiDragStart(desk.id, desk.x, desk.y)}
            onDragMove={handleMultiDragMove}
            onDragEnd={(newX: number, newY: number) => handleMultiDragEnd(desk.id, newX, newY)}
            snap={snap}
          />
        ))}
      </Layer>
    </Stage>
  );
}
