"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { MagnifyingGlass, Check } from "@phosphor-icons/react";
import { assignUser } from "@/app/(dashboard)/projects/actions";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { UserInfo, AssignmentInfo } from "@/types";

interface AssignUserPanelProps {
  projectId: string;
  projectName: string;
  clientName: string;
  allUsers: UserInfo[];
  allAssignments: AssignmentInfo[];
  onClose: () => void;
}

export function AssignUserPanel({
  projectId,
  projectName,
  clientName,
  allUsers,
  allAssignments,
  onClose,
}: AssignUserPanelProps) {
  const t = useTranslations("assignUser");
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const assignedUserIds = new Set(
    allAssignments
      .filter((a) => a.projectId === projectId)
      .map((a) => a.userId)
  );

  const filtered = allUsers.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAssign = (userId: string) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("userId", userId);
      await assignUser(formData);
    });
  };

  return (
    <div className="p-4">
      {/* Context */}
      <p className="mb-3 text-xs text-gray-500">
        {clientName} &rsaquo; {projectName}
      </p>

      {/* Search */}
      <div className="relative mb-3">
        <MagnifyingGlass
          size={14}
          weight="fill"
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          placeholder={t("search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-xs text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
        />
      </div>

      {/* User list */}
      <div className="space-y-1">
        {filtered.map((user) => {
          const isAssigned = assignedUserIds.has(user.id);

          return (
            <div
              key={user.id}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${
                isAssigned
                  ? "opacity-50"
                  : "cursor-pointer hover:bg-gray-50"
              }`}
            >
              {/* Avatar */}
              <UserAvatar name={user.name} image={user.image} size={24} />

              {/* Name */}
              <span className="flex-1 truncate text-xs text-gray-700">
                {user.name}
              </span>

              {/* Action */}
              {isAssigned ? (
                <span className="flex items-center gap-1 text-[10px] text-gray-400">
                  <Check size={12} weight="fill" />
                  {t("assigned")}
                </span>
              ) : (
                <button
                  onClick={() => handleAssign(user.id)}
                  disabled={isPending}
                  className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600 transition-colors hover:bg-indigo-100 disabled:opacity-50"
                >
                  {isPending ? "..." : t("assign")}
                </button>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="py-4 text-center text-xs text-gray-400">
            {t("noCollaborator")}
          </p>
        )}
      </div>
    </div>
  );
}
