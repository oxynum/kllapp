"use client";

import { CaretLeft, CaretRight, CalendarBlank } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import type { DisplayMode } from "@/types";
import type { OrgRole } from "@/lib/auth-context";
import { KllappLogo } from "@/components/ui/kllapp-logo";
import { UserAvatar } from "@/components/ui/user-avatar";
import { OrgSwitcher } from "@/components/ui/org-switcher";

interface MobileHeaderProps {
  weekLabel: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onTodayClick: () => void;
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
}

export function MobileHeader({
  weekLabel,
  onPrevWeek,
  onNextWeek,
  onTodayClick,
  displayMode,
  onDisplayModeChange,
  userName,
  userImage,
  currentOrgId,
  currentOrgName,
  userOrganizations,
  userRole,
  pendingInvitations,
}: MobileHeaderProps) {
  const t = useTranslations("header");

  return (
    <div className="border-b border-gray-100 bg-white px-3 py-2">
      {/* Row 1: Logo + Org + Avatar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KllappLogo className="h-4 w-auto" />
          {currentOrgId && currentOrgName && userOrganizations && (
            <OrgSwitcher
              currentOrgId={currentOrgId}
              currentOrgName={currentOrgName}
              organizations={userOrganizations}
              pendingInvitations={pendingInvitations}
              userRole={userRole}
            />
          )}
        </div>
        <UserAvatar name={userName ?? t("user")} image={userImage} size={28} />
      </div>

      {/* Row 2: Week navigation */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={onPrevWeek}
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 active:bg-gray-100"
          >
            <CaretLeft size={16} weight="fill" />
          </button>
          <span className="min-w-[140px] text-center text-sm font-medium text-gray-900">
            {weekLabel}
          </span>
          <button
            onClick={onNextWeek}
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 active:bg-gray-100"
          >
            <CaretRight size={16} weight="fill" />
          </button>
        </div>
        <button
          onClick={onTodayClick}
          className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-600 active:bg-gray-50"
        >
          <CalendarBlank size={12} weight="fill" />
          {t("today")}
        </button>
      </div>

      {/* Row 3: Display mode toggle */}
      <div className="mt-2 flex items-center justify-center">
        <div className="flex items-center gap-0.5 rounded-lg bg-gray-50 p-0.5">
          <button
            onClick={() => onDisplayModeChange("days")}
            className={`rounded-md px-3 py-1 text-[11px] font-medium transition-all ${
              displayMode === "days"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-400"
            }`}
          >
            {t("days")}
          </button>
          <button
            onClick={() => onDisplayModeChange("hours")}
            className={`rounded-md px-3 py-1 text-[11px] font-medium transition-all ${
              displayMode === "hours"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-400"
            }`}
          >
            {t("hours")}
          </button>
        </div>
      </div>
    </div>
  );
}
