"use client";

import { useState, useTransition } from "react";
import { Trash, UserPlus } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { updateAbsenceType, deleteAbsenceType } from "@/app/(dashboard)/absences/actions";
import type { ProjectInfo } from "@/types";
import type { OrgRole } from "@/lib/auth-context";
import { EditableField } from "@/components/ui/editable-field";

interface AbsenceTypeDetailPanelProps {
  projectId: string;
  projectName: string;
  clientName: string;
  allProjects: ProjectInfo[];
  onClose: () => void;
  onOpenAssignUser?: (projectId: string, projectName: string, clientName: string) => void;
  userRole?: OrgRole;
}

export function AbsenceTypeDetailPanel({
  projectId,
  projectName,
  clientName,
  allProjects,
  onClose,
  onOpenAssignUser,
  userRole,
}: AbsenceTypeDetailPanelProps) {
  const t = useTranslations("absence");
  const tCommon = useTranslations("common");
  const canManage = userRole === "admin" || userRole === "manager";
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);

  const project = allProjects.find((p) => p.id === projectId);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(project?.name ?? projectName);
  const [editingCost, setEditingCost] = useState(false);
  const [costValue, setCostValue] = useState(project?.dailyRate ?? "");

  const handleSave = (field: string, value: string | null) => {
    startTransition(async () => {
      if (field === "name") {
        await updateAbsenceType({ id: projectId, name: value ?? undefined });
      } else if (field === "dailyCost") {
        await updateAbsenceType({ id: projectId, dailyCost: value });
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteAbsenceType(projectId);
      onClose();
    });
  };

  return (
    <div className="p-4">
      <p className="mb-4 text-xs text-gray-500">{t("category")} : {clientName}</p>

      <div className="mb-4 space-y-2 rounded-lg bg-gray-50 p-3">
        <EditableField
          label={t("name")}
          value={nameValue}
          editing={editingName}
          onEdit={() => setEditingName(true)}
          onChange={setNameValue}
          onSave={() => {
            if (nameValue.trim()) {
              handleSave("name", nameValue.trim());
            }
            setEditingName(false);
          }}
          onCancel={() => setEditingName(false)}
          canManage={canManage}
          isPending={isPending}
          inputWidth="w-28"
        />

        <EditableField
          label={t("cost")}
          value={costValue ? `${costValue} €` : ""}
          editing={editingCost}
          onEdit={() => setEditingCost(true)}
          onChange={setCostValue}
          onSave={() => {
            handleSave("dailyCost", costValue || null);
            setEditingCost(false);
          }}
          onCancel={() => setEditingCost(false)}
          type="number"
          canManage={canManage}
          isPending={isPending}
          inputWidth="w-20"
        />
      </div>

      {/* Assign collaborator */}
      {canManage && (
        <button
          onClick={() => onOpenAssignUser?.(projectId, project?.name ?? projectName, clientName)}
          className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
        >
          <UserPlus size={14} />
          {tCommon("add")}
        </button>
      )}

      {/* Delete button */}
      {canManage && !showConfirm && (
        <button
          onClick={() => setShowConfirm(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
        >
          <Trash size={14} weight="fill" />
          {t("deleteType")}
        </button>
      )}

      {canManage && showConfirm && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="flex gap-2">
            <button
              onClick={() => setShowConfirm(false)}
              disabled={isPending}
              className="flex-1 rounded-lg border border-gray-200 bg-white py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              {tCommon("cancel")}
            </button>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="flex-1 rounded-lg bg-red-600 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              <span className="flex items-center justify-center gap-1">
                <Trash size={12} weight="fill" />
                {isPending ? tCommon("deleting") : tCommon("delete")}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
