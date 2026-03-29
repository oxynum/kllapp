"use client";

import { useTranslations } from "next-intl";
import { Plus, Trash } from "@phosphor-icons/react";

interface FloorInfo {
  id: string;
  name: string;
  floorNumber: number;
}

interface FloorSelectorProps {
  floors: FloorInfo[];
  activeFloorId: string | null;
  onSelectFloor: (floorId: string) => void;
  onAddFloor: () => void;
  onDeleteFloor: (floorId: string) => void;
}

export function FloorSelector({
  floors,
  activeFloorId,
  onSelectFloor,
  onAddFloor,
  onDeleteFloor,
}: FloorSelectorProps) {
  const t = useTranslations("floorPlan");

  return (
    <div className="flex items-center gap-1 border-b border-gray-200 bg-gray-50 px-3 py-1.5">
      {floors.length === 0 ? (
        <span className="text-xs text-gray-400">{t("noFloors")}</span>
      ) : (
        floors.map((floor) => (
          <div
            key={floor.id}
            className={`group flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              activeFloorId === floor.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:bg-white/50 hover:text-gray-700"
            }`}
          >
            <button onClick={() => onSelectFloor(floor.id)}>
              {floor.name}
            </button>
            {activeFloorId === floor.id && floors.length > 1 && (
              <button
                onClick={() => onDeleteFloor(floor.id)}
                className="ml-1 rounded p-0.5 text-gray-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                title={t("deleteFloor")}
              >
                <Trash size={12} />
              </button>
            )}
          </div>
        ))
      )}
      <button
        onClick={onAddFloor}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-white hover:text-gray-600"
        title={t("addFloor")}
      >
        <Plus size={14} />
        <span>{t("addFloor")}</span>
      </button>
    </div>
  );
}
