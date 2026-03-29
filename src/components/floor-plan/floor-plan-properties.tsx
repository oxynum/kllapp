"use client";

import { useTranslations } from "next-intl";
import type { FloorPlanElement, DeskData } from "@/types";

interface FloorPlanPropertiesProps {
  selectedType: "element" | "desk" | null;
  selectedCount: number;
  selectedElement: FloorPlanElement | null;
  selectedDesk: DeskData | null;
  onUpdateElement: (id: string, updates: Partial<FloorPlanElement>) => void;
  onUpdateDesk: (id: string, updates: Partial<DeskData>) => void;
  onDelete: () => void;
  canvasWidth?: number;
  canvasHeight?: number;
  onCanvasWidthChange?: (w: number) => void;
  onCanvasHeightChange?: (h: number) => void;
}

export function FloorPlanProperties({
  selectedType,
  selectedCount,
  selectedElement,
  selectedDesk,
  onUpdateElement,
  onUpdateDesk,
  onDelete,
  canvasWidth,
  canvasHeight,
  onCanvasWidthChange,
  onCanvasHeightChange,
}: FloorPlanPropertiesProps) {
  const t = useTranslations("floorPlan");

  if (!selectedType) {
    return (
      <div className="space-y-3 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {t("canvasSize")}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs text-gray-500">{t("width")}</span>
            <input
              type="number"
              min={200}
              max={4000}
              step={100}
              value={canvasWidth ?? 1200}
              onChange={(e) => onCanvasWidthChange?.(Math.min(4000, Math.max(200, Number(e.target.value))))}
              className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">{t("height")}</span>
            <input
              type="number"
              min={200}
              max={2000}
              step={100}
              value={canvasHeight ?? 800}
              onChange={(e) => onCanvasHeightChange?.(Math.min(2000, Math.max(200, Number(e.target.value))))}
              className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
            />
          </label>
        </div>
        <p className="text-[10px] text-gray-300">
          Zone de travail blanche
        </p>
      </div>
    );
  }

  if (selectedCount > 1) {
    return (
      <div className="space-y-3 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Sélection multiple
        </h3>
        <p className="text-sm text-gray-600">{selectedCount} éléments sélectionnés</p>
        <button
          onClick={onDelete}
          className="mt-4 w-full rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
        >
          Supprimer la sélection
        </button>
      </div>
    );
  }

  if (selectedType === "element" && selectedElement) {
    return (
      <div className="space-y-3 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {t("properties")}
        </h3>

        {/* Element type */}
        <div className="text-xs text-gray-400 capitalize">
          {t(`tools.${selectedElement.type}` as Parameters<typeof t>[0])}
        </div>

        {/* Name (for rooms and labels) */}
        {(selectedElement.type === "room" || selectedElement.type === "label") && (
          <label className="block">
            <span className="text-xs text-gray-500">{t("roomName")}</span>
            <input
              type="text"
              value={selectedElement.name ?? ""}
              onChange={(e) =>
                onUpdateElement(selectedElement.id, { name: e.target.value })
              }
              className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
            />
          </label>
        )}

        {/* Position */}
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs text-gray-500">X</span>
            <input
              type="number"
              value={Math.round(selectedElement.x)}
              onChange={(e) =>
                onUpdateElement(selectedElement.id, {
                  x: Number(e.target.value),
                })
              }
              className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">Y</span>
            <input
              type="number"
              value={Math.round(selectedElement.y)}
              onChange={(e) =>
                onUpdateElement(selectedElement.id, {
                  y: Number(e.target.value),
                })
              }
              className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
            />
          </label>
        </div>

        {/* Rotation */}
        <label className="block">
          <span className="text-xs text-gray-500">Rotation (°)</span>
          <input
            type="number"
            step={1}
            value={Math.round(selectedElement.rotation ?? 0)}
            onChange={(e) =>
              onUpdateElement(selectedElement.id, {
                rotation: Number(e.target.value) % 360,
              })
            }
            className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
          />
        </label>

        {/* Size — door: width only; room/corridor: width + height */}
        {selectedElement.type === "door" && (
          <label className="block">
            <span className="text-xs text-gray-500">Ouverture (px)</span>
            <input
              type="number"
              min={15}
              value={Math.round(selectedElement.width ?? 40)}
              onChange={(e) =>
                onUpdateElement(selectedElement.id, {
                  width: Math.max(15, Number(e.target.value)),
                })
              }
              className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
            />
          </label>
        )}
        {selectedElement.type === "door" && (
          <div>
            <span className="text-xs text-gray-500">Miroir</span>
            <div className="mt-1 flex gap-2">
              <button
                onClick={() =>
                  onUpdateElement(selectedElement.id, {
                    flipX: !selectedElement.flipX,
                  })
                }
                className={`flex-1 rounded border px-2 py-1.5 text-xs font-medium transition-colors ${
                  selectedElement.flipX
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                ↔ Horizontal
              </button>
              <button
                onClick={() =>
                  onUpdateElement(selectedElement.id, {
                    flipY: !selectedElement.flipY,
                  })
                }
                className={`flex-1 rounded border px-2 py-1.5 text-xs font-medium transition-colors ${
                  selectedElement.flipY
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                ↕ Vertical
              </button>
            </div>
          </div>
        )}
        {(selectedElement.type === "room" || selectedElement.type === "corridor") && (
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs text-gray-500">{t("width")}</span>
              <input
                type="number"
                value={Math.round(selectedElement.width ?? 120)}
                onChange={(e) =>
                  onUpdateElement(selectedElement.id, {
                    width: Number(e.target.value),
                  })
                }
                className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">{t("height")}</span>
              <input
                type="number"
                value={Math.round(selectedElement.height ?? 80)}
                onChange={(e) =>
                  onUpdateElement(selectedElement.id, {
                    height: Number(e.target.value),
                  })
                }
                className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
              />
            </label>
          </div>
        )}

        {/* Fill color */}
        {(selectedElement.type === "room" || selectedElement.type === "corridor") && (
          <label className="block">
            <span className="text-xs text-gray-500">Fond</span>
            <input
              type="color"
              value={selectedElement.fill ?? "#f0f9ff"}
              onChange={(e) =>
                onUpdateElement(selectedElement.id, { fill: e.target.value })
              }
              className="mt-0.5 h-8 w-full cursor-pointer rounded border border-gray-200"
            />
          </label>
        )}

        {/* Border config (rooms/corridors) */}
        {(selectedElement.type === "room" || selectedElement.type === "corridor") && (
          <>
            <div>
              <span className="text-xs text-gray-500">Bordure</span>
              <div className="mt-1 flex gap-1">
                {([
                  { value: "solid", label: "━" },
                  { value: "dashed", label: "╌" },
                  { value: "dotted", label: "┈" },
                  { value: "none", label: "∅" },
                ] as const).map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() =>
                      onUpdateElement(selectedElement.id, { strokeStyle: value })
                    }
                    className={`flex-1 rounded border px-2 py-1.5 text-xs font-medium transition-colors ${
                      (selectedElement.strokeStyle ?? "solid") === value
                        ? "border-blue-300 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-400 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {(selectedElement.strokeStyle ?? "solid") !== "none" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs text-gray-500">Épaisseur</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={selectedElement.strokeWidth ?? 2}
                    onChange={(e) =>
                      onUpdateElement(selectedElement.id, {
                        strokeWidth: Math.max(1, Number(e.target.value)),
                      })
                    }
                    className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-500">Couleur</span>
                  <input
                    type="color"
                    value={selectedElement.stroke ?? "#334155"}
                    onChange={(e) =>
                      onUpdateElement(selectedElement.id, { stroke: e.target.value })
                    }
                    className="mt-0.5 h-[30px] w-full cursor-pointer rounded border border-gray-200"
                  />
                </label>
              </div>
            )}
          </>
        )}

        {/* Wall length */}
        {selectedElement.type === "wall" && (
          <label className="block">
            <span className="text-xs text-gray-500">Longueur (px)</span>
            <input
              type="number"
              min={20}
              value={Math.round(Math.abs((selectedElement.points ?? [0, 0, 120, 0])[2]))}
              onChange={(e) =>
                onUpdateElement(selectedElement.id, {
                  points: [0, 0, Math.max(20, Number(e.target.value)), 0],
                })
              }
              className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
            />
          </label>
        )}

        {/* Wall thickness */}
        {selectedElement.type === "wall" && (
          <label className="block">
            <span className="text-xs text-gray-500">Épaisseur (px)</span>
            <input
              type="number"
              min={1}
              max={20}
              value={selectedElement.strokeWidth ?? 4}
              onChange={(e) =>
                onUpdateElement(selectedElement.id, {
                  strokeWidth: Math.max(1, Number(e.target.value)),
                })
              }
              className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
            />
          </label>
        )}

        {/* Stroke color (for walls) */}
        {selectedElement.type === "wall" && (
          <label className="block">
            <span className="text-xs text-gray-500">Couleur</span>
            <input
              type="color"
              value={selectedElement.stroke ?? "#1e293b"}
              onChange={(e) =>
                onUpdateElement(selectedElement.id, { stroke: e.target.value })
              }
              className="mt-0.5 h-8 w-full cursor-pointer rounded border border-gray-200"
            />
          </label>
        )}

        {/* Delete button */}
        <button
          onClick={onDelete}
          className="mt-4 w-full rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
        >
          {t("tools.delete")}
        </button>
      </div>
    );
  }

  if (selectedType === "desk" && selectedDesk) {
    return (
      <div className="space-y-3 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {t("properties")}
        </h3>
        <div className="text-xs text-gray-400">{t("tools.desk")}</div>

        {/* Label */}
        <label className="block">
          <span className="text-xs text-gray-500">{t("deskLabel")}</span>
          <input
            type="text"
            value={selectedDesk.label}
            onChange={(e) =>
              onUpdateDesk(selectedDesk.id, { label: e.target.value })
            }
            className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
          />
        </label>

        {/* Zone */}
        <label className="block">
          <span className="text-xs text-gray-500">{t("zone")}</span>
          <input
            type="text"
            value={selectedDesk.zone ?? ""}
            onChange={(e) =>
              onUpdateDesk(selectedDesk.id, {
                zone: e.target.value || null,
              })
            }
            placeholder="ex: Zone A"
            className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
          />
        </label>

        {/* Position */}
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs text-gray-500">X</span>
            <input
              type="number"
              value={Math.round(selectedDesk.x)}
              onChange={(e) =>
                onUpdateDesk(selectedDesk.id, { x: Number(e.target.value) })
              }
              className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">Y</span>
            <input
              type="number"
              value={Math.round(selectedDesk.y)}
              onChange={(e) =>
                onUpdateDesk(selectedDesk.id, { y: Number(e.target.value) })
              }
              className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
            />
          </label>
        </div>

        {/* Rotation */}
        <label className="block">
          <span className="text-xs text-gray-500">Rotation (°)</span>
          <input
            type="number"
            step={1}
            value={Math.round(selectedDesk.rotation)}
            onChange={(e) =>
              onUpdateDesk(selectedDesk.id, {
                rotation: Number(e.target.value) % 360,
              })
            }
            className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
          />
        </label>

        {/* Size */}
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs text-gray-500">{t("width")}</span>
            <input
              type="number"
              value={Math.round(selectedDesk.width)}
              onChange={(e) =>
                onUpdateDesk(selectedDesk.id, {
                  width: Number(e.target.value),
                })
              }
              className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">{t("height")}</span>
            <input
              type="number"
              value={Math.round(selectedDesk.height)}
              onChange={(e) =>
                onUpdateDesk(selectedDesk.id, {
                  height: Number(e.target.value),
                })
              }
              className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
            />
          </label>
        </div>

        {/* Available toggle */}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={selectedDesk.isAvailable}
            onChange={(e) =>
              onUpdateDesk(selectedDesk.id, {
                isAvailable: e.target.checked,
              })
            }
            className="rounded border-gray-300 text-blue-600"
          />
          <span className="text-xs text-gray-600">Disponible</span>
        </label>

        {/* Delete button */}
        <button
          onClick={onDelete}
          className="mt-4 w-full rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
        >
          {t("tools.delete")}
        </button>
      </div>
    );
  }

  return null;
}
