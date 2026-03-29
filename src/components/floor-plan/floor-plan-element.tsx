"use client";

import { useRef, useEffect, useCallback } from "react";
import { Rect, Line, Text, Group, Transformer, Arc } from "react-konva";
import type Konva from "konva";
import type { FloorPlanElement, EditorTool } from "@/types";

function getStrokeProps(style?: string, strokeWidth?: number, stroke?: string) {
  if (style === "none") return { stroke: "transparent", strokeWidth: 0, dash: undefined };
  const sw = strokeWidth ?? 2;
  const sc = stroke ?? "#334155";
  if (style === "dashed") return { stroke: sc, strokeWidth: sw, dash: [8, 4] };
  if (style === "dotted") return { stroke: sc, strokeWidth: sw, dash: [2, 3] };
  return { stroke: sc, strokeWidth: sw, dash: undefined };
}

interface FloorPlanShapeElementProps {
  element: FloorPlanElement;
  nodeId: string;
  isSelected: boolean;
  activeTool: EditorTool;
  isLocked?: boolean;
  onSelect: (e?: { metaKey?: boolean; altKey?: boolean }) => void;
  onUpdate: (updates: Partial<FloorPlanElement>) => void;
  onDragStart?: () => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (x: number, y: number) => void;
  snap: (val: number) => number;
}

export function FloorPlanShapeElement({
  element,
  nodeId,
  isSelected,
  activeTool,
  isLocked = false,
  onSelect,
  onUpdate,
  onDragStart: onDragStartProp,
  onDragMove: onDragMoveProp,
  onDragEnd: onDragEndProp,
  snap,
}: FloorPlanShapeElementProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shapeRef = useRef<any>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current && activeTool === "select") {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, activeTool]);

  const handleDragStart = useCallback(() => {
    onDragStartProp?.();
  }, [onDragStartProp]);

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const x = snap(e.target.x());
      const y = snap(e.target.y());
      if (onDragEndProp) {
        onDragEndProp(x, y);
      } else {
        onUpdate({ x, y });
      }
    },
    [onUpdate, onDragEndProp, snap]
  );

  const handleTransformEnd = useCallback(() => {
    const node = shapeRef.current;
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scale and apply to width/height
    node.scaleX(1);
    node.scaleY(1);

    onUpdate({
      x: snap(node.x()),
      y: snap(node.y()),
      width: snap(Math.max(20, node.width() * scaleX)),
      height: snap(Math.max(20, node.height() * scaleY)),
      rotation: node.rotation(),
    });
  }, [onUpdate, snap]);

  const isDraggable = activeTool === "select" && !isLocked;
  const isClickable = (activeTool === "select" || activeTool === "delete") && !isLocked;

  if (element.type === "wall") {
    const points = element.points ?? [0, 0, 120, 0];
    return (
      <>
        <Line
          ref={shapeRef}
          x={element.x}
          y={element.y}
          rotation={element.rotation ?? 0}
          points={points}
          stroke={element.stroke ?? "#1e293b"}
          strokeWidth={element.strokeWidth ?? 4}
          lineCap="butt"
          draggable={isDraggable}
          onClick={isClickable ? (e: Konva.KonvaEventObject<MouseEvent>) => onSelect({ metaKey: e.evt.metaKey, altKey: e.evt.altKey }) : undefined}
          onTap={isClickable ? () => onSelect() : undefined}
          id={nodeId}
          onDragStart={handleDragStart}
          onDragMove={onDragMoveProp}
          onDragEnd={handleDragEnd}
          onTransformEnd={() => {
            const node = shapeRef.current;
            if (!node) return;
            const scaleX = node.scaleX();
            node.scaleX(1);
            node.scaleY(1);
            const currentPoints = element.points ?? [0, 0, 120, 0];
            const newLength = Math.max(20, Math.round(Math.abs(currentPoints[2]) * scaleX));
            onUpdate({
              x: snap(node.x()),
              y: snap(node.y()),
              rotation: node.rotation(),
              points: [0, 0, newLength, 0],
            });
          }}
          hitStrokeWidth={12}
        />
        {isSelected && activeTool === "select" && (
          <Transformer ref={trRef} rotateEnabled enabledAnchors={["middle-left", "middle-right"]} />
        )}
      </>
    );
  }

  if (element.type === "label") {
    return (
      <Text
        ref={shapeRef}
        x={element.x}
        y={element.y}
        rotation={element.rotation ?? 0}
        text={element.name ?? "Label"}
        fontSize={14}
        fontFamily="Inter, system-ui, sans-serif"
        fill="#374151"
        draggable={isDraggable}
        onClick={isClickable ? (e: Konva.KonvaEventObject<MouseEvent>) => onSelect({ metaKey: e.evt.metaKey, altKey: e.evt.altKey }) : undefined}
        onTap={isClickable ? () => onSelect() : undefined}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      />
    );
  }

  // ─── Door: architectural arc + leaf line ────────────────
  if (element.type === "door") {
    const doorWidth = element.width ?? 40;
    const fxVal = element.flipX;
    const fyVal = element.flipY;

    // Hinge at left (default) or right (flipX)
    const hingeX = fxVal ? doorWidth : 0;
    const _farX = fxVal ? 0 : doorWidth; // eslint-disable-line @typescript-eslint/no-unused-vars

    // Arc rotation depends on both flips:
    // default (left hinge, up): -90  |  flipX (right, up): 180
    // flipY (left, down): 0          |  both (right, down): 90
    const arcRotation = fyVal
      ? (fxVal ? 90 : 0)
      : (fxVal ? 180 : -90);

    // Hit area covers the arc sweep area
    const hitX = Math.min(0, fxVal ? 0 : 0);
    const hitY = fyVal ? 0 : -doorWidth;

    return (
      <>
        <Group
          ref={shapeRef}
          x={element.x}
          y={element.y}
          rotation={element.rotation ?? 0}
          draggable={isDraggable}
          onClick={isClickable ? (e: Konva.KonvaEventObject<MouseEvent>) => onSelect({ metaKey: e.evt.metaKey, altKey: e.evt.altKey }) : undefined}
          onTap={isClickable ? () => onSelect() : undefined}
          id={nodeId}
          onDragStart={handleDragStart}
          onDragMove={onDragMoveProp}
          onDragEnd={handleDragEnd}
        >
          {/* Invisible hit area covering the arc sweep */}
          <Rect
            x={hitX - 4}
            y={hitY - 4}
            width={doorWidth + 8}
            height={doorWidth + 8}
            fill="transparent"
          />
          {/* Door opening gap in wall */}
          <Line
            points={[0, 0, doorWidth, 0]}
            stroke="#ffffff"
            strokeWidth={6}
            listening={false}
          />
          {/* Door leaf line (the panel that swings — from hinge into the arc) */}
          <Line
            points={[hingeX, 0, hingeX, fyVal ? doorWidth : -doorWidth]}
            stroke={element.stroke ?? "#1e293b"}
            strokeWidth={2}
            listening={false}
          />
          {/* Arc showing the sweep area */}
          <Arc
            x={hingeX}
            y={0}
            innerRadius={0}
            outerRadius={doorWidth}
            angle={90}
            rotation={arcRotation}
            fill="rgba(59, 130, 246, 0.06)"
            stroke={element.stroke ?? "#1e293b"}
            strokeWidth={0.8}
            dash={[3, 3]}
            listening={false}
          />
          {/* Hinge point */}
          <Rect
            x={hingeX - 2}
            y={-2}
            width={4}
            height={4}
            fill={element.stroke ?? "#1e293b"}
            cornerRadius={1}
            listening={false}
          />
        </Group>
        {isSelected && activeTool === "select" && (
          <Transformer
            ref={trRef}
            rotateEnabled
            enabledAnchors={["middle-right"]}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 15) return oldBox;
              return newBox;
            }}
            onTransformEnd={() => {
              const node = shapeRef.current;
              if (!node) return;
              const scaleX = node.scaleX();
              node.scaleX(1);
              node.scaleY(1);
              onUpdate({
                x: snap(node.x()),
                y: snap(node.y()),
                width: Math.max(15, Math.round(doorWidth * scaleX)),
                rotation: node.rotation(),
              });
            }}
          />
        )}
      </>
    );
  }

  // ─── Room, corridor — rendered as Rect ────────────────────
  const fillColors: Record<string, string> = {
    room: "#f0f9ff",
    corridor: "#f5f5f5",
  };

  return (
    <>
      <Group>
        <Rect
          ref={shapeRef}
          x={element.x}
          y={element.y}
          width={element.width ?? 120}
          height={element.height ?? 80}
          rotation={element.rotation ?? 0}
          fill={element.fill ?? fillColors[element.type] ?? "#ffffff"}
          {...getStrokeProps(element.strokeStyle, element.strokeWidth, element.stroke)}
          draggable={isDraggable}
          onClick={isClickable ? (e: Konva.KonvaEventObject<MouseEvent>) => onSelect({ metaKey: e.evt.metaKey, altKey: e.evt.altKey }) : undefined}
          onTap={isClickable ? () => onSelect() : undefined}
          id={nodeId}
          onDragStart={handleDragStart}
          onDragMove={onDragMoveProp}
          onDragEnd={handleDragEnd}
          onTransformEnd={handleTransformEnd}
        />
        {element.type === "room" && element.name && (
          <Text
            x={element.x + 8}
            y={element.y + 8}
            text={element.name}
            fontSize={12}
            fontFamily="Inter, system-ui, sans-serif"
            fill="#64748b"
            listening={false}
          />
        )}
      </Group>
      {isSelected && activeTool === "select" && (
        <Transformer
          ref={trRef}
          rotateEnabled
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 20 || newBox.height < 20) return oldBox;
            return newBox;
          }}
        />
      )}
    </>
  );
}
