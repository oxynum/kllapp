"use client";

import { useMemo } from "react";
import { X } from "@phosphor-icons/react";
import { useTranslations, useLocale } from "next-intl";
import type { SheetRow, ProjectInfo, UserInfo, ExpenseData } from "@/types";
import type { CellData } from "@/lib/db/queries/sheet-data";
import { useDisplayMode } from "./display-mode-context";

interface SummaryBarProps {
  rows: SheetRow[];
  allProjects?: ProjectInfo[];
  allUsers?: UserInfo[];
  selection?: {
    id: string;
    type: "project" | "client";
    label: string;
  } | null;
  onClearSelection?: () => void;
  onHideBar?: () => void;
  expenseMap?: Record<string, ExpenseData[]>;
  cells: Record<string, CellData>;
}

const TEAL = "#2D9B8F";
const CORAL = "#E06B62";
const INDIGO = "#818cf8";
const AMBER = "#F0A030";

function MetricCard({ label, value, color, tooltip }: { label: string; value: string; color: string; tooltip?: string }) {
  return (
    <div className="group relative flex flex-1 flex-col items-center justify-center py-1" title={tooltip}>
      <span className="text-[9px] font-medium uppercase tracking-wider text-gray-400">{label}</span>
      <span className="text-[15px] font-semibold" style={{ color }}>{value}</span>
      <div className="absolute bottom-0 left-3 right-3 h-[3px] rounded-full" style={{ backgroundColor: color, opacity: 0.25 }} />
    </div>
  );
}

export function SummaryBar({ rows, allProjects, selection, onClearSelection, onHideBar, expenseMap, cells: cellsData }: SummaryBarProps) {
  const t = useTranslations("summary");
  const locale = useLocale();
  const { displayMode } = useDisplayMode();

  const cells = useMemo(() => {
    const result: Record<string, number> = {};
    for (const [key, cell] of Object.entries(cellsData)) {
      result[key] = Number(cell.value) || 0;
    }
    return result;
  }, [cellsData]);

  let scopeProjectIds: Set<string> | null = null;
  if (selection && allProjects) {
    if (selection.type === "client") {
      scopeProjectIds = new Set(
        allProjects.filter((p) => p.clientId === selection.id).map((p) => p.id)
      );
    } else {
      const subs = allProjects.filter((p) => p.parentId === selection.id);
      scopeProjectIds = new Set([selection.id, ...subs.map((s) => s.id)]);
    }
  }

  const userRows = useMemo(() => rows.filter((r) => {
    if (r.type !== "user" && r.type !== "absence-user") return false;
    if (scopeProjectIds) {
      return r.projectId ? scopeProjectIds.has(r.projectId) : false;
    }
    return true;
  }), [rows, scopeProjectIds]);

  const prefixMap = useMemo(() => {
    const m = new Map<string, SheetRow>();
    for (const r of userRows) {
      if (r.userId && r.projectId) {
        m.set(`${r.userId}:${r.projectId}`, r);
      }
    }
    return m;
  }, [userRows]);

  const totals = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;
    let totalDays = 0;
    let totalHours = 0;
    let overtimeTotal = 0;

    for (const [key, value] of Object.entries(cells)) {
      if (key.startsWith("forecast:")) continue;
      totalDays += value;
      const parts = key.split(":");
      const lookupKey = `${parts[0]}:${parts[1]}`;
      const row = prefixMap.get(lookupKey);
      const hpd = row?.hoursPerDay ?? 7;

      if (row) {
        if (row.billable !== false) {
          totalRevenue += value * (row.dailyRate ?? 0);
        }
        totalCost += value * (row.dailyCost ?? 0);
      }

      totalHours += value * hpd;

      if (value > 1) {
        overtimeTotal += displayMode === "hours" ? (value - 1) * hpd : value - 1;
      }
    }

    if (expenseMap) {
      for (const expenses of Object.values(expenseMap)) {
        for (const exp of expenses) {
          if (!exp.projectId) continue;
          if (scopeProjectIds && !scopeProjectIds.has(exp.projectId)) continue;
          totalCost += parseFloat(exp.amount);
        }
      }
    }

    const marginAbs = totalRevenue - totalCost;
    const marginPct = totalRevenue > 0 ? (marginAbs / totalRevenue) * 100 : 0;
    const timeValue = displayMode === "hours"
      ? `${parseFloat(totalHours.toFixed(1))}h`
      : `${parseFloat(totalDays.toFixed(1))}j`;

    let forecastRevenue = 0;
    for (const r of rows) {
      if (r.type !== "project" && r.type !== "sub-project") continue;
      if (!r.dailyRate || !r.projectId) continue;
      if (scopeProjectIds && !scopeProjectIds.has(r.projectId)) continue;
      for (const [key, val] of Object.entries(cells)) {
        if (key.startsWith(`forecast:${r.projectId}:`) && val > 0) {
          forecastRevenue += val * r.dailyRate;
        }
      }
    }

    return { totalRevenue, totalCost, marginAbs, marginPct, totalDays, totalHours, timeValue, overtimeTotal, forecastRevenue };
  }, [cells, prefixMap, displayMode, expenseMap, scopeProjectIds, rows]);

  const { totalRevenue, totalCost, marginAbs, marginPct, timeValue, overtimeTotal, forecastRevenue } = totals;

  const fmtEur = (n: number) => `${Math.round(n).toLocaleString(locale)} €`;

  const marginColor = marginPct > 30 ? "#059669"
    : marginPct > 10 ? "#d97706"
    : marginPct > 0 ? "#ea580c"
    : "#ef4444";

  return (
    <div className="flex h-14 items-stretch bg-white">
      {/* Selection chip */}
      {selection && (
        <div className="flex items-center gap-1.5 border-r border-gray-100 px-3">
          <span className="max-w-[120px] truncate text-[11px] font-medium text-gray-700">
            {selection.label}
          </span>
          <button
            onClick={onClearSelection}
            className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Metric cards */}
      <div className="flex flex-1 items-stretch divide-x divide-gray-100">
        {totalRevenue > 0 && (
          <MetricCard
            label={t("revenue")}
            value={fmtEur(totalRevenue)}
            color={TEAL}
            tooltip={`${fmtEur(totalRevenue)} ${t("revenue").toLowerCase()}`}
          />
        )}
        {forecastRevenue > 0 && (
          <MetricCard
            label={t("forecastRevenue")}
            value={fmtEur(forecastRevenue)}
            color={INDIGO}
            tooltip={`${fmtEur(forecastRevenue)} ${t("forecastRevenue").toLowerCase()}`}
          />
        )}
        {totalCost > 0 && (
          <MetricCard
            label={t("charges")}
            value={fmtEur(totalCost)}
            color={CORAL}
            tooltip={`${fmtEur(totalCost)} ${t("charges").toLowerCase()}`}
          />
        )}
        <MetricCard
          label={t("margin")}
          value={`${marginPct.toFixed(1)}%`}
          color={marginColor}
          tooltip={`${fmtEur(marginAbs)} (${marginPct.toFixed(1)}%)`}
        />
        <MetricCard
          label={displayMode === "hours" ? t("hours") : t("days")}
          value={timeValue}
          color="#6b7280"
        />
        {overtimeTotal > 0 && (
          <MetricCard
            label={t("overtime")}
            value={displayMode === "hours" ? `${parseFloat(overtimeTotal.toFixed(1))}h` : `${parseFloat(overtimeTotal.toFixed(1))}j`}
            color={AMBER}
          />
        )}
      </div>

      {/* Hide bar */}
      {onHideBar && (
        <button
          onClick={onHideBar}
          className="flex items-center justify-center border-l border-gray-100 px-3 text-gray-300 transition-colors hover:text-gray-500"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
