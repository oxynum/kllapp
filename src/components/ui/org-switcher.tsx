"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { CaretDown, Check, X, Plus, GearSix } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  switchOrganization,
  createOrganizationFromDashboard,
  acceptInvitationFromDashboard,
  declineInvitationFromDashboard,
} from "./org-switcher-actions";

interface OrgOption {
  id: string;
  name: string;
}

interface PendingInvitation {
  membershipId: string;
  orgId: string;
  orgName: string;
  role: string | null;
  invitedAt: Date | null;
}

interface OrgSwitcherProps {
  currentOrgId: string;
  currentOrgName: string;
  organizations: OrgOption[];
  pendingInvitations?: PendingInvitation[];
  userRole?: string;
}

export function OrgSwitcher({
  currentOrgId,
  currentOrgName,
  organizations,
  pendingInvitations = [],
  userRole,
}: OrgSwitcherProps) {
  const t = useTranslations("orgSwitcher");
  const tCommon = useTranslations("common");
  const tRoles = useTranslations("enums.role");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const canManage = userRole === "admin" || userRole === "manager";
  const hasInvitations = pendingInvitations.length > 0;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreateForm(false);
        setNewOrgName("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (showCreateForm && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showCreateForm]);

  const handleSwitch = (orgId: string) => {
    if (orgId === currentOrgId) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      await switchOrganization(orgId);
      setOpen(false);
    });
  };

  const handleCreate = () => {
    if (!newOrgName.trim()) return;
    const formData = new FormData();
    formData.set("name", newOrgName.trim());
    startTransition(async () => {
      await createOrganizationFromDashboard(formData);
      setOpen(false);
      setShowCreateForm(false);
      setNewOrgName("");
    });
  };

  const handleAccept = (membershipId: string) => {
    startTransition(async () => {
      await acceptInvitationFromDashboard(membershipId);
      setOpen(false);
    });
  };

  const handleDecline = (membershipId: string) => {
    startTransition(async () => {
      await declineInvitationFromDashboard(membershipId);
    });
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
        disabled={isPending}
      >
        <span className="truncate max-w-[100px]">{currentOrgName}</span>
        {hasInvitations && (
          <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white">
            {pendingInvitations.length}
          </span>
        )}
        <CaretDown size={12} weight="fill" className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[220px] rounded-lg border border-gray-200 bg-white shadow-lg">
          {/* Active organizations */}
          <div className="py-1">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSwitch(org.id)}
                className={`flex w-full items-center px-3 py-1.5 text-left text-xs transition-colors hover:bg-gray-50 ${
                  org.id === currentOrgId ? "font-medium text-gray-900" : "text-gray-600"
                }`}
              >
                <span className="truncate">{org.name}</span>
                {org.id === currentOrgId && (
                  <Check size={12} weight="bold" className="ml-auto shrink-0 text-gray-400" />
                )}
              </button>
            ))}
          </div>

          {/* Pending invitations */}
          {hasInvitations && (
            <div className="border-t border-gray-100 py-1">
              <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                {t("pendingInvitations")} ({pendingInvitations.length})
              </p>
              {pendingInvitations.map((inv) => (
                <div key={inv.membershipId} className="flex items-center justify-between px-3 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-gray-700">{inv.orgName}</p>
                    {inv.role && (
                      <p className="text-[10px] text-gray-400">
                        {tRoles(inv.role as "admin" | "manager" | "collaborator")}
                      </p>
                    )}
                  </div>
                  <div className="ml-2 flex items-center gap-1">
                    <button
                      onClick={() => handleAccept(inv.membershipId)}
                      disabled={isPending}
                      className="rounded bg-gray-900 p-1 text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                      title={t("accept")}
                    >
                      <Check size={10} weight="bold" />
                    </button>
                    <button
                      onClick={() => handleDecline(inv.membershipId)}
                      disabled={isPending}
                      className="rounded bg-gray-100 p-1 text-gray-500 transition-colors hover:bg-gray-200 disabled:opacity-50"
                      title={t("decline")}
                    >
                      <X size={10} weight="bold" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create new org */}
          <div className="border-t border-gray-100 py-1">
            {showCreateForm ? (
              <div className="px-3 py-1.5">
                <input
                  ref={inputRef}
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder={t("orgNamePlaceholder")}
                  className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 outline-none focus:border-gray-400"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") { setShowCreateForm(false); setNewOrgName(""); }
                  }}
                  disabled={isPending}
                />
                <div className="mt-1.5 flex items-center justify-end gap-1">
                  <button
                    onClick={() => { setShowCreateForm(false); setNewOrgName(""); }}
                    className="rounded px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-100"
                    disabled={isPending}
                  >
                    {tCommon("cancel")}
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={isPending || !newOrgName.trim()}
                    className="rounded bg-gray-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {isPending ? t("creating") : t("create")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50"
              >
                <Plus size={12} weight="bold" />
                {t("newOrg")}
              </button>
            )}
          </div>

          {/* Settings link */}
          {canManage && (
            <div className="border-t border-gray-100 py-1">
              <button
                onClick={() => { router.push("/settings"); setOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50"
              >
                <GearSix size={12} weight="fill" />
                {t("settings")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
