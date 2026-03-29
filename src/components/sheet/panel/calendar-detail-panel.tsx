"use client";

import { useState, useTransition } from "react";
import { Trash, MagnifyingGlass, Check, X as XIcon, Users } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import {
  updateCalendarIntegration,
  deleteCalendarIntegration,
  shareCalendar,
  unshareCalendar,
} from "@/app/(dashboard)/calendar/actions";
import type { CalendarIntegrationInfo, UserInfo } from "@/types";
import { EditableField } from "@/components/ui/editable-field";
import { UserAvatar } from "@/components/ui/user-avatar";

const COLOR_OPTIONS = [
  "#0891b2",
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
  "#64748b",
];

interface CalendarDetailPanelProps {
  integrationId: string;
  integrationLabel: string;
  allCalendarIntegrations: CalendarIntegrationInfo[];
  allUsers: UserInfo[];
  currentUserId: string;
  onClose: () => void;
}

export function CalendarDetailPanel({
  integrationId,
  integrationLabel,
  allCalendarIntegrations,
  allUsers,
  currentUserId,
  onClose,
}: CalendarDetailPanelProps) {
  const t = useTranslations("calendar");
  const tCommon = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [shareSearch, setShareSearch] = useState("");

  const integration = allCalendarIntegrations.find((c) => c.id === integrationId);
  const isSharedWithMe = integration?.isSharedWithMe === true;

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(integration?.label ?? integrationLabel);

  const handleSave = (field: string, value: string | boolean | null) => {
    startTransition(async () => {
      await updateCalendarIntegration({ id: integrationId, [field]: value });
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteCalendarIntegration(integrationId);
      onClose();
    });
  };

  const handleToggle = () => {
    handleSave("isEnabled", !integration?.isEnabled);
  };

  const handleShare = (userId: string) => {
    startTransition(async () => {
      await shareCalendar({ calendarIntegrationId: integrationId, sharedWithUserId: userId });
    });
  };

  const handleUnshare = (userId: string) => {
    startTransition(async () => {
      await unshareCalendar({ calendarIntegrationId: integrationId, sharedWithUserId: userId });
    });
  };

  // --- Shared-with-me: read-only mode ---
  if (isSharedWithMe) {
    return (
      <div className="p-4">
        <div className="mb-4 space-y-2 rounded-lg bg-gray-50 p-3">
          <div>
            <span className="text-[10px] font-medium text-gray-400">{t("label")}</span>
            <p className="text-xs text-gray-700">{integration?.label ?? integrationLabel}</p>
          </div>
          <div>
            <span className="text-[10px] font-medium text-gray-400">{t("provider")}</span>
            <p className="text-xs text-gray-700">
              {integration?.provider ? t(integration.provider as "google" | "outlook" | "apple" | "other") : "—"}
            </p>
          </div>
          {/* Color (read-only) */}
          {integration?.color && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-gray-400">{t("color")}</span>
              <span
                className="inline-block h-4 w-4 rounded-full"
                style={{ backgroundColor: integration.color }}
              />
            </div>
          )}
        </div>
        {/* Shared by badge */}
        <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2">
          <p className="text-xs text-cyan-700">
            {t("sharedBy", { name: integration?.ownerName ?? "" })}
          </p>
        </div>
      </div>
    );
  }

  // --- Owner mode: full editing + sharing ---
  const sharedWithUserIds = new Set(integration?.sharedWithUserIds ?? []);
  const otherUsers = allUsers.filter((u) => u.id !== currentUserId);
  const filteredUsers = otherUsers.filter((u) =>
    u.name.toLowerCase().includes(shareSearch.toLowerCase())
  );

  return (
    <div className="p-4">
      <div className="mb-4 space-y-2 rounded-lg bg-gray-50 p-3">
        <EditableField
          label={t("label")}
          value={nameValue}
          editing={editingName}
          onEdit={() => setEditingName(true)}
          onChange={setNameValue}
          onSave={() => {
            if (nameValue.trim()) {
              handleSave("label", nameValue.trim());
            }
            setEditingName(false);
          }}
          onCancel={() => setEditingName(false)}
          canManage={true}
          isPending={isPending}
          inputWidth="w-28"
        />

        {/* Provider (read-only) */}
        <div>
          <span className="text-[10px] font-medium text-gray-400">{t("provider")}</span>
          <p className="text-xs text-gray-700">
            {integration?.provider ? t(integration.provider as "google" | "outlook" | "apple" | "other") : "—"}
          </p>
        </div>

        {/* Toggle enabled */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-gray-400">
            {integration?.isEnabled ? t("enabled") : t("disabled")}
          </span>
          <button
            type="button"
            onClick={handleToggle}
            disabled={isPending}
            className={`relative h-5 w-9 rounded-full transition-colors ${
              integration?.isEnabled ? "bg-cyan-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                integration?.isEnabled ? "left-[18px]" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Color picker */}
      <div className="mb-4">
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          {t("color")}
        </label>
        <div className="flex gap-2">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => handleSave("color", c)}
              className={`h-6 w-6 rounded-full border-2 transition-all ${
                integration?.color === c ? "border-gray-900 scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Sharing section */}
      <div className="mb-4">
        <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          <Users size={12} weight="fill" />
          {t("shareSection")}
        </label>

        {/* Search bar */}
        <div className="relative mb-2">
          <MagnifyingGlass
            size={14}
            weight="fill"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder={t("searchCollaborators")}
            value={shareSearch}
            onChange={(e) => setShareSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-xs text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
          />
        </div>

        {/* User list */}
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {filteredUsers.map((user) => {
            const isShared = sharedWithUserIds.has(user.id);

            return (
              <div
                key={user.id}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5"
              >
                <UserAvatar name={user.name} image={user.image} size={22} />
                <span className="flex-1 truncate text-xs text-gray-700">
                  {user.name}
                </span>

                {isShared ? (
                  <button
                    onClick={() => handleUnshare(user.id)}
                    disabled={isPending}
                    className="flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                  >
                    <XIcon size={10} weight="bold" />
                    {t("unshare")}
                  </button>
                ) : (
                  <button
                    onClick={() => handleShare(user.id)}
                    disabled={isPending}
                    className="rounded bg-cyan-50 px-2 py-0.5 text-[10px] font-medium text-cyan-600 transition-colors hover:bg-cyan-100 disabled:opacity-50"
                  >
                    {isPending ? "..." : t("share")}
                  </button>
                )}
              </div>
            );
          })}

          {filteredUsers.length === 0 && (
            <p className="py-2 text-center text-[10px] text-gray-400">
              {sharedWithUserIds.size === 0 ? t("onlyYou") : "—"}
            </p>
          )}
        </div>
      </div>

      {/* Delete button */}
      {!showConfirm && (
        <button
          onClick={() => setShowConfirm(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
        >
          <Trash size={14} weight="fill" />
          {t("deleteCalendar")}
        </button>
      )}

      {showConfirm && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="mb-3 text-xs text-red-700">{t("confirmDeleteMessage")}</p>
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
