"use client";

import { useState, useTransition } from "react";
import { Trash } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { updateAbsenceClient, deleteAbsenceClient } from "@/app/(dashboard)/absences/actions";
import type { ClientInfo, ProjectInfo } from "@/types";
import type { OrgRole } from "@/lib/auth-context";
import { EditableField } from "@/components/ui/editable-field";

interface AbsenceClientDetailPanelProps {
  clientId: string;
  clientName: string;
  allClients: ClientInfo[];
  allProjects: ProjectInfo[];
  onClose: () => void;
  userRole?: OrgRole;
}

export function AbsenceClientDetailPanel({
  clientId,
  clientName,
  allClients,
  allProjects,
  onClose,
  userRole,
}: AbsenceClientDetailPanelProps) {
  const t = useTranslations("absence");
  const tCommon = useTranslations("common");
  const canManage = userRole === "admin" || userRole === "manager";
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);

  const client = allClients.find((c) => c.id === clientId);
  const absenceTypes = allProjects.filter((p) => p.clientId === clientId && !p.parentId);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(client?.name ?? clientName);

  const handleSave = (field: string, value: string | null) => {
    startTransition(async () => {
      await updateAbsenceClient({ id: clientId, [field]: value });
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteAbsenceClient(clientId);
      onClose();
    });
  };

  return (
    <div className="p-4">
      <div className="mb-4 space-y-2 rounded-lg bg-gray-50 p-3">
        <EditableField
          label={t("categoryName")}
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
      </div>

      {/* Types list */}
      {absenceTypes.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {t("types")} ({absenceTypes.length})
          </h3>
          {absenceTypes.map((absType) => (
            <div
              key={absType.id}
              className="mb-1 rounded-lg bg-gray-50 px-3 py-2"
            >
              <p className="text-xs font-medium text-gray-700">{absType.name}</p>
              {absType.dailyRate && (
                <p className="text-[10px] text-gray-400">{t("cost")} : {absType.dailyRate} €</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete button */}
      {canManage && !showConfirm && (
        <button
          onClick={() => setShowConfirm(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
        >
          <Trash size={14} weight="fill" />
          {t("deleteCategory")}
        </button>
      )}

      {canManage && showConfirm && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="mb-3 text-xs text-red-700">
            {t("confirmDeleteMessage", { count: absenceTypes.length })}
          </p>
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
                {isPending ? tCommon("deleting") : t("confirmDelete")}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
