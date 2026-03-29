"use client";

import { useState, useTransition } from "react";
import { Trash, EnvelopeSimple } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { removeAssignment, updateAssignmentRate, updateAssignmentDailyCost } from "@/app/(dashboard)/projects/actions";
import { UserAvatar } from "@/components/ui/user-avatar";
import { updateUser, sendInvitation } from "@/app/(dashboard)/team/actions";
import type { UserInfo, AssignmentInfo, SheetRow } from "@/types";
import type { OrgRole } from "@/lib/auth-context";
import { EditableField } from "@/components/ui/editable-field";

interface UserDetailPanelProps {
  userId: string;
  projectId: string;
  userName: string;
  allUsers: UserInfo[];
  allAssignments: AssignmentInfo[];
  rows: SheetRow[];
  onClose: () => void;
  userRole?: OrgRole;
}

export function UserDetailPanel({
  userId,
  projectId,
  userName,
  allUsers,
  allAssignments,
  rows,
  onClose,
  userRole,
}: UserDetailPanelProps) {
  const tProject = useTranslations("project");
  const tUser = useTranslations("user");
  const tCommon = useTranslations("common");
  const tEnum = useTranslations("enums");
  const tGrid = useTranslations("grid");
  const canManage = userRole === "admin" || userRole === "manager";
  const [isPending, startTransition] = useTransition();

  const user = allUsers.find((u) => u.id === userId);
  const assignment = allAssignments.find(
    (a) => a.userId === userId && a.projectId === projectId
  );
  const sheetRow = rows.find(
    (r) => r.type === "user" && r.userId === userId && r.projectId === projectId
  );

  const userImage = user?.image ?? null;

  // --- Assignment-level state (saved to projectAssignments) ---
  // Only show assignment's OWN value in input — fallback is informational only
  const [editingRate, setEditingRate] = useState(false);
  const hasRateOverride = !!assignment?.dailyRate;
  const ownRate = assignment?.dailyRate ?? "";
  const fallbackRate = sheetRow?.dailyRate != null ? String(sheetRow.dailyRate) : "";
  const [rateValue, setRateValue] = useState(ownRate);

  const [editingDailyCost, setEditingDailyCost] = useState(false);
  const hasCostOverride = !!assignment?.dailyCost;
  const ownCost = assignment?.dailyCost ?? "";
  const fallbackCost = user?.dailyCost ?? "";
  const [dailyCostValue, setDailyCostValue] = useState(ownCost);

  // --- User-level state (saved to users) ---
  const [editingRole, setEditingRole] = useState(false);
  const [roleValue, setRoleValue] = useState(user?.role ?? "collaborator");
  const [editingHpd, setEditingHpd] = useState(false);
  const [hpdValue, setHpdValue] = useState(user?.hoursPerDay ?? "7");
  const [inviteSent, setInviteSent] = useState(false);

  // --- Assignment handlers ---
  const handleSaveRate = () => {
    if (!assignment) return;
    startTransition(async () => {
      await updateAssignmentRate({
        assignmentId: assignment.id,
        dailyRate: rateValue || null,
      });
      setEditingRate(false);
    });
  };

  const handleResetRate = () => {
    if (!assignment) return;
    startTransition(async () => {
      await updateAssignmentRate({
        assignmentId: assignment.id,
        dailyRate: null,
      });
      setRateValue("");
      setEditingRate(false);
    });
  };

  const handleSaveDailyCost = () => {
    if (!assignment) return;
    startTransition(async () => {
      await updateAssignmentDailyCost({
        assignmentId: assignment.id,
        dailyCost: dailyCostValue || null,
      });
      setEditingDailyCost(false);
    });
  };

  const handleResetCost = () => {
    if (!assignment) return;
    startTransition(async () => {
      await updateAssignmentDailyCost({
        assignmentId: assignment.id,
        dailyCost: null,
      });
      setDailyCostValue("");
      setEditingDailyCost(false);
    });
  };

  const handleRemove = () => {
    if (!assignment) return;
    startTransition(async () => {
      await removeAssignment(assignment.id);
      onClose();
    });
  };

  // --- User handlers ---
  const handleSaveRole = () => {
    startTransition(async () => {
      await updateUser({ id: userId, role: roleValue as "admin" | "manager" | "collaborator" });
      setEditingRole(false);
    });
  };

  const handleSaveHpd = () => {
    startTransition(async () => {
      await updateUser({ id: userId, hoursPerDay: hpdValue || null });
      setEditingHpd(false);
    });
  };

  const handleInvite = () => {
    if (!user?.email) return;
    startTransition(async () => {
      await sendInvitation({ email: user.email!, name: user.name });
      setInviteSent(true);
    });
  };

  return (
    <div className="p-4">
      {/* Avatar + Name + Email */}
      <div className="mb-4 flex items-center gap-3">
        <UserAvatar name={userName} image={userImage} size={40} />
        <div>
          <p className="text-sm font-medium text-gray-900">{userName}</p>
          {user?.email && (
            <p className="text-[11px] text-gray-500">{user.email}</p>
          )}
        </div>
      </div>

      {/* Assignment section — TJM + Cost */}
      <div className="mb-3 space-y-2 rounded-lg bg-gray-50 p-3">
        <div>
          <EditableField
            label={tProject("projectDailyRate")}
            value={rateValue}
            editing={editingRate}
            onEdit={() => setEditingRate(true)}
            onChange={setRateValue}
            onSave={handleSaveRate}
            onCancel={() => setEditingRate(false)}
            suffix="€"
            type="number"
            step="0.01"
            min="0"
            defaultLabel={ownRate ? `${ownRate} €` : fallbackRate ? `${fallbackRate} €` : tCommon("notDefined")}
            canManage={canManage}
            isPending={isPending}
          />
          {!hasRateOverride && fallbackRate && (
            <p className="mt-0.5 text-[10px] text-gray-400">{tProject("rateFromProject")} : {fallbackRate} €</p>
          )}
          {hasRateOverride && canManage && (
            <button
              onClick={handleResetRate}
              disabled={isPending}
              className="mt-0.5 text-[10px] text-gray-400 underline decoration-dashed underline-offset-2 hover:text-gray-600 disabled:opacity-50"
            >
              {tProject("resetToDefault")}
            </button>
          )}
        </div>
        <div>
          <EditableField
            label={tProject("projectDailyCost")}
            value={dailyCostValue}
            editing={editingDailyCost}
            onEdit={() => setEditingDailyCost(true)}
            onChange={setDailyCostValue}
            onSave={handleSaveDailyCost}
            onCancel={() => setEditingDailyCost(false)}
            suffix="€"
            type="number"
            step="0.01"
            min="0"
            defaultLabel={ownCost ? `${ownCost} €` : fallbackCost ? `${fallbackCost} €` : tCommon("notDefined")}
            canManage={canManage}
            isPending={isPending}
          />
          {!hasCostOverride && fallbackCost && (
            <p className="mt-0.5 text-[10px] text-gray-400">{tProject("costFromProfile")} : {fallbackCost} €</p>
          )}
          {hasCostOverride && canManage && (
            <button
              onClick={handleResetCost}
              disabled={isPending}
              className="mt-0.5 text-[10px] text-gray-400 underline decoration-dashed underline-offset-2 hover:text-gray-600 disabled:opacity-50"
            >
              {tProject("resetToDefault")}
            </button>
          )}
        </div>
      </div>

      {/* Profile section — Role + Hours */}
      <div className="mb-3 space-y-2 rounded-lg bg-gray-50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-500">{tUser("role")}</span>
          {editingRole && canManage ? (
            <div className="flex items-center gap-1">
              <select
                value={roleValue}
                onChange={(e) => setRoleValue(e.target.value)}
                className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] text-gray-700 outline-none focus:border-gray-400"
                autoFocus
              >
                <option value="collaborator">{tEnum("role.collaborator")}</option>
                <option value="manager">{tEnum("role.manager")}</option>
                <option value="admin">{tEnum("role.admin")}</option>
              </select>
              <button
                onClick={handleSaveRole}
                disabled={isPending}
                className="ml-1 rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                OK
              </button>
            </div>
          ) : canManage ? (
            <button
              onClick={() => setEditingRole(true)}
              className="text-[11px] font-medium capitalize text-gray-700 underline decoration-dashed decoration-gray-300 underline-offset-2 hover:text-gray-900"
            >
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {tEnum(`role.${roleValue}` as any)}
            </button>
          ) : (
            <span className="text-[11px] font-medium capitalize text-gray-700">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {tEnum(`role.${roleValue}` as any)}
            </span>
          )}
        </div>
        <EditableField
          label={tUser("hoursDay")}
          value={hpdValue}
          editing={editingHpd}
          onEdit={() => setEditingHpd(true)}
          onChange={setHpdValue}
          onSave={handleSaveHpd}
          onCancel={() => setEditingHpd(false)}
          suffix={tGrid("unitHour")}
          type="number"
          step="0.01"
          min="0"
          canManage={canManage}
          isPending={isPending}
        />
      </div>

      {/* Actions */}
      <div className="space-y-2">
        {canManage && assignment && (
          <button
            onClick={handleRemove}
            disabled={isPending}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
          >
            <Trash size={14} weight="fill" />
            {isPending ? tCommon("removing") : tProject("removeFromProject")}
          </button>
        )}
        {canManage && user?.email && (
          <button
            onClick={handleInvite}
            disabled={isPending || inviteSent}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <EnvelopeSimple size={14} weight="fill" />
            {inviteSent ? tUser("inviteSent") : isPending ? tCommon("sending") : tUser("inviteByEmail")}
          </button>
        )}
      </div>
    </div>
  );
}
