"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import type { FloorPlanElement, DeskData, EditorTool, GridStyle, LayerGroup } from "@/types";

interface EditorState {
  elements: FloorPlanElement[];
  desks: DeskData[];
  groups: LayerGroup[];
}

interface UseFloorPlanEditorOptions {
  initialElements?: FloorPlanElement[];
  initialDesks?: DeskData[];
  initialGroups?: LayerGroup[];
}

const GRID_SIZE = 20;
const MAX_HISTORY = 50;

function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

function generateId(): string {
  return crypto.randomUUID();
}

export function useFloorPlanEditor(options: UseFloorPlanEditorOptions = {}) {
  const { initialElements = [], initialDesks = [], initialGroups = [] } = options;

  const [elements, setElements] = useState<FloorPlanElement[]>(initialElements);
  const [desks, setDesks] = useState<DeskData[]>(initialDesks);
  const [groups, setGroups] = useState<LayerGroup[]>(initialGroups);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTool, setActiveTool] = useState<EditorTool>("select");
  const [gridSnap, setGridSnap] = useState(true);
  const [gridStyle, setGridStyle] = useState<GridStyle>("dots");
  const [zoom, setZoom] = useState(1);
  const [isDirty, setIsDirty] = useState(false);

  // Undo/redo stacks
  const pastRef = useRef<EditorState[]>([]);
  const futureRef = useRef<EditorState[]>([]);

  const pushHistory = useCallback(() => {
    pastRef.current = [
      ...pastRef.current.slice(-MAX_HISTORY),
      { elements: [...elements], desks: [...desks], groups: [...groups] },
    ];
    futureRef.current = [];
  }, [elements, desks, groups]);

  // ─── Undo / Redo ──────────────────────────────────────────

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    const prev = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, { elements, desks, groups }];
    setElements(prev.elements);
    setDesks(prev.desks);
    setGroups(prev.groups);
    setSelectedIds(new Set());
  }, [elements, desks, groups]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    pastRef.current = [...pastRef.current, { elements, desks, groups }];
    setElements(next.elements);
    setDesks(next.desks);
    setGroups(next.groups);
    setSelectedIds(new Set());
  }, [elements, desks, groups]);

  // eslint-disable-next-line react-hooks/refs -- computed from undo/redo stacks
  const canUndo = pastRef.current.length > 0; // eslint-disable-line react-hooks/refs
  // eslint-disable-next-line react-hooks/refs
  const canRedo = futureRef.current.length > 0; // eslint-disable-line react-hooks/refs

  // ─── Snap helper ──────────────────────────────────────────

  const snap = useCallback(
    (val: number) => (gridSnap ? snapToGrid(val, GRID_SIZE) : val),
    [gridSnap]
  );

  // ─── Element CRUD ─────────────────────────────────────────

  const addElement = useCallback(
    (type: FloorPlanElement["type"], x: number, y: number) => {
      pushHistory();
      const el: FloorPlanElement = {
        id: generateId(),
        type,
        x: snap(x),
        y: snap(y),
        width: type === "door" ? 40 : 120,
        height: type === "door" ? 10 : 80,
        rotation: 0,
        fill: type === "room" ? "#f0f9ff" : type === "corridor" ? "#f5f5f5" : undefined,
        stroke: type === "room" || type === "corridor" ? "#334155" : "#1e293b",
        strokeWidth: type === "wall" ? 4 : 2,
        name: type === "room" ? "Pièce" : type === "label" ? "Label" : undefined,
        groupId: null,
        visible: true,
        locked: false,
      };
      if (type === "wall") {
        el.points = [0, 0, 120, 0];
        el.width = undefined;
        el.height = undefined;
      }
      setElements((prev) => [...prev, el]);
      setSelectedIds(new Set([el.id]));
      setIsDirty(true);
      return el;
    },
    [pushHistory, snap]
  );

  const updateElement = useCallback(
    (id: string, updates: Partial<FloorPlanElement>) => {
      pushHistory();
      setElements((prev) =>
        prev.map((el) => (el.id === id ? { ...el, ...updates } : el))
      );
      setIsDirty(true);
    },
    [pushHistory]
  );

  const deleteElement = useCallback(
    (id: string) => {
      pushHistory();
      setElements((prev) => prev.filter((el) => el.id !== id));
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setIsDirty(true);
    },
    [pushHistory]
  );

  // ─── Desk CRUD ────────────────────────────────────────────

  const addDesk = useCallback(
    (x: number, y: number) => {
      pushHistory();
      const deskNumber = desks.length + 1;
      const desk: DeskData = {
        id: generateId(),
        label: `D-${deskNumber}`,
        x: snap(x),
        y: snap(y),
        width: 60,
        height: 40,
        rotation: 0,
        isAvailable: true,
        zone: null,
        groupId: null,
        visible: true,
        locked: false,
      };
      setDesks((prev) => [...prev, desk]);
      setSelectedIds(new Set([desk.id]));
      setIsDirty(true);
      return desk;
    },
    [pushHistory, snap, desks.length]
  );

  const updateDesk = useCallback(
    (id: string, updates: Partial<DeskData>) => {
      pushHistory();
      setDesks((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
      );
      setIsDirty(true);
    },
    [pushHistory]
  );

  const deleteDesk = useCallback(
    (id: string) => {
      pushHistory();
      setDesks((prev) => prev.filter((d) => d.id !== id));
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setIsDirty(true);
    },
    [pushHistory]
  );

  // ─── Group CRUD ───────────────────────────────────────────

  const addGroup = useCallback(
    (name: string = "Groupe") => {
      pushHistory();
      const group: LayerGroup = {
        id: generateId(),
        name,
        isExpanded: true,
        visible: true,
        locked: false,
      };
      setGroups((prev) => [...prev, group]);
      setIsDirty(true);
      return group;
    },
    [pushHistory]
  );

  const updateGroup = useCallback(
    (id: string, updates: Partial<LayerGroup>) => {
      pushHistory();
      setGroups((prev) =>
        prev.map((g) => (g.id === id ? { ...g, ...updates } : g))
      );
      setIsDirty(true);
    },
    [pushHistory]
  );

  const deleteGroup = useCallback(
    (id: string) => {
      pushHistory();
      // Ungroup items — set groupId to null
      setElements((prev) =>
        prev.map((el) => (el.groupId === id ? { ...el, groupId: null } : el))
      );
      setDesks((prev) =>
        prev.map((d) => (d.groupId === id ? { ...d, groupId: null } : d))
      );
      setGroups((prev) => prev.filter((g) => g.id !== id));
      setIsDirty(true);
    },
    [pushHistory]
  );

  const assignToGroup = useCallback(
    (itemId: string, groupId: string | null) => {
      pushHistory();
      const isElement = elements.some((el) => el.id === itemId);
      if (isElement) {
        setElements((prev) =>
          prev.map((el) => (el.id === itemId ? { ...el, groupId } : el))
        );
      } else {
        setDesks((prev) =>
          prev.map((d) => (d.id === itemId ? { ...d, groupId } : d))
        );
      }
      setIsDirty(true);
    },
    [pushHistory, elements]
  );

  // ─── Z-order (reorder elements array) ─────────────────────

  const moveLayerUp = useCallback(
    (id: string) => {
      pushHistory();
      // Check in elements
      setElements((prev) => {
        const idx = prev.findIndex((el) => el.id === id);
        if (idx < 0 || idx >= prev.length - 1) return prev;
        const next = [...prev];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        return next;
      });
      // Check in desks
      setDesks((prev) => {
        const idx = prev.findIndex((d) => d.id === id);
        if (idx < 0 || idx >= prev.length - 1) return prev;
        const next = [...prev];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        return next;
      });
      setIsDirty(true);
    },
    [pushHistory]
  );

  const moveLayerDown = useCallback(
    (id: string) => {
      pushHistory();
      setElements((prev) => {
        const idx = prev.findIndex((el) => el.id === id);
        if (idx <= 0) return prev;
        const next = [...prev];
        [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
        return next;
      });
      setDesks((prev) => {
        const idx = prev.findIndex((d) => d.id === id);
        if (idx <= 0) return prev;
        const next = [...prev];
        [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
        return next;
      });
      setIsDirty(true);
    },
    [pushHistory]
  );

  const bringToFront = useCallback(
    (id: string) => {
      pushHistory();
      setElements((prev) => {
        const idx = prev.findIndex((el) => el.id === id);
        if (idx < 0) return prev;
        const item = prev[idx];
        return [...prev.slice(0, idx), ...prev.slice(idx + 1), item];
      });
      setDesks((prev) => {
        const idx = prev.findIndex((d) => d.id === id);
        if (idx < 0) return prev;
        const item = prev[idx];
        return [...prev.slice(0, idx), ...prev.slice(idx + 1), item];
      });
      setIsDirty(true);
    },
    [pushHistory]
  );

  const sendToBack = useCallback(
    (id: string) => {
      pushHistory();
      setElements((prev) => {
        const idx = prev.findIndex((el) => el.id === id);
        if (idx < 0) return prev;
        const item = prev[idx];
        return [item, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
      });
      setDesks((prev) => {
        const idx = prev.findIndex((d) => d.id === id);
        if (idx < 0) return prev;
        const item = prev[idx];
        return [item, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
      });
      setIsDirty(true);
    },
    [pushHistory]
  );

  // ─── Reorder via drag & drop ────────────────────────────

  const reorderLayer = useCallback(
    (draggedId: string, targetId: string, position: "above" | "below") => {
      pushHistory();

      // The layerList is reversed (top-of-stack first). In the underlying arrays,
      // a higher index = rendered on top. "above" in the panel = higher z-index =
      // should come AFTER the target in the array. "below" = BEFORE.

      // Helper to reorder within one array
      const reorder = <T extends { id: string }>(arr: T[]): T[] => {
        const dragIdx = arr.findIndex((x) => x.id === draggedId);
        const targetIdx = arr.findIndex((x) => x.id === targetId);
        if (dragIdx < 0 || targetIdx < 0) return arr;

        const next = [...arr];
        const [item] = next.splice(dragIdx, 1);
        const newTargetIdx = next.findIndex((x) => x.id === targetId);
        // "above" in panel = higher z = insert AFTER target in array
        // "below" in panel = lower z = insert BEFORE target in array
        const insertIdx = position === "above" ? newTargetIdx + 1 : newTargetIdx;
        next.splice(insertIdx, 0, item);
        return next;
      };

      // Determine which array contains the dragged item
      const isElement = elements.some((el) => el.id === draggedId);
      const isTargetElement = elements.some((el) => el.id === targetId);

      if (isElement && isTargetElement) {
        setElements(reorder);
      } else if (!isElement && !isTargetElement) {
        setDesks(reorder);
      }
      // Cross-array reorder (element↔desk) not supported — they're in separate layers

      setIsDirty(true);
    },
    [pushHistory, elements]
  );

  // ─── Computed: ordered layer list ─────────────────────────

  const layerList = useMemo(() => {
    // Build a flat ordered list: elements first (in order = z-index), then desks
    // Reversed so the topmost item appears first in the layers panel
    const items: { id: string; kind: "element" | "desk"; name: string; type: string; groupId: string | null; visible: boolean; locked: boolean }[] = [];

    for (const el of elements) {
      items.push({
        id: el.id,
        kind: "element",
        name: el.name ?? el.type,
        type: el.type,
        groupId: el.groupId ?? null,
        visible: el.visible !== false,
        locked: el.locked === true,
      });
    }
    for (const d of desks) {
      items.push({
        id: d.id,
        kind: "desk",
        name: d.label,
        type: "desk",
        groupId: d.groupId ?? null,
        visible: d.visible !== false,
        locked: d.locked === true,
      });
    }

    // Reverse so top of z-stack is first in list
    return items.reverse();
  }, [elements, desks]);

  // ─── Selection helpers ────────────────────────────────────

  // Computed: first selected ID for single-selection compat (properties panel)
  const selectedId = selectedIds.size > 0 ? [...selectedIds][0] : null;

  const setSelectedId = useCallback((id: string | null) => {
    setSelectedIds(id ? new Set([id]) : new Set());
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedElement = elements.find((el) => el.id === selectedId) ?? null;
  const selectedDesk = desks.find((d) => d.id === selectedId) ?? null;
  const selectedItem = selectedElement ?? selectedDesk;
  const selectedType: "element" | "desk" | null = selectedElement
    ? "element"
    : selectedDesk
      ? "desk"
      : null;

  const deleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    pushHistory();
    setElements((prev) => prev.filter((el) => !selectedIds.has(el.id)));
    setDesks((prev) => prev.filter((d) => !selectedIds.has(d.id)));
    setSelectedIds(new Set());
    setIsDirty(true);
  }, [selectedIds, pushHistory]);

  // Move all selected items by delta
  const moveSelectedBy = useCallback(
    (dx: number, dy: number) => {
      if (selectedIds.size === 0) return;
      pushHistory();
      setElements((prev) =>
        prev.map((el) =>
          selectedIds.has(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el
        )
      );
      setDesks((prev) =>
        prev.map((d) =>
          selectedIds.has(d.id) ? { ...d, x: d.x + dx, y: d.y + dy } : d
        )
      );
      setIsDirty(true);
    },
    [selectedIds, pushHistory]
  );

  // ─── Canvas click handler ─────────────────────────────────

  const handleCanvasClick = useCallback(
    (x: number, y: number) => {
      switch (activeTool) {
        case "room":
          addElement("room", x, y);
          break;
        case "wall":
          addElement("wall", x, y);
          break;
        case "door":
          addElement("door", x, y);
          break;
        case "label":
          addElement("label", x, y);
          break;
        case "desk":
          addDesk(x, y);
          break;
        case "delete":
          break;
        case "select":
        default:
          clearSelection();
          break;
      }
    },
    [activeTool, addElement, addDesk]
  );

  // ─── Zoom & Pan ────────────────────────────────────────────

  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  const zoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.1, 3)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.1, 0.2)), []);
  const zoomReset = useCallback(() => {
    setZoom(1);
    setStagePos({ x: 0, y: 0 });
  }, []);

  const handleWheelZoom = useCallback(
    (pointer: { x: number; y: number }, deltaY: number) => {
      const scaleBy = 1.08;
      const oldZoom = zoom;
      const newZoom = deltaY < 0
        ? Math.min(oldZoom * scaleBy, 3)
        : Math.max(oldZoom / scaleBy, 0.2);

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

  // ─── Copy / Paste ─────────────────────────────────────────

  const clipboardRef = useRef<{ elements: FloorPlanElement[]; desks: DeskData[]; groups: LayerGroup[] } | null>(null);

  const copySelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const copiedElements = elements.filter((el) => selectedIds.has(el.id)).map((el) => ({ ...el }));
    const copiedDesks = desks.filter((d) => selectedIds.has(d.id)).map((d) => ({ ...d }));

    // Collect groups that have at least one copied item
    const usedGroupIds = new Set<string>();
    for (const el of copiedElements) if (el.groupId) usedGroupIds.add(el.groupId);
    for (const d of copiedDesks) if (d.groupId) usedGroupIds.add(d.groupId);
    const copiedGroups = groups.filter((g) => usedGroupIds.has(g.id)).map((g) => ({ ...g }));

    clipboardRef.current = { elements: copiedElements, desks: copiedDesks, groups: copiedGroups };
  }, [selectedIds, elements, desks, groups]);

  const pasteClipboard = useCallback(() => {
    const clip = clipboardRef.current;
    if (!clip || (clip.elements.length === 0 && clip.desks.length === 0)) return;

    pushHistory();
    const offset = 20;
    const newIds = new Set<string>();

    // Create new groups with new IDs, build old→new mapping
    const groupIdMap = new Map<string, string>();
    const newGroups: LayerGroup[] = clip.groups.map((src) => {
      const newId = generateId();
      groupIdMap.set(src.id, newId);
      return { ...src, id: newId, name: `${src.name} (copie)` };
    });

    const newElements = clip.elements.map((src) => {
      const newEl: FloorPlanElement = {
        ...src,
        id: generateId(),
        x: src.x + offset,
        y: src.y + offset,
        groupId: src.groupId ? (groupIdMap.get(src.groupId) ?? null) : null,
      };
      newIds.add(newEl.id);
      return newEl;
    });
    const newDesks = clip.desks.map((src) => {
      const newDesk: DeskData = {
        ...src,
        id: generateId(),
        x: src.x + offset,
        y: src.y + offset,
        groupId: src.groupId ? (groupIdMap.get(src.groupId) ?? null) : null,
      };
      newIds.add(newDesk.id);
      return newDesk;
    });

    if (newGroups.length > 0) setGroups((prev) => [...prev, ...newGroups]);
    if (newElements.length > 0) setElements((prev) => [...prev, ...newElements]);
    if (newDesks.length > 0) setDesks((prev) => [...prev, ...newDesks]);
    setSelectedIds(newIds);
    // Update clipboard for chained pastes
    clipboardRef.current = { elements: newElements, desks: newDesks, groups: newGroups };
    setIsDirty(true);
  }, [pushHistory]);

  // ─── Reset dirty flag (after save) ────────────────────────

  const markClean = useCallback(() => setIsDirty(false), []);
  const markDirty = useCallback(() => setIsDirty(true), []);

  // ─── Load new floor plan data ─────────────────────────────

  const loadFloorPlan = useCallback(
    (newElements: FloorPlanElement[], newDesks: DeskData[], newGroups: LayerGroup[] = []) => {
      pastRef.current = [];
      futureRef.current = [];
      setElements(newElements);
      setDesks(newDesks);
      setGroups(newGroups);
      setSelectedIds(new Set());
      setIsDirty(false);
    },
    []
  );

  return {
    // State
    elements,
    desks,
    groups,
    selectedIds,
    selectedId,
    selectedItem,
    selectedType,
    selectedElement,
    selectedDesk,
    activeTool,
    gridSnap,
    gridStyle,
    zoom,
    stagePos,
    isDirty,
    canUndo,
    canRedo,
    layerList,

    // Actions
    setActiveTool,
    setSelectedId,
    toggleSelection,
    selectAll,
    clearSelection,
    moveSelectedBy,
    setGridSnap,
    setGridStyle,
    handleCanvasClick,
    addElement,
    updateElement,
    deleteElement,
    addDesk,
    updateDesk,
    deleteDesk,
    deleteSelected,
    undo,
    redo,
    zoomIn,
    zoomOut,
    zoomReset,
    setStagePos,
    handleWheelZoom,
    copySelected,
    pasteClipboard,
    markClean,
    markDirty,
    loadFloorPlan,
    snap,

    // Groups
    addGroup,
    updateGroup,
    deleteGroup,
    assignToGroup,

    // Z-order
    moveLayerUp,
    moveLayerDown,
    bringToFront,
    sendToBack,
    reorderLayer,
  };
}
