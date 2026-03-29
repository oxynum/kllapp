"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash, House, Buildings, MapPin } from "@phosphor-icons/react";
import { createWorkplace, updateWorkplace, deleteWorkplace } from "@/app/(dashboard)/workplace/actions";

interface WorkplaceItem {
  id: string;
  name: string;
  type: "remote" | "office" | "client";
  address: string | null;
  color: string | null;
  sortOrder: number | null;
}

const TYPE_ICONS = {
  remote: House,
  office: Buildings,
  client: MapPin,
};

const TYPE_COLORS: Record<string, string> = {
  remote: "#6366f1",
  office: "#2D9B8F",
  client: "#F0A030",
};

const DEFAULT_COLORS = ["#6366f1", "#2D9B8F", "#F0A030", "#E06B62", "#7B8FB2", "#9B6BB0", "#4AA3C5", "#6BAB6E"];

export function WorkplaceView({ initialWorkplaces }: { initialWorkplaces: WorkplaceItem[] }) {
  const t = useTranslations("workplace");
  const [items, setItems] = useState(initialWorkplaces);
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"remote" | "office" | "client">("office");
  const [newAddress, setNewAddress] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!newName.trim()) return;
    startTransition(async () => {
      const wp = await createWorkplace({
        name: newName.trim(),
        type: newType,
        address: newAddress || undefined,
        color: newColor,
      });
      setItems(prev => [...prev, { ...wp, sortOrder: wp.sortOrder ?? prev.length }]);
      setNewName("");
      setNewAddress("");
      setShowForm(false);
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteWorkplace(id);
      setItems(prev => prev.filter(w => w.id !== id));
    });
  };

  const handleUpdateName = (id: string, name: string) => {
    startTransition(async () => {
      await updateWorkplace(id, { name });
      setItems(prev => prev.map(w => w.id === id ? { ...w, name } : w));
      setEditingId(null);
    });
  };

  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="mb-1 text-lg font-semibold text-gray-900">{t("title")}</h1>
      <p className="mb-6 text-sm text-gray-500">{t("description")}</p>

      {/* Workplace list */}
      <div className="space-y-2">
        {items.map((wp) => {
          const Icon = TYPE_ICONS[wp.type];
          const isEditing = editingId === wp.id;
          return (
            <div
              key={wp.id}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 transition-colors hover:bg-gray-50"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: (wp.color || TYPE_COLORS[wp.type]) + "20", color: wp.color || TYPE_COLORS[wp.type] }}
              >
                <Icon size={16} weight="fill" />
              </div>
              <div className="flex-1">
                {isEditing ? (
                  <input
                    autoFocus
                    defaultValue={wp.name}
                    onBlur={(e) => handleUpdateName(wp.id, e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleUpdateName(wp.id, (e.target as HTMLInputElement).value); }}
                    className="w-full rounded border border-gray-300 px-2 py-0.5 text-sm text-gray-900 outline-none focus:border-gray-400"
                  />
                ) : (
                  <button
                    onClick={() => setEditingId(wp.id)}
                    className="text-left text-sm font-medium text-gray-900"
                  >
                    {wp.name}
                  </button>
                )}
                {wp.address && (
                  <p className="text-[11px] text-gray-400">{wp.address}</p>
                )}
              </div>
              <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                {t(wp.type)}
              </span>
              <button
                onClick={() => handleDelete(wp.id)}
                disabled={isPending}
                className="rounded p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
              >
                <Trash size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add form */}
      {showForm ? (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">{t("name")}</label>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Bureau Paris, Télétravail..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">{t("type")}</label>
              <div className="flex gap-2">
                {(["office", "remote", "client"] as const).map((type) => {
                  const Icon = TYPE_ICONS[type];
                  const isActive = newType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setNewType(type)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        isActive
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <Icon size={14} />
                      {t(type)}
                    </button>
                  );
                })}
              </div>
            </div>
            {(newType === "office" || newType === "client") && (
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-500">{t("address")}</label>
                <input
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="123 rue de Paris, 75001 Paris"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">{t("color")}</label>
              <div className="flex gap-1.5">
                {DEFAULT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={`h-6 w-6 rounded-full transition-transform ${newColor === c ? "scale-125 ring-2 ring-gray-400 ring-offset-2" : "hover:scale-110"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || isPending}
              className="flex-1 rounded-lg bg-gray-900 py-2 text-xs font-medium text-white transition-colors hover:bg-gray-800 disabled:bg-gray-300"
            >
              {t("addWorkplace")}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-3 text-xs font-medium text-gray-500 transition-colors hover:border-gray-400 hover:bg-gray-50 hover:text-gray-700"
        >
          <Plus size={14} />
          {t("addWorkplace")}
        </button>
      )}
    </div>
  );
}
