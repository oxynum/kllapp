"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Funnel, MagnifyingGlass, X } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import type { SheetFilters, ClientInfo, ProjectInfo, UserInfo } from "@/types";

interface FilterDropdownProps {
  allClients: ClientInfo[];
  allProjects: ProjectInfo[];
  allUsers: UserInfo[];
  filters: SheetFilters;
  onFiltersChange: (filters: SheetFilters) => void;
}

export function FilterDropdown({
  allClients,
  allProjects,
  allUsers,
  filters,
  onFiltersChange,
}: FilterDropdownProps) {
  const t = useTranslations("filter");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeCount =
    filters.clientIds.size + filters.projectIds.size + filters.userIds.size;

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const toggle = (
    dimension: "clientIds" | "projectIds" | "userIds",
    id: string,
  ) => {
    const next = new Set(filters[dimension]);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onFiltersChange({ ...filters, [dimension]: next });
  };

  const clearAll = () =>
    onFiltersChange({
      clientIds: new Set(),
      projectIds: new Set(),
      userIds: new Set(),
    });

  // Only top-level projects (no parentId) for the filter list
  const topProjects = useMemo(
    () => allProjects.filter((p) => !p.parentId),
    [allProjects],
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex h-8 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-medium transition-colors ${
          activeCount > 0
            ? "border-gray-900 bg-gray-900 text-white"
            : "border-gray-200 text-gray-600 hover:bg-gray-50"
        }`}
      >
        <Funnel size={14} weight={activeCount > 0 ? "fill" : "regular"} />
        {activeCount > 0 && (
          <span className="min-w-[14px] text-center text-[10px] font-semibold">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-gray-200 bg-white shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <span className="text-xs font-semibold text-gray-900">
              {t("title")}
            </span>
            {activeCount > 0 && (
              <button
                onClick={clearAll}
                className="text-[10px] font-medium text-gray-400 transition-colors hover:text-gray-600"
              >
                {t("clearAll")}
              </button>
            )}
          </div>

          {/* Sections */}
          <div className="max-h-80 overflow-y-auto py-1">
            <FilterSection
              label={t("clients")}
              items={allClients.map((c) => ({ id: c.id, label: c.name }))}
              selected={filters.clientIds}
              onToggle={(id) => toggle("clientIds", id)}
            />
            <FilterSection
              label={t("projects")}
              items={topProjects.map((p) => ({ id: p.id, label: p.name }))}
              selected={filters.projectIds}
              onToggle={(id) => toggle("projectIds", id)}
            />
            <FilterSection
              label={t("collaborators")}
              items={allUsers.map((u) => ({ id: u.id, label: u.name }))}
              selected={filters.userIds}
              onToggle={(id) => toggle("userIds", id)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSection({
  label,
  items,
  selected,
  onToggle,
}: {
  label: string;
  items: { id: string; label: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const t = useTranslations("filter");
  const [search, setSearch] = useState("");
  const showSearch = items.length > 5;

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [items, search]);

  return (
    <div className="border-b border-gray-50 last:border-b-0">
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          {label}
        </span>
        {selected.size > 0 && (
          <span className="text-[10px] font-medium text-gray-500">
            {t("selected", { count: selected.size })}
          </span>
        )}
      </div>

      {showSearch && (
        <div className="px-3 pb-1">
          <div className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1">
            <MagnifyingGlass size={12} className="text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search")}
              className="w-full bg-transparent text-[11px] text-gray-700 outline-none placeholder:text-gray-400"
            />
            {search && (
              <button onClick={() => setSearch("")}>
                <X size={10} className="text-gray-400" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="max-h-32 overflow-y-auto px-1">
        {filtered.length === 0 ? (
          <p className="px-2 py-1.5 text-[11px] text-gray-400">
            {t("noResults")}
          </p>
        ) : (
          filtered.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => onToggle(item.id)}
                className="h-3 w-3 rounded border-gray-300 text-gray-900 focus:ring-0 focus:ring-offset-0"
              />
              <span className="truncate text-[11px] text-gray-700">
                {item.label}
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
