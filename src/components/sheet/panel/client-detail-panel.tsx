"use client";

import { useState, useTransition } from "react";
import { Trash } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { updateClient, deleteClient } from "@/app/(dashboard)/clients/actions";
import type { ClientInfo, ProjectInfo } from "@/types";
import type { OrgRole } from "@/lib/auth-context";
import { EditableField } from "@/components/ui/editable-field";

interface ClientDetailPanelProps {
  clientId: string;
  clientName: string;
  allClients: ClientInfo[];
  allProjects: ProjectInfo[];
  onClose: () => void;
  userRole?: OrgRole;
}

export function ClientDetailPanel({
  clientId,
  clientName,
  allClients,
  allProjects,
  onClose,
  userRole,
}: ClientDetailPanelProps) {
  const t = useTranslations("clientDetail");
  const tClient = useTranslations("client");
  const tCommon = useTranslations("common");
  const canManage = userRole === "admin" || userRole === "manager";
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);

  const client = allClients.find((c) => c.id === clientId);
  const clientProjects = allProjects.filter((p) => p.clientId === clientId && !p.parentId);

  // Editable fields
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(client?.name ?? clientName);
  const [editingContact, setEditingContact] = useState(false);
  const [contactValue, setContactValue] = useState(client?.contact ?? "");
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailValue, setEmailValue] = useState(client?.email ?? "");

  const handleSave = (field: string, value: string | null) => {
    startTransition(async () => {
      await updateClient({ id: clientId, [field]: value });
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteClient(clientId);
      onClose();
    });
  };

  return (
    <div className="p-4">
      {/* Main info */}
      <div className="mb-4 space-y-2 rounded-lg bg-gray-50 p-3">
        {/* Name */}
        <EditableField
          label={tClient("clientName")}
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

        {/* Contact */}
        <EditableField
          label={tClient("contact")}
          value={contactValue}
          editing={editingContact}
          onEdit={() => setEditingContact(true)}
          onChange={setContactValue}
          onSave={() => {
            handleSave("contact", contactValue.trim() || null);
            setEditingContact(false);
          }}
          onCancel={() => setEditingContact(false)}
          canManage={canManage}
          isPending={isPending}
          inputWidth="w-28"
        />

        {/* Email */}
        <EditableField
          label={tClient("email")}
          value={emailValue}
          editing={editingEmail}
          onEdit={() => setEditingEmail(true)}
          onChange={setEmailValue}
          onSave={() => {
            handleSave("email", emailValue.trim() || null);
            setEditingEmail(false);
          }}
          onCancel={() => setEditingEmail(false)}
          type="email"
          canManage={canManage}
          isPending={isPending}
          inputWidth="w-28"
        />
      </div>

      {/* Projects list */}
      {clientProjects.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {t("projects")} ({clientProjects.length})
          </h3>
          {clientProjects.map((project) => (
            <div
              key={project.id}
              className="mb-1 rounded-lg bg-gray-50 px-3 py-2"
            >
              <p className="text-xs font-medium text-gray-700">{project.name}</p>
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
          {t("deleteClient")}
        </button>
      )}

      {/* Confirmation */}
      {canManage && showConfirm && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="mb-3 text-xs text-red-700">
            {t("confirmDeleteMessage", { count: clientProjects.length })}
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
