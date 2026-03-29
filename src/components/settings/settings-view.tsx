"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CaretLeft,
  PencilSimple,
  Check,
  Warning,
  SignOut,
  Trash,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { updateOrganization } from "@/components/ui/org-switcher-actions";
import { updateMemberRole, leaveOrganization, deleteOrganization } from "@/app/(dashboard)/settings/actions";
import { sendInvitation } from "@/app/(dashboard)/team/actions";

interface SettingsViewProps {
  org: {
    id: string;
    name: string;
    slug: string;
    createdAt: Date | null;
    updatedAt: Date | null;
  };
  members: Array<{
    id: string;
    userId: string | null;
    email: string;
    role: "admin" | "manager" | "collaborator" | null;
    isOwner: boolean | null;
    status: "pending" | "active" | "declined" | null;
    joinedAt: Date | null;
    userName: string | null;
  }>;
  currentUserRole: string;
  isCurrentUserOwner: boolean;
  currentUserId: string;
}

export function SettingsView({
  org,
  members,
  currentUserRole,
  isCurrentUserOwner,
  currentUserId,
}: SettingsViewProps) {
  const t = useTranslations("settings");
  const tRole = useTranslations("enums.role");
  const router = useRouter();
  const canManage = currentUserRole === "admin" || currentUserRole === "manager";

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      {/* Header with back button */}
      <div className="mb-8 flex items-center gap-3">
        <button
          onClick={() => router.push("/")}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <CaretLeft size={18} weight="bold" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">{t("title")}</h1>
      </div>

      {/* Organization name section */}
      <OrgNameSection
        orgName={org.name}
        orgSlug={org.slug}
        canManage={canManage}
        t={t}
      />

      {/* Members section */}
      <MembersSection
        members={members}
        canManage={canManage}
        isCurrentUserOwner={isCurrentUserOwner}
        currentUserId={currentUserId}
        t={t}
        tRole={tRole}
      />

      {/* Danger zone */}
      <DangerZoneSection
        isCurrentUserOwner={isCurrentUserOwner}
        t={t}
      />
    </div>
  );
}

// ============================================================
// Organization name section
// ============================================================

function OrgNameSection({
  orgName,
  orgSlug,
  canManage,
  t,
}: {
  orgName: string;
  orgSlug: string;
  canManage: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(orgName);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      await updateOrganization({ name: name.trim() });
      setEditing(false);
    });
  };

  return (
    <section className="mb-8 rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-1 flex items-center gap-2">
        <label className="text-xs font-medium text-gray-500">{t("orgName")}</label>
      </div>
      {editing && canManage ? (
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-400"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") {
                setEditing(false);
                setName(orgName);
              }
            }}
          />
          <button
            onClick={handleSave}
            disabled={isPending || !name.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            <Check size={14} weight="bold" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900">{name}</span>
          {canManage && (
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <PencilSimple size={14} weight="bold" />
            </button>
          )}
        </div>
      )}
      <p className="mt-2 text-xs text-gray-400">{t("slug")}: {orgSlug}</p>
    </section>
  );
}

// ============================================================
// Members section
// ============================================================

function MembersSection({
  members,
  canManage,
  isCurrentUserOwner,
  currentUserId,
  t,
  tRole,
}: {
  members: SettingsViewProps["members"];
  canManage: boolean;
  isCurrentUserOwner: boolean;
  currentUserId: string;
  t: ReturnType<typeof useTranslations>;
  tRole: ReturnType<typeof useTranslations>;
}) {
  return (
    <section className="mb-8 rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{t("members")}</h2>
        <span className="text-xs text-gray-400">
          {t("memberCount", { count: members.length })}
        </span>
      </div>

      {/* Members list */}
      <div className="divide-y divide-gray-100">
        {members.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            canManage={canManage}
            currentUserId={currentUserId}
            t={t}
            tRole={tRole}
          />
        ))}
      </div>

      {/* Invite form */}
      {canManage && (
        <InviteForm t={t} />
      )}
    </section>
  );
}

function MemberRow({
  member,
  canManage,
  currentUserId,
  t,
  tRole,
}: {
  member: SettingsViewProps["members"][number];
  canManage: boolean;
  currentUserId: string;
  t: ReturnType<typeof useTranslations>;
  tRole: ReturnType<typeof useTranslations>;
}) {
  const [isPending, startTransition] = useTransition();
  const displayName = member.userName || member.email;
  const isMemberOwner = member.isOwner === true;
  const isPendingMember = member.status === "pending";
  const canChangeRole = canManage && !isMemberOwner && member.userId !== currentUserId;

  const handleRoleChange = (newRole: "admin" | "manager" | "collaborator") => {
    startTransition(async () => {
      await updateMemberRole({ membershipId: member.id, role: newRole });
    });
  };

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <UserAvatar name={displayName} size={28} />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-900">{displayName}</span>
            {isMemberOwner && (
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                {t("owner")}
              </span>
            )}
            {isPendingMember && (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                {t("pending")}
              </span>
            )}
          </div>
          {member.userName && (
            <p className="text-[11px] text-gray-400">{member.email}</p>
          )}
        </div>
      </div>

      {/* Role selector */}
      <div className="flex items-center gap-2">
        {canChangeRole ? (
          <select
            value={member.role ?? "collaborator"}
            onChange={(e) => handleRoleChange(e.target.value as "admin" | "manager" | "collaborator")}
            disabled={isPending}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 outline-none transition-colors hover:border-gray-300 focus:border-gray-400 disabled:opacity-50"
          >
            <option value="admin">{tRole("admin")}</option>
            <option value="manager">{tRole("manager")}</option>
            <option value="collaborator">{tRole("collaborator")}</option>
          </select>
        ) : (
          <span className="rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-500">
            {member.role ? tRole(member.role) : tRole("collaborator")}
          </span>
        )}
      </div>
    </div>
  );
}

function InviteForm({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim()) return;
    startTransition(async () => {
      await sendInvitation({ email: email.trim(), name: name.trim() });
      setEmail("");
      setName("");
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 border-t border-gray-100 pt-4">
      <p className="mb-3 text-xs font-medium text-gray-500">{t("inviteMember")}</p>
      <div className="flex items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          required
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 outline-none placeholder:text-gray-300 focus:border-gray-400"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("namePlaceholder")}
          required
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 outline-none placeholder:text-gray-300 focus:border-gray-400"
        />
        <button
          type="submit"
          disabled={isPending || !email.trim() || !name.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
        >
          <PaperPlaneTilt size={13} weight="bold" />
          {t("sendInvite")}
        </button>
      </div>
    </form>
  );
}

// ============================================================
// Danger zone section
// ============================================================

function DangerZoneSection({
  isCurrentUserOwner,
  t,
}: {
  isCurrentUserOwner: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isLeavePending, startLeaveTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();

  const handleLeave = () => {
    if (!confirmLeave) {
      setConfirmLeave(true);
      return;
    }
    startLeaveTransition(async () => {
      await leaveOrganization();
    });
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    startDeleteTransition(async () => {
      await deleteOrganization();
    });
  };

  return (
    <section className="rounded-lg border border-red-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-red-600">{t("dangerZone")}</h2>

      <div className="space-y-4">
        {/* Leave organization (not for owner) */}
        {!isCurrentUserOwner && (
          <div>
            {confirmLeave && (
              <div className="mb-2 flex items-start gap-2 rounded-lg bg-red-50 p-3">
                <Warning size={16} weight="bold" className="mt-0.5 shrink-0 text-red-500" />
                <p className="text-xs text-red-600">{t("leaveConfirm")}</p>
              </div>
            )}
            <button
              onClick={handleLeave}
              disabled={isLeavePending}
              className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              <SignOut size={14} weight="bold" />
              {isLeavePending ? t("leaving") : t("leaveOrg")}
            </button>
          </div>
        )}

        {/* Delete organization (owner only) */}
        {isCurrentUserOwner && (
          <div>
            {confirmDelete && (
              <div className="mb-2 flex items-start gap-2 rounded-lg bg-red-50 p-3">
                <Warning size={16} weight="bold" className="mt-0.5 shrink-0 text-red-500" />
                <p className="text-xs text-red-600">{t("deleteConfirm")}</p>
              </div>
            )}
            <button
              onClick={handleDelete}
              disabled={isDeletePending}
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
            >
              <Trash size={14} weight="bold" />
              {isDeletePending ? t("deleting") : t("deleteOrgButton")}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
