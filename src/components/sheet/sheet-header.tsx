"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { CaretLeft, CaretRight, CalendarBlank, Plus, SignOut, PencilSimple, Check, UserCircle } from "@phosphor-icons/react";
import { signOut } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
import { getDateLocale } from "@/i18n/date-locale";
import type { DisplayMode, SheetFilters, ClientInfo, ProjectInfo, UserInfo } from "@/types";
import type { OrgRole } from "@/lib/auth-context";
import { FilterDropdown } from "./filter-dropdown";
import { ActiveUsers } from "./active-users";
import { KllappLogo } from "@/components/ui/kllapp-logo";
import { UserAvatar } from "@/components/ui/user-avatar";
import { OrgSwitcher } from "@/components/ui/org-switcher";
import { updateOrganization } from "@/components/ui/org-switcher-actions";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";

interface SheetHeaderProps {
  year: number;
  activeMonth: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  onTodayClick: () => void;
  onAddClient?: () => void;
  onAddUser?: () => void;
  onAddAbsenceClient?: () => void;
  onAddCalendar?: () => void;
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
  userName?: string;
  userImage?: string | null;
  currentOrgId?: string;
  currentOrgName?: string;
  userOrganizations?: { id: string; name: string }[];
  userRole?: OrgRole;
  pendingInvitations?: Array<{
    membershipId: string;
    orgId: string;
    orgName: string;
    role: string | null;
    invitedAt: Date | null;
  }>;
  allClients?: ClientInfo[];
  allProjects?: ProjectInfo[];
  allUsers?: UserInfo[];
  filters?: SheetFilters;
  onFiltersChange?: (filters: SheetFilters) => void;
  followingUserId?: string | null;
  onFollowUser?: (userId: string | null) => void;
  availabilityUserId?: string | null;
  onAvailabilityUserChange?: (userId: string | null) => void;
}

export function SheetHeader({
  year,
  activeMonth,
  onMonthChange,
  onYearChange,
  onTodayClick,
  onAddClient,
  onAddUser,
  onAddAbsenceClient,
  onAddCalendar,
  displayMode,
  onDisplayModeChange,
  userName,
  userImage,
  currentOrgId,
  currentOrgName,
  userOrganizations,
  userRole,
  pendingInvitations,
  allClients,
  allProjects,
  allUsers,
  filters,
  onFiltersChange,
  followingUserId,
  onFollowUser,
  availabilityUserId,
  onAvailabilityUserChange,
}: SheetHeaderProps) {
  const t = useTranslations("header");
  const tGrid = useTranslations("grid");
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const months = Array.from({ length: 12 }, (_, i) =>
    format(new Date(2026, i, 1), "MMM", { locale: dateLocale })
  );
  const now = new Date();
  const currentMonthIdx = now.getMonth();
  const isCurrentYear = year === now.getFullYear();
  return (
    <div className="relative z-10 border-b border-gray-100 bg-white">
      {/* Top row: controls */}
      <div className="flex items-center justify-between px-5 pt-3 pb-2">
        {/* Left: Logo + Year selector + Today */}
        <div className="flex shrink-0 items-center gap-3">
          <KllappLogo className="h-5 w-auto" />

          <div className="mx-1 h-5 w-px bg-gray-200" />

          <button
            onClick={() => onYearChange(year - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <CaretLeft size={16} weight="fill" />
          </button>
          <h1 className="min-w-[52px] text-center text-lg font-semibold tabular-nums text-gray-900">
            {year}
          </h1>
          <button
            onClick={() => onYearChange(year + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <CaretRight size={16} weight="fill" />
          </button>

          <div className="mx-1 h-5 w-px bg-gray-200" />

          <button
            onClick={onTodayClick}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            <CalendarBlank size={14} weight="fill" />
            {t("today")}
          </button>
        </div>

        {/* Right: Display mode toggle + Action buttons + Profile */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg bg-gray-50 p-0.5">
            <button
              onClick={() => onDisplayModeChange("days")}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                displayMode === "days"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {t("days")}
            </button>
            <button
              onClick={() => onDisplayModeChange("hours")}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                displayMode === "hours"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {t("hours")}
            </button>
          </div>

          {allClients && allProjects && allUsers && filters && onFiltersChange && (
            <>
              <div className="mx-0.5 h-5 w-px bg-gray-200" />
              <FilterDropdown
                allClients={allClients}
                allProjects={allProjects}
                allUsers={allUsers}
                filters={filters}
                onFiltersChange={onFiltersChange}
              />
            </>
          )}

          <div className="mx-0.5 h-5 w-px bg-gray-200" />
          {(onAddUser || onAddClient || onAddAbsenceClient || onAddCalendar) && (
            <AddDropdown onAddUser={onAddUser} onAddClient={onAddClient} onAddAbsenceClient={onAddAbsenceClient} onAddCalendar={onAddCalendar} />
          )}

          {allUsers && allUsers.length > 0 && onAvailabilityUserChange && (
            <AvailabilityDropdown
              allUsers={allUsers}
              availabilityUserId={availabilityUserId}
              onSelect={onAvailabilityUserChange}
            />
          )}

          <ActiveUsers followingUserId={followingUserId} onFollowUser={onFollowUser} />

          <div className="ml-1 h-5 w-px bg-gray-200" />

          {currentOrgId && currentOrgName && userOrganizations && (
            <>
              <OrgSwitcher
                currentOrgId={currentOrgId}
                currentOrgName={currentOrgName}
                organizations={userOrganizations}
                pendingInvitations={pendingInvitations}
                userRole={userRole}
              />
              <div className="h-5 w-px bg-gray-200" />
            </>
          )}

          <ProfileMenu
            userName={userName}
            userImage={userImage}
            orgName={currentOrgName}
            userRole={userRole}
          />
        </div>
      </div>

      {/* Bottom row: Month tabs */}
      <div className="flex items-center justify-center px-5 pb-2">
        <div className="flex items-center gap-0.5 rounded-xl bg-gray-50 p-1">
          {months.map((label, idx) => {
            const isActive = idx === activeMonth;
            const isCurrent = isCurrentYear && idx === currentMonthIdx;
            return (
              <button
                key={idx}
                onClick={() => onMonthChange(idx)}
                className={`relative shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-medium capitalize transition-all ${
                  isActive
                    ? "bg-white text-gray-900 shadow-sm"
                    : isCurrent
                      ? "font-semibold text-gray-900 hover:text-gray-900"
                      : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {label}
                {isCurrent && !isActive && (
                  <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-gray-900" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AddDropdown({
  onAddUser,
  onAddClient,
  onAddAbsenceClient,
  onAddCalendar,
}: {
  onAddUser?: () => void;
  onAddClient?: () => void;
  onAddAbsenceClient?: () => void;
  onAddCalendar?: () => void;
}) {
  const t = useTranslations("header");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50"
      >
        <Plus size={16} weight="fill" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {onAddUser && (
            <button
              onClick={() => { onAddUser(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <Plus size={14} weight="fill" />
              {t("collaborator")}
            </button>
          )}
          {onAddClient && (
            <button
              onClick={() => { onAddClient(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <Plus size={14} weight="fill" />
              {t("client")}
            </button>
          )}
          {onAddAbsenceClient && (
            <>
              <div className="mx-2 my-1 border-t border-gray-100" />
              <button
                onClick={() => { onAddAbsenceClient(); setOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
              >
                <Plus size={14} weight="fill" />
                {t("absenceCategory")}
              </button>
            </>
          )}
          {onAddCalendar && (
            <>
              <div className="mx-2 my-1 border-t border-gray-100" />
              <button
                onClick={() => { onAddCalendar(); setOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-cyan-600 transition-colors hover:bg-cyan-50 hover:text-cyan-700"
              >
                <Plus size={14} weight="fill" />
                {t("addCalendar")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ProfileMenu({
  userName,
  userImage,
  orgName,
  userRole,
}: {
  userName?: string;
  userImage?: string | null;
  orgName?: string;
  userRole?: OrgRole;
}) {
  const t = useTranslations("header");
  const tAuth = useTranslations("auth");
  const [open, setOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState(false);
  const [orgNameValue, setOrgNameValue] = useState(orgName ?? "");
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const canManage = userRole === "admin" || userRole === "manager";

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setEditingOrg(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleSaveOrg = () => {
    if (!orgNameValue.trim()) return;
    startTransition(async () => {
      await updateOrganization({ name: orgNameValue.trim() });
      setEditingOrg(false);
    });
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-full p-0.5 transition-colors hover:bg-gray-50"
      >
        <UserAvatar name={userName ?? t("user")} image={userImage} size={28} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {/* User info */}
          <div className="border-b border-gray-100 px-3 py-2.5">
            <p className="text-xs font-medium text-gray-900">{userName ?? t("user")}</p>
          </div>

          {/* Organisation section */}
          {orgName && (
            <div className="border-b border-gray-100 px-3 py-2.5">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">{t("organization")}</p>
              {editingOrg && canManage ? (
                <div className="flex items-center gap-1">
                  <input
                    value={orgNameValue}
                    onChange={(e) => setOrgNameValue(e.target.value)}
                    className="flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 outline-none focus:border-gray-400"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveOrg();
                      if (e.key === "Escape") { setEditingOrg(false); setOrgNameValue(orgName); }
                    }}
                  />
                  <button
                    onClick={handleSaveOrg}
                    disabled={isPending || !orgNameValue.trim()}
                    className="rounded bg-gray-900 p-1 text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    <Check size={12} weight="fill" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">{orgNameValue || orgName}</span>
                  {canManage && (
                    <button
                      onClick={() => setEditingOrg(true)}
                      className="rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                      title={t("rename")}
                    >
                      <PencilSimple size={12} weight="fill" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Locale switcher */}
          <div className="border-b border-gray-100 px-3 py-2">
            <LocaleSwitcher />
          </div>

          {/* Sign out */}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            <SignOut size={14} weight="fill" />
            {tAuth("logout")}
          </button>
        </div>
      )}
    </div>
  );
}

function AvailabilityDropdown({
  allUsers,
  availabilityUserId,
  onSelect,
}: {
  allUsers: UserInfo[];
  availabilityUserId?: string | null;
  onSelect: (userId: string | null) => void;
}) {
  const tGrid = useTranslations("grid");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selectedUser = availabilityUserId ? allUsers.find((u) => u.id === availabilityUserId) : null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
          availabilityUserId
            ? "border-emerald-200 bg-emerald-50 text-emerald-600"
            : "border-gray-200 text-gray-600 hover:bg-gray-50"
        }`}
        title={selectedUser ? selectedUser.name : tGrid("availabilityOff")}
      >
        <UserCircle size={16} weight={availabilityUserId ? "fill" : "regular"} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          <button
            onClick={() => { onSelect(null); setOpen(false); }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors ${
              !availabilityUserId ? "bg-gray-50 font-medium text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            {tGrid("availabilityOff")}
          </button>
          <div className="mx-2 my-1 border-t border-gray-100" />
          {allUsers.map((u) => (
            <button
              key={u.id}
              onClick={() => { onSelect(u.id); setOpen(false); }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors ${
                availabilityUserId === u.id ? "bg-emerald-50 font-medium text-emerald-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <UserAvatar name={u.name} image={u.image} size={18} />
              {u.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
