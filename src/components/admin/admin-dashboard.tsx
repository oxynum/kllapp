"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, MagnifyingGlass, CaretUp, CaretDown, Circle, EnvelopeSimple, Key, UserPlus, Bell } from "@phosphor-icons/react";
import { KllappLogo } from "@/components/ui/kllapp-logo";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface OrgData {
  id: string;
  name: string;
  slug: string;
  created_at: Date;
  owner_name: string | null;
  owner_email: string | null;
  total_users: number;
  admin_count: number;
  manager_count: number;
  collaborator_count: number;
  project_count: number;
  client_count: number;
  workplace_count: number;
  desk_count: number;
  last_activity: Date | null;
  total_revenue: number;
}

interface EmailStat {
  category: string;
  total: number;
  last_24h: number;
  last_7d: number;
  last_30d: number;
}

type SortKey = keyof OrgData;

const fmtEur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const EMAIL_CATEGORY_META: Record<string, { label: string; icon: typeof EnvelopeSimple; color: string }> = {
  magic_link: { label: "Magic Links", icon: Key, color: "text-violet-600" },
  invitation: { label: "Invitations", icon: UserPlus, color: "text-blue-600" },
  notification: { label: "Notifications", icon: Bell, color: "text-amber-600" },
};

export function AdminDashboard({ organizations, emailStats = [] }: { organizations: OrgData[]; emailStats?: EmailStat[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const filtered = useMemo(() => {
    let rows = organizations;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        r.owner_name?.toLowerCase().includes(q) ||
        r.owner_email?.toLowerCase().includes(q)
      );
    }
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [organizations, search, sortKey, sortDir]);

  // Aggregates
  const totalOrgs = organizations.length;
  const totalUsers = organizations.reduce((s, o) => s + o.total_users, 0);
  const totalRevenue = organizations.reduce((s, o) => s + Number(o.total_revenue), 0);
  // Snapshot time at mount (avoid impure Date.now() in render)
  const [now] = useState(() => Date.now());
  const liveOrgs = organizations.filter(o => o.last_activity && now - new Date(o.last_activity).getTime() < 5 * 60 * 1000).length;

  const th = (col: SortKey, label: string, align?: string) => (
    <th
      key={col}
      onClick={() => toggleSort(col)}
      className={`cursor-pointer select-none px-3 py-2.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 transition-colors hover:text-gray-900 ${align === "right" ? "text-right" : "text-left"}`}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {sortKey === col && (sortDir === "asc" ? <CaretUp size={10} /> : <CaretDown size={10} />)}
      </span>
    </th>
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="rounded-lg border border-gray-200 p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900">
            <ArrowLeft size={16} />
          </Link>
          <KllappLogo className="h-5 w-auto" />
          <span className="rounded-md bg-gray-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">Admin</span>
        </div>
        <div className="relative">
          <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-xs text-gray-900 outline-none focus:border-gray-400"
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        {[
          { label: "Organisations", value: String(totalOrgs) },
          { label: "Utilisateurs", value: String(totalUsers) },
          { label: "CA total", value: fmtEur(totalRevenue) },
          { label: "En ligne", value: String(liveOrgs), color: "text-emerald-600" },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{card.label}</p>
            <p className={`mt-1 text-xl font-semibold ${card.color ?? "text-gray-900"}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Email stats */}
      {emailStats.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <EnvelopeSimple size={14} />
            Emails envoyés
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {emailStats.map((stat) => {
              const meta = EMAIL_CATEGORY_META[stat.category] ?? {
                label: stat.category,
                icon: EnvelopeSimple,
                color: "text-gray-600",
              };
              const Icon = meta.icon;
              return (
                <div key={stat.category} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className={meta.color} weight="fill" />
                    <span className="text-xs font-medium text-gray-700">{meta.label}</span>
                  </div>
                  <p className={`mt-1.5 text-2xl font-semibold ${meta.color}`}>{stat.total}</p>
                  <div className="mt-2 flex gap-3 text-[10px] text-gray-400">
                    <span>24h: <strong className="text-gray-600">{stat.last_24h}</strong></span>
                    <span>7j: <strong className="text-gray-600">{stat.last_7d}</strong></span>
                    <span>30j: <strong className="text-gray-600">{stat.last_30d}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-100 bg-gray-50/50">
              <tr>
                {th("name", "Organisation")}
                {th("owner_name", "Owner")}
                {th("total_users", "Users", "right")}
                {th("project_count", "Projets", "right")}
                {th("client_count", "Clients", "right")}
                {th("workplace_count", "Lieux", "right")}
                {th("desk_count", "Bureaux", "right")}
                {th("total_revenue", "CA", "right")}
                {th("last_activity", "Activit\u00e9")}
                {th("created_at", "Cr\u00e9\u00e9 le")}
              </tr>
            </thead>
            <tbody>
              {filtered.map((org) => {
                const isLive = org.last_activity && now - new Date(org.last_activity).getTime() < 5 * 60 * 1000;
                return (
                  <tr key={org.id} className="border-b border-gray-50 transition-colors hover:bg-gray-50/50">
                    <td className="px-3 py-2.5">
                      <p className="text-sm font-medium text-gray-900">{org.name}</p>
                      <p className="text-[10px] text-gray-400">{org.slug}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-xs text-gray-700">{org.owner_name ?? "—"}</p>
                      <p className="text-[10px] text-gray-400">{org.owner_email ?? ""}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-xs font-medium text-gray-900">{org.total_users}</span>
                      <p className="text-[9px] text-gray-400">
                        {org.admin_count}a {org.manager_count}m {org.collaborator_count}c
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs text-gray-700">{org.project_count}</td>
                    <td className="px-3 py-2.5 text-right text-xs text-gray-700">{org.client_count}</td>
                    <td className="px-3 py-2.5 text-right text-xs text-gray-700">{org.workplace_count}</td>
                    <td className="px-3 py-2.5 text-right text-xs text-gray-700">{org.desk_count}</td>
                    <td className="px-3 py-2.5 text-right text-xs font-medium text-gray-900">{fmtEur(Number(org.total_revenue))}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {isLive && <Circle size={6} weight="fill" className="text-emerald-500" />}
                        <span className="text-[11px] text-gray-500">
                          {org.last_activity
                            ? formatDistanceToNow(new Date(org.last_activity), { addSuffix: true, locale: fr })
                            : "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-gray-500">
                      {new Date(org.created_at).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
