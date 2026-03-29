"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Eye,
  EyeSlash,
  Lock,
  LockOpen,
  Trash,
  FolderSimplePlus,
  FolderSimple,
  CaretDown,
  CaretRight,
  ArrowUp,
  ArrowDown,
  Rectangle,
  LineSegment,
  Door,
  Desk,
  Tag,
  MapPin,
  DotsSixVertical,
} from "@phosphor-icons/react";
import type { FloorPlanElement, DeskData, LayerGroup } from "@/types";

const TYPE_ICONS: Record<string, typeof Rectangle> = {
  room: Rectangle,
  wall: LineSegment,
  door: Door,
  corridor: MapPin,
  label: Tag,
  desk: Desk,
};

const TYPE_COLORS: Record<string, string> = {
  room: "#93c5fd",
  wall: "#475569",
  door: "#fbbf24",
  corridor: "#a3a3a3",
  label: "#a78bfa",
  desk: "#6ee7b7",
};

interface LayerItem {
  id: string;
  kind: "element" | "desk";
  name: string;
  type: string;
  groupId: string | null;
  visible: boolean;
  locked: boolean;
}

interface FloorInfo {
  id: string;
  name: string;
  floorNumber: number;
}

// ─── Drop indicator position ────────────────────────────────

interface DropTarget {
  targetId: string;
  position: "above" | "below" | "into-group";
}

interface LayersPanelProps {
  layerList: LayerItem[];
  groups: LayerGroup[];
  selectedIds: Set<string>;
  onSelectId: (id: string | null) => void;
  onToggleSelection: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onUpdateElement: (id: string, updates: Partial<FloorPlanElement>) => void;
  onUpdateDesk: (id: string, updates: Partial<DeskData>) => void;
  onDeleteElement: (id: string) => void;
  onDeleteDesk: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
  onAddGroup: (name?: string) => LayerGroup;
  onUpdateGroup: (id: string, updates: Partial<LayerGroup>) => void;
  onDeleteGroup: (id: string) => void;
  onAssignToGroup: (itemId: string, groupId: string | null) => void;
  onReorderLayer: (draggedId: string, targetId: string, position: "above" | "below") => void;
  // Floors navigation
  floors: FloorInfo[];
  activeFloorId: string | null;
  onSelectFloor: (floorId: string) => void;
  onAddFloor: () => void;
}

export function LayersPanel({
  layerList,
  groups,
  selectedIds,
  onSelectId,
  onToggleSelection,
  onSelectAll,
  onUpdateElement,
  onUpdateDesk,
  onDeleteElement,
  onDeleteDesk,
  onMoveUp,
  onMoveDown,
  onAddGroup,
  onUpdateGroup,
  onDeleteGroup,
  onAssignToGroup,
  onReorderLayer,
  floors,
  activeFloorId,
  onSelectFloor,
  onAddFloor,
}: LayersPanelProps) {
  const t = useTranslations("floorPlan");
  const tBooking = useTranslations("deskBooking");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // ─── Drag & Drop state ────────────────────────────────────
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const handleDragStart = useCallback((id: string, e: React.DragEvent) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    // Make the drag ghost semi-transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.4";
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedId(null);
    setDropTarget(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
  }, []);

  const handleDragOver = useCallback(
    (targetId: string, e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (targetId === draggedId) return;

      // Calculate if dropping above or below based on mouse Y position
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const position: "above" | "below" = e.clientY < midY ? "above" : "below";

      setDropTarget({ targetId, position });
    },
    [draggedId]
  );

  const handleDragOverGroup = useCallback(
    (groupId: string, e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (groupId === draggedId) return;
      setDropTarget({ targetId: groupId, position: "into-group" });
    },
    [draggedId]
  );

  const handleDrop = useCallback(
    (targetId: string, position: "above" | "below" | "into-group", e: React.DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain");
      if (!id || id === targetId) return;

      if (position === "into-group") {
        // Drop into a group
        onAssignToGroup(id, targetId);
      } else {
        onReorderLayer(id, targetId, position);
      }

      setDraggedId(null);
      setDropTarget(null);
    },
    [onReorderLayer, onAssignToGroup]
  );

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  // ─── Rename helpers ───────────────────────────────────────

  const startRename = useCallback((id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
  }, []);

  const commitRename = useCallback(
    (id: string, kind: "element" | "desk" | "group") => {
      if (!renameValue.trim()) {
        setRenamingId(null);
        return;
      }
      if (kind === "element") onUpdateElement(id, { name: renameValue.trim() });
      else if (kind === "desk") onUpdateDesk(id, { label: renameValue.trim() });
      else if (kind === "group") onUpdateGroup(id, { name: renameValue.trim() });
      setRenamingId(null);
    },
    [renameValue, onUpdateElement, onUpdateDesk, onUpdateGroup]
  );

  const toggleVisibility = useCallback(
    (id: string, kind: "element" | "desk" | "group", currentVisible: boolean) => {
      if (kind === "element") onUpdateElement(id, { visible: !currentVisible });
      else if (kind === "desk") onUpdateDesk(id, { visible: !currentVisible });
      else if (kind === "group") onUpdateGroup(id, { visible: !currentVisible });
    },
    [onUpdateElement, onUpdateDesk, onUpdateGroup]
  );

  const toggleLock = useCallback(
    (id: string, kind: "element" | "desk" | "group", currentLocked: boolean) => {
      if (kind === "element") onUpdateElement(id, { locked: !currentLocked });
      else if (kind === "desk") onUpdateDesk(id, { locked: !currentLocked });
      else if (kind === "group") onUpdateGroup(id, { locked: !currentLocked });
    },
    [onUpdateElement, onUpdateDesk, onUpdateGroup]
  );

  const handleDelete = useCallback(
    (id: string, kind: "element" | "desk" | "group") => {
      if (kind === "element") onDeleteElement(id);
      else if (kind === "desk") onDeleteDesk(id);
      else if (kind === "group") onDeleteGroup(id);
    },
    [onDeleteElement, onDeleteDesk, onDeleteGroup]
  );

  // Organize: ungrouped items + groups with their children
  const groupedItems: Record<string, LayerItem[]> = {};
  const ungroupedItems: LayerItem[] = [];

  for (const item of layerList) {
    if (item.groupId) {
      if (!groupedItems[item.groupId]) groupedItems[item.groupId] = [];
      groupedItems[item.groupId].push(item);
    } else {
      ungroupedItems.push(item);
    }
  }

  return (
    <div className="flex h-full flex-col border-r border-gray-200 bg-white">
      {/* ─── Floors section ─── */}
      <div className="border-b border-gray-200">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            {tBooking("floor")}
          </span>
        </div>
        <div className="max-h-28 overflow-y-auto px-1.5 pb-1.5">
          {floors.map((floor) => (
            <button
              key={floor.id}
              onClick={() => onSelectFloor(floor.id)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors ${
                activeFloorId === floor.id
                  ? "bg-blue-50 font-medium text-blue-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span className="w-4 text-center text-xs text-gray-400">
                {floor.floorNumber}
              </span>
              {floor.name}
            </button>
          ))}
          <button
            onClick={onAddFloor}
            className="mt-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
          >
            <span className="w-4 text-center">+</span>
            {t("addFloor")}
          </button>
        </div>
      </div>

      {/* ─── Layers section ─── */}
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Calques
        </span>
        <button
          onClick={() => onAddGroup()}
          className="rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          title="Nouveau groupe"
        >
          <FolderSimplePlus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Groups */}
        {groups.map((group) => {
          const children = groupedItems[group.id] ?? [];
          const isGroupDropTarget =
            dropTarget?.targetId === group.id &&
            dropTarget.position === "into-group";

          return (
            <div
              key={group.id}
              className={`border-b border-gray-50 ${
                isGroupDropTarget ? "bg-amber-50 ring-1 ring-inset ring-amber-300" : ""
              }`}
              onDragOver={(e) => handleDragOverGroup(group.id, e)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(group.id, "into-group", e)}
            >
              {/* Group header */}
              <div className="flex items-center gap-1 px-1.5 py-1 hover:bg-gray-50">
                <button
                  onClick={() =>
                    onUpdateGroup(group.id, {
                      isExpanded: !group.isExpanded,
                    })
                  }
                  className="p-0.5 text-gray-400"
                >
                  {group.isExpanded ? (
                    <CaretDown size={10} />
                  ) : (
                    <CaretRight size={10} />
                  )}
                </button>
                <FolderSimple size={12} className="text-amber-500" />
                {renamingId === group.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(group.id, "group")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(group.id, "group");
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    className="min-w-0 flex-1 rounded border border-blue-300 bg-blue-50 px-1 py-0 text-xs focus:outline-none"
                  />
                ) : (
                  <span
                    onClick={() => {
                      const childIds = (groupedItems[group.id] ?? []).map((c) => c.id);
                      if (childIds.length > 0) onSelectAll(childIds);
                    }}
                    onDoubleClick={() => startRename(group.id, group.name)}
                    className="min-w-0 flex-1 cursor-pointer truncate text-xs font-medium text-gray-700"
                  >
                    {group.name}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-0.5">
                  <button
                    onClick={() =>
                      toggleVisibility(group.id, "group", group.visible)
                    }
                    className="rounded p-0.5 text-gray-300 hover:text-gray-500"
                  >
                    {group.visible ? <Eye size={11} /> : <EyeSlash size={11} />}
                  </button>
                  <button
                    onClick={() =>
                      toggleLock(group.id, "group", group.locked)
                    }
                    className="rounded p-0.5 text-gray-300 hover:text-gray-500"
                  >
                    {group.locked ? (
                      <Lock size={11} />
                    ) : (
                      <LockOpen size={11} />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(group.id, "group")}
                    className="rounded p-0.5 text-gray-300 hover:text-red-500"
                  >
                    <Trash size={11} />
                  </button>
                </div>
              </div>
              {/* Group children */}
              {group.isExpanded &&
                children.map((item) => (
                  <LayerRow
                    key={item.id}
                    item={item}
                    isSelected={selectedIds.has(item.id)}
                    isGrouped
                    isDragging={draggedId === item.id}
                    dropTarget={dropTarget}
                    renamingId={renamingId}
                    renameValue={renameValue}
                    onSelect={(e) => {
                      if (e?.metaKey || e?.altKey) {
                        onToggleSelection(item.id);
                      } else {
                        onSelectId(item.id);
                      }
                    }}
                    onStartRename={() => startRename(item.id, item.name)}
                    onRenameChange={setRenameValue}
                    onCommitRename={() => commitRename(item.id, item.kind)}
                    onCancelRename={() => setRenamingId(null)}
                    onToggleVisibility={() =>
                      toggleVisibility(item.id, item.kind, item.visible)
                    }
                    onToggleLock={() =>
                      toggleLock(item.id, item.kind, item.locked)
                    }
                    onDelete={() => handleDelete(item.id, item.kind)}
                    onMoveUp={() => onMoveUp(item.id)}
                    onMoveDown={() => onMoveDown(item.id)}
                    onUngroup={() => onAssignToGroup(item.id, null)}
                    onDragStart={(e) => handleDragStart(item.id, e)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(item.id, e)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => {
                      const pos = dropTarget?.position === "into-group" ? "above" : (dropTarget?.position ?? "below");
                      handleDrop(item.id, pos, e);
                    }}
                  />
                ))}
            </div>
          );
        })}

        {/* Ungrouped items */}
        {ungroupedItems.map((item) => (
          <LayerRow
            key={item.id}
            item={item}
            isSelected={selectedIds.has(item.id)}
            isGrouped={false}
            isDragging={draggedId === item.id}
            dropTarget={dropTarget}
            renamingId={renamingId}
            renameValue={renameValue}
            onSelect={(e) => {
                      if (e?.metaKey || e?.altKey) {
                        onToggleSelection(item.id);
                      } else {
                        onSelectId(item.id);
                      }
                    }}
            onStartRename={() => startRename(item.id, item.name)}
            onRenameChange={setRenameValue}
            onCommitRename={() => commitRename(item.id, item.kind)}
            onCancelRename={() => setRenamingId(null)}
            onToggleVisibility={() =>
              toggleVisibility(item.id, item.kind, item.visible)
            }
            onToggleLock={() =>
              toggleLock(item.id, item.kind, item.locked)
            }
            onDelete={() => handleDelete(item.id, item.kind)}
            onMoveUp={() => onMoveUp(item.id)}
            onMoveDown={() => onMoveDown(item.id)}
            groups={groups}
            onAssignToGroup={(groupId) => onAssignToGroup(item.id, groupId)}
            onDragStart={(e) => handleDragStart(item.id, e)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(item.id, e)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => {
              const pos = dropTarget?.position === "into-group" ? "above" : (dropTarget?.position ?? "below");
              handleDrop(item.id, pos, e);
            }}
          />
        ))}

        {layerList.length === 0 && (
          <div className="px-3 py-6 text-center text-[11px] text-gray-300">
            Aucun élément
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Individual layer row ───────────────────────────────────

interface LayerRowProps {
  item: LayerItem;
  isSelected: boolean;
  isGrouped: boolean;
  isDragging: boolean;
  dropTarget: DropTarget | null;
  renamingId: string | null;
  renameValue: string;
  onSelect: (e?: { metaKey?: boolean; altKey?: boolean }) => void;
  onStartRename: () => void;
  onRenameChange: (val: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUngroup?: () => void;
  groups?: LayerGroup[];
  onAssignToGroup?: (groupId: string) => void;
  // Drag handlers
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}

function LayerRow({
  item,
  isSelected,
  isGrouped,
  isDragging,
  dropTarget,
  renamingId,
  renameValue,
  onSelect,
  onStartRename,
  onRenameChange,
  onCommitRename,
  onCancelRename,
  onToggleVisibility,
  onToggleLock,
  onDelete,
  onMoveUp,
  onMoveDown,
  onUngroup,
  groups,
  onAssignToGroup,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: LayerRowProps) {
  const Icon = TYPE_ICONS[item.type] ?? Rectangle;
  const color = TYPE_COLORS[item.type] ?? "#94a3b8";
  const isRenaming = renamingId === item.id;
  const [showGroupMenu, setShowGroupMenu] = useState(false);

  // Determine if this row is the drop target
  const isDropAbove = dropTarget?.targetId === item.id && dropTarget.position === "above";
  const isDropBelow = dropTarget?.targetId === item.id && dropTarget.position === "below";

  return (
    <div
      className="relative"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Drop indicator — above */}
      {isDropAbove && (
        <div className="absolute left-2 right-2 top-0 z-10 h-0.5 rounded-full bg-blue-500 shadow-[0_0_4px_rgba(59,130,246,0.5)]" />
      )}

      <div
        draggable={!isRenaming}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={(e: React.MouseEvent) => onSelect({ metaKey: e.metaKey, altKey: e.altKey })}
        className={`group flex items-center gap-1 py-1 transition-colors ${
          isGrouped ? "pl-5" : "pl-1"
        } pr-1.5 ${
          isDragging
            ? "opacity-40"
            : isSelected
              ? "bg-blue-50 text-blue-800"
              : "text-gray-600 hover:bg-gray-50"
        } ${!item.visible ? "opacity-40" : ""}`}
      >
        {/* Drag handle */}
        <div className="flex-shrink-0 cursor-grab text-gray-300 opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100">
          <DotsSixVertical size={10} />
        </div>

        {/* Type icon */}
        <div
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded"
          style={{ color }}
        >
          <Icon size={12} weight="fill" />
        </div>

        {/* Name (inline rename on double-click) */}
        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onBlur={onCommitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitRename();
              if (e.key === "Escape") onCancelRename();
            }}
            onClick={(e) => e.stopPropagation()}
            className="min-w-0 flex-1 rounded border border-blue-300 bg-blue-50 px-1 py-0 text-xs focus:outline-none"
          />
        ) : (
          <span
            onDoubleClick={(e) => {
              e.stopPropagation();
              onStartRename();
            }}
            className="min-w-0 flex-1 truncate text-xs"
          >
            {item.name}
          </span>
        )}

        {/* Action buttons (visible on hover) */}
        <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {/* Z-order arrows */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
            }}
            className="rounded p-0.5 text-gray-300 hover:text-gray-500"
            title="Monter"
          >
            <ArrowUp size={10} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
            className="rounded p-0.5 text-gray-300 hover:text-gray-500"
            title="Descendre"
          >
            <ArrowDown size={10} />
          </button>

          {/* Group assignment */}
          {!isGrouped &&
            groups &&
            groups.length > 0 &&
            onAssignToGroup && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowGroupMenu(!showGroupMenu);
                  }}
                  className="rounded p-0.5 text-gray-300 hover:text-amber-500"
                  title="Ajouter au groupe"
                >
                  <FolderSimplePlus size={10} />
                </button>
                {showGroupMenu && (
                  <div className="absolute right-0 top-5 z-50 min-w-[100px] rounded border border-gray-200 bg-white py-0.5 shadow-lg">
                    {groups.map((g) => (
                      <button
                        key={g.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAssignToGroup(g.id);
                          setShowGroupMenu(false);
                        }}
                        className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-xs text-gray-600 hover:bg-gray-50"
                      >
                        <FolderSimple size={10} className="text-amber-500" />
                        {g.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

          {/* Ungroup */}
          {isGrouped && onUngroup && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUngroup();
              }}
              className="rounded p-0.5 text-gray-300 hover:text-amber-500"
              title="Retirer du groupe"
            >
              <FolderSimple size={10} />
            </button>
          )}

          {/* Delete */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded p-0.5 text-gray-300 hover:text-red-500"
          >
            <Trash size={10} />
          </button>
        </div>

        {/* Always-visible controls */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility();
            }}
            className={`rounded p-0.5 ${item.visible ? "text-gray-300" : "text-gray-400"} hover:text-gray-500`}
          >
            {item.visible ? <Eye size={11} /> : <EyeSlash size={11} />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleLock();
            }}
            className={`rounded p-0.5 ${item.locked ? "text-amber-500" : "text-gray-300"} hover:text-gray-500`}
          >
            {item.locked ? <Lock size={11} /> : <LockOpen size={11} />}
          </button>
        </div>
      </div>

      {/* Drop indicator — below */}
      {isDropBelow && (
        <div className="absolute bottom-0 left-2 right-2 z-10 h-0.5 rounded-full bg-blue-500 shadow-[0_0_4px_rgba(59,130,246,0.5)]" />
      )}
    </div>
  );
}
