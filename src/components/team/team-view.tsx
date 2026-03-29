"use client";

import { useState, useTransition } from "react";
import { PencilSimple, Trash, EnvelopeSimple, Plus, Check, X, Blueprint } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { createUser, updateUser, deleteUser, sendInvitation } from "@/app/(dashboard)/team/actions";
import Link from "next/link";
import { createWorkplace, deleteWorkplace, updateWorkplace } from "@/app/(dashboard)/workplace/actions";
import { UserAvatar } from "@/components/ui/user-avatar";
import { House, Buildings, MapPin } from "@phosphor-icons/react";
import type { OrgRole } from "@/lib/auth-context";

interface User {
  id: string;
  authUserId: string | null;
  email: string | null;
  name: string | null;
  role: "admin" | "manager" | "collaborator" | null;
  hourlyCost: string | null;
  dailyCost: string | null;
  hoursPerDay: string | null;
  defaultWorkplaceId: string | null;
  status: "active" | "inactive" | null;
  memberStatus: "pending" | "active" | "declined";
  createdAt: Date | null;
  updatedAt: Date | null;
  image: string | null;
}

interface WorkplaceItem {
  id: string;
  name: string;
  type: "remote" | "office" | "client";
  address: string | null;
  color: string | null;
  sortOrder: number | null;
}

const WP_ICONS = { remote: House, office: Buildings, client: MapPin };
const WP_COLORS: Record<string, string> = { remote: "#6366f1", office: "#2D9B8F", client: "#F0A030" };
const DEFAULT_COLORS = ["#6366f1", "#2D9B8F", "#F0A030", "#E06B62", "#7B8FB2", "#9B6BB0", "#4AA3C5", "#6BAB6E"];

interface TeamViewProps {
  users: User[];
  userRole?: OrgRole;
  workplaces?: WorkplaceItem[];
}

export function TeamView({ users, userRole, workplaces: initialWorkplaces = [] }: TeamViewProps) {
  const tTeam = useTranslations("team");
  const tUser = useTranslations("user");
  const tWp = useTranslations("workplace");
  const tCommon = useTranslations("common");
  const [wpItems, setWpItems] = useState(initialWorkplaces);
  const tEnum = useTranslations("enums");
  const canManage = userRole === "admin" || userRole === "manager";
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  // Edit state
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("collaborator");
  const [editCost, setEditCost] = useState("");
  const [editHpd, setEditHpd] = useState("7");
  const [editStatus, setEditStatus] = useState("active");

  const startEditing = (user: User) => {
    setEditingId(user.id);
    setEditName(user.name ?? "");
    setEditRole(user.role ?? "collaborator");
    setEditCost(user.dailyCost ?? "");
    setEditHpd(user.hoursPerDay ?? "7");
    setEditStatus(user.memberStatus ?? "active");
  };

  const handleSaveEdit = (userId: string) => {
    startTransition(async () => {
      await updateUser({
        id: userId,
        name: editName,
        role: editRole as "admin" | "manager" | "collaborator",
        dailyCost: editCost || null,
        hoursPerDay: editHpd || null,
        memberStatus: editStatus as "pending" | "active",
      });
      setEditingId(null);
    });
  };

  const handleDelete = (userId: string) => {
    startTransition(async () => {
      await deleteUser(userId);
    });
  };

  const handleInvite = (user: User) => {
    if (!user.email) return;
    startTransition(async () => {
      await sendInvitation({ email: user.email!, name: user.name ?? tEnum("role.collaborator") });
      setInvitedIds((prev) => new Set(prev).add(user.id));
    });
  };

  const handleAddUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await createUser(formData);
      setShowAddForm(false);
    });
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{tTeam("title")}</h1>
          <p className="text-[12px] text-gray-500">{users.length > 1 ? tTeam("collaboratorCountPlural", { count: users.length }) : tTeam("collaboratorCount", { count: users.length })}</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800"
          >
            <Plus size={14} weight="fill" />
            {tCommon("add")}
          </button>
        )}
      </div>

      {/* Add form */}
      {canManage && showAddForm && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <form onSubmit={handleAddUser} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[140px]">
              <label className="mb-1 block text-[11px] font-medium text-gray-500">{tTeam("name")}</label>
              <input
                name="name"
                required
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 outline-none focus:border-gray-300"
                placeholder={tUser("namePlaceholder")}
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="mb-1 block text-[11px] font-medium text-gray-500">{tTeam("email")}</label>
              <input
                name="email"
                type="email"
                required
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 outline-none focus:border-gray-300"
                placeholder={tUser("emailPlaceholder")}
              />
            </div>
            <div className="w-[120px]">
              <label className="mb-1 block text-[11px] font-medium text-gray-500">{tTeam("role")}</label>
              <select
                name="role"
                defaultValue="collaborator"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 outline-none focus:border-gray-300"
              >
                <option value="collaborator">{tEnum("role.collaborator")}</option>
                <option value="manager">{tEnum("role.manager")}</option>
                <option value="admin">{tEnum("role.admin")}</option>
              </select>
            </div>
            <div className="w-[100px]">
              <label className="mb-1 block text-[11px] font-medium text-gray-500">{tTeam("costPerDay")}</label>
              <input
                name="dailyCost"
                type="number"
                step="0.01"
                min="0"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 outline-none focus:border-gray-300"
                placeholder="350"
              />
            </div>
            <div className="w-[80px]">
              <label className="mb-1 block text-[11px] font-medium text-gray-500">{tTeam("hoursPerDay")}</label>
              <input
                name="hoursPerDay"
                type="number"
                step="0.5"
                min="1"
                max="24"
                defaultValue="7"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 outline-none focus:border-gray-300"
              />
            </div>
            <div className="flex gap-1.5">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {isPending ? "..." : tCommon("create")}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100"
              >
                {tCommon("cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500">{tTeam("name")}</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500">{tTeam("email")}</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500">{tTeam("role")}</th>
              <th className="px-4 py-2.5 text-right text-[11px] font-medium text-gray-500">{tTeam("costPerDay")}</th>
              <th className="px-4 py-2.5 text-right text-[11px] font-medium text-gray-500">{tTeam("hoursPerDay")}</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500">{tWp("setWorkplace")}</th>
              <th className="px-4 py-2.5 text-center text-[11px] font-medium text-gray-500">{tTeam("status")}</th>
              {canManage && <th className="px-4 py-2.5 text-right text-[11px] font-medium text-gray-500">{tTeam("actions")}</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isEditing = editingId === user.id;
              const name = user.name ?? tCommon("noName");

              return (
                <tr
                  key={user.id}
                  className="border-b border-gray-50 transition-colors hover:bg-gray-50/50"
                >
                  {/* Name */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar name={name} image={user.image} size={28} />
                      {isEditing ? (
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-700 outline-none focus:border-gray-400"
                          autoFocus
                        />
                      ) : (
                        <span className="text-xs font-medium text-gray-900">{name}</span>
                      )}
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-4 py-2.5">
                    <span className="text-xs text-gray-500">{user.email ?? "—"}</span>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-2.5">
                    {isEditing ? (
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs text-gray-700 outline-none focus:border-gray-400"
                      >
                        <option value="collaborator">{tEnum("role.collaborator")}</option>
                        <option value="manager">{tEnum("role.manager")}</option>
                        <option value="admin">{tEnum("role.admin")}</option>
                      </select>
                    ) : (
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                        {tEnum(`role.${user.role ?? "collaborator"}`)}
                      </span>
                    )}
                  </td>

                  {/* Daily cost */}
                  <td className="px-4 py-2.5 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editCost}
                        onChange={(e) => setEditCost(e.target.value)}
                        className="w-20 rounded border border-gray-300 bg-white px-2 py-0.5 text-right text-xs text-gray-700 outline-none focus:border-gray-400"
                      />
                    ) : (
                      <span className="text-xs text-gray-700">
                        {user.dailyCost ? `${user.dailyCost} €` : "—"}
                      </span>
                    )}
                  </td>

                  {/* Hours per day */}
                  <td className="px-4 py-2.5 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        max="24"
                        value={editHpd}
                        onChange={(e) => setEditHpd(e.target.value)}
                        className="w-16 rounded border border-gray-300 bg-white px-2 py-0.5 text-right text-xs text-gray-700 outline-none focus:border-gray-400"
                      />
                    ) : (
                      <span className="text-xs text-gray-700">
                        {user.hoursPerDay ?? "7"}h
                      </span>
                    )}
                  </td>

                  {/* Workplace */}
                  <td className="px-4 py-2.5">
                    <select
                      value={user.defaultWorkplaceId ?? ""}
                      onChange={(e) => {
                        const wpId = e.target.value || null;
                        startTransition(async () => {
                          await updateUser({ id: user.id, defaultWorkplaceId: wpId });
                        });
                      }}
                      disabled={isPending}
                      className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-700 outline-none focus:border-gray-400 disabled:opacity-50"
                    >
                      <option value="">—</option>
                      {wpItems.map((wp) => (
                        <option key={wp.id} value={wp.id}>{wp.name}</option>
                      ))}
                    </select>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-2.5 text-center">
                    {isEditing ? (
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs text-gray-700 outline-none focus:border-gray-400"
                      >
                        <option value="active">{tEnum("userStatus.active")}</option>
                        <option value="pending">{tEnum("memberStatus.pending")}</option>
                      </select>
                    ) : (
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          user.memberStatus === "active"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-amber-50 text-amber-600"
                        }`}
                      >
                        {tEnum(`memberStatus.${user.memberStatus as "pending" | "active"}`)}
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  {canManage && (
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleSaveEdit(user.id)}
                              disabled={isPending}
                              className="rounded p-1 text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-50"
                              title={tCommon("save")}
                            >
                              <Check size={14} weight="fill" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100"
                              title={tCommon("cancel")}
                            >
                              <X size={14} weight="fill" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEditing(user)}
                              className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                              title={tCommon("edit")}
                            >
                              <PencilSimple size={14} weight="fill" />
                            </button>
                            <button
                              onClick={() => handleInvite(user)}
                              disabled={isPending || !user.email || invitedIds.has(user.id)}
                              className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
                              title={invitedIds.has(user.id) ? tUser("inviteSent") : tUser("inviteByEmail")}
                            >
                              <EnvelopeSimple size={14} weight="fill" />
                            </button>
                            <button
                              onClick={() => handleDelete(user.id)}
                              disabled={isPending}
                              className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                              title={tCommon("delete")}
                            >
                              <Trash size={14} weight="fill" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Workplaces section */}
      {canManage && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">{tWp("title")}</h2>
          <div className="space-y-2">
            {wpItems.map((wp) => {
              const Icon = WP_ICONS[wp.type];
              return (
                <div key={wp.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5">
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: (wp.color || WP_COLORS[wp.type]) + "20", color: wp.color || WP_COLORS[wp.type] }}
                  >
                    <Icon size={14} weight="fill" />
                  </div>
                  <span className="flex-1 text-sm text-gray-900">{wp.name}</span>
                  {wp.address && <span className="text-[11px] text-gray-400">{wp.address}</span>}
                  <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">{tWp(wp.type)}</span>
                  {wp.type === "office" && (
                    <Link
                      href={`/workplace/floor-plan?workplaceId=${wp.id}`}
                      className="rounded p-1 text-gray-300 transition-colors hover:bg-blue-50 hover:text-blue-600"
                      title={tWp("configureFloorPlan")}
                    >
                      <Blueprint size={14} />
                    </Link>
                  )}
                  <button
                    onClick={() => startTransition(async () => {
                      await deleteWorkplace(wp.id);
                      setWpItems(prev => prev.filter(w => w.id !== wp.id));
                    })}
                    disabled={isPending}
                    className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              );
            })}
          </div>
          <WorkplaceAddForm
            onAdd={(wp) => setWpItems(prev => [...prev, wp])}
          />
        </div>
      )}
    </div>
  );
}

function WorkplaceAddForm({ onAdd }: { onAdd: (wp: WorkplaceItem) => void }) {
  const tWp = useTranslations("workplace");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"remote" | "office" | "client">("office");
  const [address, setAddress] = useState("");
  const [color, setColor] = useState(DEFAULT_COLORS[0]);
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      const wp = await createWorkplace({ name: name.trim(), type, address: address || undefined, color });
      onAdd({ ...wp, sortOrder: wp.sortOrder ?? 0 });
      setName("");
      setAddress("");
      setShowForm(false);
    });
  };

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-2.5 text-xs font-medium text-gray-500 hover:border-gray-400 hover:bg-gray-50"
      >
        <Plus size={14} />
        {tWp("addWorkplace")}
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={tWp("name")}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
      />
      <div className="flex gap-2">
        {(["office", "remote", "client"] as const).map((t) => {
          const Icon = WP_ICONS[t];
          return (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                type === t ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Icon size={14} />
              {tWp(t)}
            </button>
          );
        })}
      </div>
      {(type === "office" || type === "client") && (
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={tWp("address")}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
        />
      )}
      <div className="flex gap-1.5">
        {DEFAULT_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`h-5 w-5 rounded-full ${color === c ? "scale-125 ring-2 ring-gray-400 ring-offset-1" : "hover:scale-110"}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleCreate}
          disabled={!name.trim() || isPending}
          className="flex-1 rounded-lg bg-gray-900 py-2 text-xs font-medium text-white hover:bg-gray-800 disabled:bg-gray-300"
        >
          {tWp("addWorkplace")}
        </button>
        <button
          onClick={() => setShowForm(false)}
          className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          {tWp("cancel")}
        </button>
      </div>
    </div>
  );
}
