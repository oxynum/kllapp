"use client";

import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { format, eachDayOfInterval, startOfYear, endOfYear, isWeekend } from "date-fns";
import type { SheetRow, ProjectInfo, UserInfo, ExpenseData } from "@/types";
import type { CellData } from "@/lib/db/queries/sheet-data";
import { useDisplayMode } from "../display-mode-context";
import { PALETTE } from "@/lib/colors";

type Tab = "summary" | "collaborators" | "activity";

interface ProjectFinancePanelProps {
  projectId: string;
  rows: SheetRow[];
  cells: Record<string, CellData>;
  allProjects: ProjectInfo[];
  allUsers: UserInfo[];
  expenseMap?: Record<string, ExpenseData[]>;
  year?: number;
}

export function ProjectFinancePanel({
  projectId,
  rows,
  cells,
  allProjects,
  allUsers,
  expenseMap,
  year = new Date().getFullYear(),
}: ProjectFinancePanelProps) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const { displayMode } = useDisplayMode();
  const [activeTab, setActiveTab] = useState<Tab>("summary");

  const fmtEur = (n: number) => `${Math.round(n).toLocaleString(locale)} €`;
  const fmtTime = (d: number) => displayMode === "hours" ? `${parseFloat((d * 7).toFixed(1))}h` : `${parseFloat(d.toFixed(1))}j`;

  const scopeProjectIds = useMemo(() => {
    const subs = allProjects.filter((p) => p.parentId === projectId);
    return new Set([projectId, ...subs.map((s) => s.id)]);
  }, [projectId, allProjects]);

  const project = allProjects.find((p) => p.id === projectId);
  const budget = project?.budget ? Number(project.budget) : 0;
  const dailyRate = project?.dailyRate ? Number(project.dailyRate) : 0;

  // Per-user + total metrics
  const metrics = useMemo(() => {
    const userMap = new Map<string, { userId: string; days: number; revenue: number; cost: number; name: string; image: string | null }>();
    let totalRevenue = 0;
    let totalCost = 0;
    let totalDays = 0;
    let expenseTotal = 0;

    // Daily activity data for histogram
    const dailyMap = new Map<string, Map<string, number>>(); // date → userId → value

    for (const [key, cell] of Object.entries(cells)) {
      if (key.startsWith("forecast:")) continue;
      const val = Number(cell.value) || 0;
      if (val <= 0) continue;

      const parts = key.split(":");
      const userId = parts[0];
      const cellProjectId = parts[1];
      const dateStr = parts[2];

      if (!scopeProjectIds.has(cellProjectId)) continue;

      const row = rows.find(
        (r) => r.userId === userId && r.projectId === cellProjectId && (r.type === "user" || r.type === "absence-user")
      );
      if (!row) continue;

      const rate = row.dailyRate ?? 0;
      const cost = row.dailyCost ?? 0;
      const rev = row.billable !== false ? val * rate : 0;
      const cst = val * cost;

      totalRevenue += rev;
      totalCost += cst;
      totalDays += val;

      const user = allUsers.find((u) => u.id === userId);
      const name = user?.name ?? "—";
      const image = user?.image ?? null;

      const existing = userMap.get(userId) ?? { userId, days: 0, revenue: 0, cost: 0, name, image };
      existing.days += val;
      existing.revenue += rev;
      existing.cost += cst;
      userMap.set(userId, existing);

      // Activity data
      if (dateStr) {
        if (!dailyMap.has(dateStr)) dailyMap.set(dateStr, new Map());
        const dayUsers = dailyMap.get(dateStr)!;
        dayUsers.set(userId, (dayUsers.get(userId) ?? 0) + val);
      }
    }

    if (expenseMap) {
      for (const [, expenses] of Object.entries(expenseMap)) {
        for (const exp of expenses) {
          if (!exp.projectId || !scopeProjectIds.has(exp.projectId)) continue;
          expenseTotal += parseFloat(exp.amount);
          totalCost += parseFloat(exp.amount);
        }
      }
    }

    const marginAbs = totalRevenue - totalCost;
    const marginPct = totalRevenue > 0 ? (marginAbs / totalRevenue) * 100 : 0;
    const budgetConsumed = dailyRate > 0 && budget > 0 ? totalRevenue : totalDays;
    const budgetPct = budget > 0 ? budgetConsumed / budget : 0;
    const budgetUnit = dailyRate > 0 && budget > 0 ? "€" : "j";

    const users = Array.from(userMap.values()).sort((a, b) => b.revenue - a.revenue || b.days - a.days);

    // Build daily bars for activity histogram (last 30 working days)
    const allDays = eachDayOfInterval({ start: startOfYear(new Date(year, 0, 1)), end: endOfYear(new Date(year, 0, 1)) })
      .filter(d => !isWeekend(d));
    const today = new Date();
    const recentDays = allDays.filter(d => d <= today).slice(-30);

    const bars = recentDays.map(d => {
      const ds = format(d, "yyyy-MM-dd");
      const dayUsers = dailyMap.get(ds);
      let dayTotal = 0;
      const segments: { userId: string; value: number }[] = [];
      if (dayUsers) {
        for (const [uid, val] of dayUsers) {
          segments.push({ userId: uid, value: val });
          dayTotal += val;
        }
      }
      return { date: ds, segments, dayTotal };
    });
    const maxDayTotal = Math.max(...bars.map(b => b.dayTotal), 0.1);

    return { totalRevenue, totalCost, totalDays, marginAbs, marginPct, budgetPct, budgetConsumed, budgetUnit, expenseTotal, users, bars, maxDayTotal };
  }, [cells, rows, scopeProjectIds, allUsers, expenseMap, dailyRate, budget, year]);

  const marginColor = metrics.marginPct > 30 ? "#059669" : metrics.marginPct > 10 ? "#d97706" : metrics.marginPct > 0 ? "#ea580c" : "#ef4444";
  const budgetColor = metrics.budgetPct <= 0.7 ? "#059669" : metrics.budgetPct <= 0.9 ? "#d97706" : metrics.budgetPct <= 1.0 ? "#ea580c" : "#ef4444";

  // User color map
  const userColorMap = useMemo(() => {
    const m = new Map<string, string>();
    metrics.users.forEach((u, i) => m.set(u.userId, PALETTE[i % PALETTE.length]));
    return m;
  }, [metrics.users]);

  return (
    <div className="flex h-full flex-col">
      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-3">
        {(["summary", "collaborators", "activity"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-2.5 py-2 text-[10px] font-medium transition-colors ${
              activeTab === tab
                ? "border-b-2 border-gray-900 text-gray-900"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {t(tab)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ─── Summary tab ─── */}
        {activeTab === "summary" && (
          <div className="space-y-3 px-4 py-3">
            {/* Donut chart: revenue vs cost */}
            {metrics.totalRevenue > 0 && (
              <div className="flex items-center justify-center py-2">
                <DonutChart revenue={metrics.totalRevenue} cost={metrics.totalCost} marginPct={metrics.marginPct} marginColor={marginColor} />
              </div>
            )}

            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{t("revenue")}</span>
              <span className="text-sm font-semibold text-[#2D9B8F]">{fmtEur(metrics.totalRevenue)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{t("charges")}</span>
              <span className="text-sm font-semibold text-[#E06B62]">{fmtEur(metrics.totalCost)}</span>
            </div>
            {metrics.expenseTotal > 0 && (
              <div className="flex items-baseline justify-between pl-3">
                <span className="text-[10px] text-gray-400">{t("expenses")}</span>
                <span className="text-xs text-gray-500">{fmtEur(metrics.expenseTotal)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{t("margin")}</span>
              <div className="text-right">
                <span className="text-sm font-semibold" style={{ color: marginColor }}>{metrics.marginPct.toFixed(1)}%</span>
                <span className="ml-1.5 text-[10px] text-gray-400">{fmtEur(metrics.marginAbs)}</span>
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{t("daysConsumed")}</span>
              <span className="text-sm font-medium text-gray-700">{fmtTime(metrics.totalDays)}</span>
            </div>

            {budget > 0 && (
              <div className="border-t border-gray-100 pt-3">
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{t("budget")}</span>
                  <span className="text-[10px] font-medium" style={{ color: budgetColor }}>{Math.round(metrics.budgetPct * 100)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(metrics.budgetPct * 100, 100)}%`, backgroundColor: budgetColor }} />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                  <span>{metrics.budgetUnit === "€" ? fmtEur(metrics.budgetConsumed) : fmtTime(metrics.budgetConsumed)}</span>
                  <span>{metrics.budgetUnit === "€" ? fmtEur(budget) : `${budget}j`}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Collaborators tab ─── */}
        {activeTab === "collaborators" && (
          <div className="px-3 py-2">
            {metrics.users.length === 0 ? (
              <p className="py-4 text-center text-[11px] text-gray-400">{t("noData")}</p>
            ) : (
              <div className="space-y-1">
                {metrics.users.map((u) => {
                  const uMarginPct = u.revenue > 0 ? ((u.revenue - u.cost) / u.revenue) * 100 : 0;
                  const color = userColorMap.get(u.userId) ?? PALETTE[0];
                  return (
                    <div key={u.userId} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                      <span className="flex-1 truncate text-xs font-medium text-gray-700">{u.name}</span>
                      <span className="text-[10px] tabular-nums text-gray-400">{fmtTime(u.days)}</span>
                      <span className="w-12 text-right text-[10px] tabular-nums font-medium text-gray-700">{fmtEur(u.revenue)}</span>
                      <span className="w-8 text-right text-[10px] tabular-nums font-semibold" style={{ color: uMarginPct >= 0 ? "#2D9B8F" : "#E06B62" }}>
                        {uMarginPct.toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── Activity tab ─── */}
        {activeTab === "activity" && (
          <div className="px-3 py-3">
            {metrics.bars.length === 0 ? (
              <p className="py-4 text-center text-[11px] text-gray-400">{t("noData")}</p>
            ) : (
              <>
                <div className="flex items-end gap-px" style={{ height: 80 }}>
                  {metrics.bars.map(({ date, segments, dayTotal }) => {
                    const barH = metrics.maxDayTotal > 0 ? (dayTotal / metrics.maxDayTotal) * 100 : 0;
                    return (
                      <div key={date} className="group relative flex flex-1 flex-col justify-end" style={{ height: "100%" }}>
                        <div className="flex w-full flex-col overflow-hidden rounded-t-sm" style={{ height: `${barH}%` }}>
                          {segments.map((s) => {
                            const segPct = dayTotal > 0 ? (s.value / dayTotal) * 100 : 0;
                            return (
                              <div key={s.userId} style={{ height: `${segPct}%`, backgroundColor: userColorMap.get(s.userId) ?? PALETTE[0] }} />
                            );
                          })}
                        </div>
                        <div className="pointer-events-none absolute -top-5 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-1 py-0.5 text-[8px] text-white shadow group-hover:block">
                          {date.slice(5)} · {parseFloat(dayTotal.toFixed(1))}j
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Date labels */}
                <div className="mt-1 flex justify-between text-[8px] text-gray-400">
                  <span>{metrics.bars[0]?.date.slice(5)}</span>
                  <span>{metrics.bars[metrics.bars.length - 1]?.date.slice(5)}</span>
                </div>
                {/* Legend */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {metrics.users.map((u) => (
                    <div key={u.userId} className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: userColorMap.get(u.userId) ?? PALETTE[0] }} />
                      <span className="text-[9px] text-gray-500">{u.name.split(" ")[0]}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Donut Chart (SVG) ────────────────────────────────────

function DonutChart({ revenue, cost, marginPct, marginColor }: { revenue: number; cost: number; marginPct: number; marginColor: string }) {
  const size = 100;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = revenue + cost || 1;
  const costPct = cost / total;
  const revPct = revenue / total;

  const costDash = costPct * circumference;
  const revDash = revPct * circumference;

  return (
    <div className="relative">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
        {/* Cost arc (coral) */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#E06B62" strokeWidth={stroke}
          strokeDasharray={`${costDash} ${circumference}`}
          strokeDashoffset={0}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeLinecap="round"
        />
        {/* Revenue arc (teal) */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#2D9B8F" strokeWidth={stroke}
          strokeDasharray={`${revDash} ${circumference}`}
          strokeDashoffset={-costDash}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeLinecap="round"
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-bold" style={{ color: marginColor }}>{marginPct.toFixed(0)}%</span>
        <span className="text-[8px] font-medium uppercase tracking-wide text-gray-400">marge</span>
      </div>
    </div>
  );
}
