"use client";

import { useRef, useEffect, useCallback } from "react";
import { Rect, Text, Group, Transformer, Circle } from "react-konva";
import type Konva from "konva";
import type { DeskData, EditorTool } from "@/types";

interface DeskNodeProps {
  desk: DeskData;
  isSelected: boolean;
  activeTool: EditorTool;
  isLocked?: boolean;
  onSelect: (e?: { metaKey?: boolean; altKey?: boolean }) => void;
  onUpdate: (updates: Partial<DeskData>) => void;
  onDragStart?: () => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (x: number, y: number) => void;
  snap: (val: number) => number;
  nodeId: string;
}

export function DeskNode({
  desk,
  isSelected,
  activeTool,
  isLocked = false,
  onSelect,
  onUpdate,
  onDragStart: onDragStartProp,
  onDragMove: onDragMoveProp,
  onDragEnd: onDragEndProp,
  snap,
  nodeId,
}: DeskNodeProps) {
  const groupRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current && activeTool === "select") {
      trRef.current.nodes([groupRef.current]);
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

  const isDraggable = activeTool === "select" && !isLocked;
  const isClickable = (activeTool === "select" || activeTool === "delete") && !isLocked;

  return (
    <>
      <Group
        ref={groupRef}
        x={desk.x}
        y={desk.y}
        rotation={desk.rotation}
        id={nodeId}
        draggable={isDraggable}
        onClick={isClickable ? (e: Konva.KonvaEventObject<MouseEvent>) => onSelect({ metaKey: e.evt.metaKey, altKey: e.evt.altKey }) : undefined}
        onTap={isClickable ? () => onSelect() : undefined}
        onDragStart={handleDragStart}
        onDragMove={onDragMoveProp}
        onDragEnd={handleDragEnd}
      >
        {/* Desk surface */}
        <Rect
          width={desk.width}
          height={desk.height}
          fill={desk.isAvailable ? "#dbeafe" : "#fee2e2"}
          stroke={isSelected ? "#2563eb" : "#93c5fd"}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={4}
        />
        {/* Chair indicator (small circle at bottom center) */}
        <Circle
          x={desk.width / 2}
          y={desk.height + 10}
          radius={6}
          fill={desk.isAvailable ? "#93c5fd" : "#fca5a5"}
          stroke={isSelected ? "#2563eb" : "#64748b"}
          strokeWidth={1}
        />
        {/* Desk label */}
        <Text
          x={4}
          y={desk.height / 2 - 5}
          width={desk.width - 8}
          text={desk.label}
          fontSize={10}
          fontFamily="Inter, system-ui, sans-serif"
          fill="#1e40af"
          align="center"
          listening={false}
        />
      </Group>
      {isSelected && activeTool === "select" && (
        <Transformer
          ref={trRef}
          rotateEnabled
          enabledAnchors={[
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
          ]}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 30 || newBox.height < 20) return oldBox;
            return newBox;
          }}
          onTransformEnd={() => {
            const node = groupRef.current;
            if (!node) return;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();
            node.scaleX(1);
            node.scaleY(1);
            onUpdate({
              x: snap(node.x()),
              y: snap(node.y()),
              width: Math.max(30, Math.round(desk.width * scaleX)),
              height: Math.max(20, Math.round(desk.height * scaleY)),
              rotation: node.rotation(),
            });
          }}
        />
      )}
    </>
  );
}
