"use client";

import { useState, useCallback, useEffect, useTransition, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "@phosphor-icons/react";
import { KllappLogo } from "@/components/ui/kllapp-logo";
import { useFloorPlanEditor } from "./use-floor-plan-editor";
import { FloorPlanToolbar } from "./floor-plan-toolbar";
import { FloorPlanProperties } from "./floor-plan-properties";
import { LayersPanel } from "./layers-panel";
import {
  saveFloorPlan,
  deleteFloorPlan,
  getFloorPlanWithDesks,
} from "@/app/(dashboard)/workplace/floor-plan/actions";
import type { FloorPlanElement, DeskData, LayerGroup } from "@/types";

// Dynamic import: Konva requires window/canvas
const FloorPlanCanvas = dynamic(
  () =>
    import("./floor-plan-canvas").then((mod) => ({
      default: mod.FloorPlanCanvas,
    })),
  { ssr: false, loading: () => <CanvasLoading /> }
);

function CanvasLoading() {
  return (
    <div className="flex flex-1 items-center justify-center bg-gray-50">
      <div className="text-sm text-gray-400">Chargement du canvas...</div>
    </div>
  );
}

interface FloorInfo {
  id: string;
  name: string;
  floorNumber: number;
}

interface FloorPlanEditorProps {
  workplaceId: string;
  workplaceName: string;
  floors: FloorInfo[];
  initialFloorPlan: {
    id: string;
    workplaceId: string;
    name: string;
    floorNumber: number;
    layout: FloorPlanElement[];
    groups?: LayerGroup[];
    width: number;
    height: number;
    desks: DeskData[];
  } | null;
}

export function FloorPlanEditor({
  workplaceId,
  workplaceName,
  floors: initialFloors,
  initialFloorPlan,
}: FloorPlanEditorProps) {
  const router = useRouter();
  const t = useTranslations("floorPlan");
  const [isPending, startTransition] = useTransition();

  const [floors, setFloors] = useState<FloorInfo[]>(initialFloors);
  const [activeFloorId, setActiveFloorId] = useState<string | null>(
    initialFloorPlan?.id ?? null
  );
  const [floorPlanName, setFloorPlanName] = useState(
    initialFloorPlan?.name ?? "RDC"
  );
  const [floorNumber, setFloorNumber] = useState(
    initialFloorPlan?.floorNumber ?? 0
  );
  const [canvasWidth, setCanvasWidth] = useState(
    initialFloorPlan?.width ?? 1200
  );
  const [canvasHeight, setCanvasHeight] = useState(
    initialFloorPlan?.height ?? 800
  );

  // Canvas container ref for centering
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const editor = useFloorPlanEditor({
    initialElements: initialFloorPlan?.layout ?? [],
    initialDesks: initialFloorPlan?.desks ?? [],
    initialGroups: initialFloorPlan?.groups ?? [],
  });

  // ─── Measure container for Konva Stage ─────────────────────

  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ─── Keyboard shortcuts ───────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "Delete" || e.key === "Backspace") {
        editor.deleteSelected();
      }
      // Arrow keys: move all selected items 1px (or 10px with Shift)
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        if (editor.selectedIds.size === 0) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        editor.moveSelectedBy(dx, dy);
        return;
      }
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "a") {
          e.preventDefault();
          editor.selectAll([
            ...editor.elements.map((el) => el.id),
            ...editor.desks.map((d) => d.id),
          ]);
        }
        if (e.key === "c") {
          e.preventDefault();
          editor.copySelected();
        }
        if (e.key === "v") {
          e.preventDefault();
          editor.pasteClipboard();
        }
        if (e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          editor.undo();
        }
        if ((e.key === "z" && e.shiftKey) || e.key === "y") {
          e.preventDefault();
          editor.redo();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editor]);

  // ─── Save handler ─────────────────────────────────────────

  const handleSave = useCallback(() => {
    startTransition(async () => {
      const result = await saveFloorPlan({
        workplaceId,
        floorPlanId: activeFloorId ?? undefined,
        name: floorPlanName,
        floorNumber,
        width: canvasWidth,
        height: canvasHeight,
        layout: editor.elements,
        groups: editor.groups,
        desks: editor.desks.map((d) => ({
          id: d.id,
          label: d.label,
          x: d.x,
          y: d.y,
          width: d.width,
          height: d.height,
          rotation: d.rotation,
          isAvailable: d.isAvailable,
          zone: d.zone,
          groupId: d.groupId,
          visible: d.visible,
          locked: d.locked,
        })),
      });

      if (!activeFloorId && result.floorPlanId) {
        setActiveFloorId(result.floorPlanId);
        setFloors((prev) => [
          ...prev,
          {
            id: result.floorPlanId,
            name: floorPlanName,
            floorNumber,
          },
        ]);
      } else {
        setFloors((prev) =>
          prev.map((f) =>
            f.id === activeFloorId
              ? { ...f, name: floorPlanName, floorNumber }
              : f
          )
        );
      }

      editor.markClean();
    });
  }, [
    workplaceId,
    activeFloorId,
    floorPlanName,
    floorNumber,
    canvasWidth,
    canvasHeight,
    editor,
    startTransition,
  ]);

  // ─── Auto-save (debounced 3s after any change) ───────────
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!editor.isDirty || isPending) return;
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      handleSave();
    }, 3000);
    return () => clearTimeout(autoSaveTimerRef.current);
  }, [editor.isDirty, editor.elements, editor.desks, editor.groups, isPending, handleSave]);

  // ─── Floor management ─────────────────────────────────────

  const handleSelectFloor = useCallback(
    async (floorId: string) => {
      if (floorId === activeFloorId) return;
      const data = await getFloorPlanWithDesks(floorId);
      if (data) {
        setActiveFloorId(data.id);
        setFloorPlanName(data.name);
        setFloorNumber(data.floorNumber);
        setCanvasWidth(data.width);
        setCanvasHeight(data.height);
        editor.loadFloorPlan(data.layout, data.desks, data.groups ?? []);
      }
    },
    [activeFloorId, editor]
  );

  const handleAddFloor = useCallback(() => {
    const nextNumber =
      floors.length > 0
        ? Math.max(...floors.map((f) => f.floorNumber)) + 1
        : 0;
    const newName = nextNumber === 0 ? "RDC" : `Étage ${nextNumber}`;

    setActiveFloorId(null);
    setFloorPlanName(newName);
    setFloorNumber(nextNumber);
    setCanvasWidth(1200);
    setCanvasHeight(800);
    editor.loadFloorPlan([], []);
  }, [floors, editor]);

  const _handleDeleteFloor = useCallback( // eslint-disable-line @typescript-eslint/no-unused-vars
    (floorId: string) => {
      if (!confirm(t("confirmDelete"))) return;
      startTransition(async () => {
        await deleteFloorPlan(floorId);
        setFloors((prev) => prev.filter((f) => f.id !== floorId));
        if (activeFloorId === floorId) {
          const remaining = floors.filter((f) => f.id !== floorId);
          if (remaining.length > 0) {
            handleSelectFloor(remaining[0].id);
          } else {
            setActiveFloorId(null);
            editor.loadFloorPlan([], []);
          }
        }
      });
    },
    [activeFloorId, floors, editor, handleSelectFloor, startTransition, t]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-5 py-3">
        <KllappLogo className="h-5 w-auto" />
        <div className="mx-2 h-6 w-px bg-gray-200" />
        <button
          onClick={() => router.back()}
          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-gray-900">{t("title")}</h1>
          <span className="text-base text-gray-400">—</span>
          <span className="text-base text-gray-600">{workplaceName}</span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{t("floorName")}</span>
            <input
              type="text"
              value={floorPlanName}
              onChange={(e) => setFloorPlanName(e.target.value)}
              className="w-32 rounded border border-gray-200 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
            />
          </label>
        </div>
      </div>

      {/* Toolbar */}
      <FloorPlanToolbar
        activeTool={editor.activeTool}
        onToolChange={editor.setActiveTool}
        gridSnap={editor.gridSnap}
        onGridSnapToggle={() => editor.setGridSnap(!editor.gridSnap)}
        gridStyle={editor.gridStyle}
        onGridStyleChange={editor.setGridStyle}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onZoomIn={editor.zoomIn}
        onZoomOut={editor.zoomOut}
        onZoomReset={editor.zoomReset}
        zoom={editor.zoom}
        onSave={handleSave}
        isSaving={isPending}
        isDirty={editor.isDirty}
      />

      {/* Main area: layers panel + canvas + properties panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Layers panel */}
        <div className="w-60 flex-shrink-0 overflow-hidden">
          <LayersPanel
            layerList={editor.layerList}
            groups={editor.groups}
            selectedIds={editor.selectedIds}
            onSelectId={editor.setSelectedId}
            onToggleSelection={editor.toggleSelection}
            onSelectAll={editor.selectAll}
            onUpdateElement={editor.updateElement}
            onUpdateDesk={editor.updateDesk}
            onDeleteElement={editor.deleteElement}
            onDeleteDesk={editor.deleteDesk}
            onMoveUp={editor.moveLayerUp}
            onMoveDown={editor.moveLayerDown}
            onBringToFront={editor.bringToFront}
            onSendToBack={editor.sendToBack}
            onReorderLayer={editor.reorderLayer}
            onAddGroup={editor.addGroup}
            onUpdateGroup={editor.updateGroup}
            onDeleteGroup={editor.deleteGroup}
            onAssignToGroup={editor.assignToGroup}
            floors={floors}
            activeFloorId={activeFloorId}
            onSelectFloor={handleSelectFloor}
            onAddFloor={handleAddFloor}
          />
        </div>

        {/* Center: Canvas area (infinite, Figma-style) */}
        <div
          ref={canvasContainerRef}
          className="flex-1 overflow-hidden"
        >
          <FloorPlanCanvas
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
            zoom={editor.zoom}
            stagePos={editor.stagePos}
            elements={editor.elements}
            desks={editor.desks}
            groups={editor.groups}
            selectedIds={editor.selectedIds}
            activeTool={editor.activeTool}
            gridStyle={editor.gridStyle}
            onCanvasClick={editor.handleCanvasClick}
            onSelectId={editor.setSelectedId}
            onToggleSelection={editor.toggleSelection}
            onUpdateElement={editor.updateElement}
            onUpdateDesk={editor.updateDesk}
            onDeleteId={(id) => {
              const isDesk = editor.desks.some((d) => d.id === id);
              if (isDesk) editor.deleteDesk(id);
              else editor.deleteElement(id);
            }}
            onMoveSelectedBy={editor.moveSelectedBy}
            onWheelZoom={editor.handleWheelZoom}
            onStagePosChange={editor.setStagePos}
            snap={editor.snap}
            gridSnap={editor.gridSnap}
          />
        </div>

        {/* Right: Properties panel */}
        <div className="w-64 flex-shrink-0 overflow-y-auto border-l border-gray-200 bg-white">
          <FloorPlanProperties
            selectedType={editor.selectedType}
            selectedCount={editor.selectedIds.size}
            selectedElement={editor.selectedElement}
            selectedDesk={editor.selectedDesk}
            onUpdateElement={editor.updateElement}
            onUpdateDesk={editor.updateDesk}
            onDelete={editor.deleteSelected}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            onCanvasWidthChange={(w) => { setCanvasWidth(w); editor.markDirty(); }}
            onCanvasHeightChange={(h) => { setCanvasHeight(h); editor.markDirty(); }}
          />
        </div>
      </div>
    </div>
  );
}
