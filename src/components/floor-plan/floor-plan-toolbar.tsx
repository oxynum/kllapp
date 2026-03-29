"use client";

import { useTranslations } from "next-intl";
import {
  Cursor,
  Rectangle,
  LineSegment,
  Door,
  Desk,
  Tag,
  Trash,
  ArrowCounterClockwise,
  ArrowClockwise,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  GridFour,
  FloppyDisk,
  CircleNotch,
  Check,
} from "@phosphor-icons/react";
import type { EditorTool, GridStyle } from "@/types";

interface FloorPlanToolbarProps {
  activeTool: EditorTool;
  onToolChange: (tool: EditorTool) => void;
  gridSnap: boolean;
  onGridSnapToggle: () => void;
  gridStyle: GridStyle;
  onGridStyleChange: (style: GridStyle) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  zoom: number;
  onSave: () => void;
  isSaving: boolean;
  isDirty: boolean;
}

const TOOLS: { tool: EditorTool; icon: typeof Cursor; labelKey: string }[] = [
  { tool: "select", icon: Cursor, labelKey: "select" },
  { tool: "room", icon: Rectangle, labelKey: "room" },
  { tool: "wall", icon: LineSegment, labelKey: "wall" },
  { tool: "door", icon: Door, labelKey: "door" },
  { tool: "desk", icon: Desk, labelKey: "desk" },
  { tool: "label", icon: Tag, labelKey: "label" },
  { tool: "delete", icon: Trash, labelKey: "delete" },
];

export function FloorPlanToolbar({
  activeTool,
  onToolChange,
  gridSnap,
  onGridSnapToggle,
  gridStyle,
  onGridStyleChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  zoom,
  onSave,
  isSaving,
  isDirty,
}: FloorPlanToolbarProps) {
  const t = useTranslations("floorPlan");

  return (
    <div className="flex items-center gap-1 border-b border-gray-200 bg-white px-3 py-2">
      {/* Drawing tools */}
      <div className="flex items-center gap-0.5 rounded-lg bg-gray-50 p-0.5">
        {TOOLS.map(({ tool, icon: Icon, labelKey }) => (
          <button
            key={tool}
            onClick={() => onToolChange(tool)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              activeTool === tool
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
            title={t(`tools.${labelKey}` as Parameters<typeof t>[0])}
          >
            <Icon size={16} weight={activeTool === tool ? "fill" : "regular"} />
            <span className="hidden lg:inline">
              {t(`tools.${labelKey}` as Parameters<typeof t>[0])}
            </span>
          </button>
        ))}
      </div>

      <div className="mx-2 h-6 w-px bg-gray-200" />

      {/* Undo/Redo */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
          title={`${t("undo")} (⌘Z)`}
        >
          <ArrowCounterClockwise size={16} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
          title={`${t("redo")} (⌘⇧Z)`}
        >
          <ArrowClockwise size={16} />
        </button>
      </div>

      <div className="mx-2 h-6 w-px bg-gray-200" />

      {/* Zoom */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={onZoomOut}
          className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          title={t("zoomOut")}
        >
          <MagnifyingGlassMinus size={16} />
        </button>
        <button
          onClick={onZoomReset}
          className="min-w-[3rem] rounded px-1.5 py-1 text-center text-xs text-gray-500 transition-colors hover:bg-gray-100"
          title={t("zoomReset")}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={onZoomIn}
          className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          title={t("zoomIn")}
        >
          <MagnifyingGlassPlus size={16} />
        </button>
      </div>

      <div className="mx-2 h-6 w-px bg-gray-200" />

      {/* Grid snap + style */}
      <div className="flex items-center gap-0.5 rounded-lg bg-gray-50 p-0.5">
        <button
          onClick={onGridSnapToggle}
          className={`rounded-md px-2 py-1 text-xs transition-colors ${
            gridSnap
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-400 hover:text-gray-600"
          }`}
          title={t("gridSnap")}
        >
          <GridFour size={14} weight={gridSnap ? "fill" : "regular"} />
        </button>
        <button
          onClick={() => onGridStyleChange("dots")}
          className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
            gridStyle === "dots"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-400 hover:text-gray-600"
          }`}
          title="Points"
        >
          ···
        </button>
        <button
          onClick={() => onGridStyleChange("lines")}
          className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
            gridStyle === "lines"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-400 hover:text-gray-600"
          }`}
          title="Lignes"
        >
          ┼
        </button>
        <button
          onClick={() => onGridStyleChange("none")}
          className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
            gridStyle === "none"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-400 hover:text-gray-600"
          }`}
          title="Aucune"
        >
          ∅
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Save */}
      <button
        onClick={onSave}
        disabled={isSaving || !isDirty}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
          isDirty
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "bg-gray-100 text-gray-400"
        } disabled:opacity-50`}
      >
        {isSaving ? (
          <>
            <CircleNotch size={16} className="animate-spin" />
            {t("saving")}
          </>
        ) : isDirty ? (
          <>
            <FloppyDisk size={16} />
            {t("save")}
          </>
        ) : (
          <>
            <Check size={16} />
            {t("saved")}
          </>
        )}
      </button>
    </div>
  );
}
