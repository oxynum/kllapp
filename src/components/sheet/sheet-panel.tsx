"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { X } from "@phosphor-icons/react";
import type { PanelMode, SheetRow, UserInfo, ClientInfo, AssignmentInfo, ProjectInfo, DependencyInfo, CalendarIntegrationInfo, CalendarEventInfo, ExpenseData } from "@/types";
import type { OrgRole } from "@/lib/auth-context";
import { AssignUserPanel } from "./panel/assign-user-panel";
import { AddProjectPanel } from "./panel/add-project-panel";
import { AddClientPanel } from "./panel/add-client-panel";
import { UserDetailPanel } from "./panel/user-detail-panel";
import { AddUserPanel } from "./panel/add-user-panel";
import { AddSubProjectPanel } from "./panel/add-sub-project-panel";
import { ProjectDetailPanel } from "./panel/project-detail-panel";
import { ClientDetailPanel } from "./panel/client-detail-panel";
import { AddAbsenceClientPanel } from "./panel/add-absence-client-panel";
import { AddAbsenceTypePanel } from "./panel/add-absence-type-panel";
import { AbsenceClientDetailPanel } from "./panel/absence-client-detail-panel";
import { AbsenceTypeDetailPanel } from "./panel/absence-type-detail-panel";
import { AddCalendarPanel } from "./panel/add-calendar-panel";
import { CalendarDetailPanel } from "./panel/calendar-detail-panel";
import { CalendarEventsPanel, CalendarEventDetail } from "./panel/calendar-events-panel";
// DeskBookingPanel is rendered as a fullscreen overlay in SheetWorkspace, not here
import { ProjectFinancePanel } from "./panel/project-finance-panel";

interface SheetPanelProps {
  panelState: PanelMode;
  onClose: () => void;
  onOpenAssignUser?: (projectId: string, projectName: string, clientName: string) => void;
  allUsers: UserInfo[];
  allClients: ClientInfo[];
  allAssignments: AssignmentInfo[];
  allProjects: ProjectInfo[];
  allDependencies: DependencyInfo[];
  allCalendarIntegrations: CalendarIntegrationInfo[];
  rows: SheetRow[];
  cells?: Record<string, import("@/lib/db/queries/sheet-data").CellData>;
  expenseMap?: Record<string, ExpenseData[]>;
  currentUserId: string;
  userRole?: OrgRole;
}

const PANEL_TITLE_KEYS: Record<string, string> = {
  "assign-user": "assignUser",
  "add-project": "newProject",
  "add-client": "newClient",
  "user-detail": "userDetail",
  "add-user": "newUser",
  "add-sub-project": "newSubProject",
  "project-detail": "projectDetail",
  "client-detail": "clientDetail",
  "add-absence-client": "newAbsenceClient",
  "add-absence-type": "newAbsenceType",
  "assign-absence-user": "assignAbsenceUser",
  "absence-client-detail": "absenceClientDetail",
  "absence-type-detail": "absenceTypeDetail",
  "add-calendar": "addCalendar",
  "calendar-detail": "calendarDetail",
  "calendar-events": "calendarEvents",
  "desk-booking": "deskBooking",
};

export function SheetPanel({
  panelState,
  onClose,
  onOpenAssignUser,
  allUsers,
  allClients,
  allAssignments,
  allProjects,
  allDependencies,
  allCalendarIntegrations,
  rows,
  cells,
  expenseMap,
  currentUserId,
  userRole,
}: SheetPanelProps) {
  const t = useTranslations("panel");

  // ─── Fold-out detail state for calendar events ───────────
  // Reset when panel type changes by tracking the type that "owns" the current detail
  const [detailState, setDetailState] = useState<{ panelType: string; event: CalendarEventInfo | null }>({
    panelType: panelState.type,
    event: null,
  });
  const detailEvent = detailState.panelType === panelState.type ? detailState.event : null;

  const handleEventSelect = useCallback((event: CalendarEventInfo | null) => {
    setDetailState({ panelType: panelState.type, event });
  }, [panelState.type]);

  const calendarColor = panelState.type === "calendar-events"
    ? allCalendarIntegrations.find((c) => c.id === panelState.integrationId)?.color
    : null;

  const hasDetail = !!detailEvent && panelState.type === "calendar-events";

  // Finance fold-out state — reset when panel type changes (derived state pattern)
  const [financeState, setFinanceState] = useState<{ panelType: string; open: boolean }>({ panelType: panelState.type, open: false });
  const showFinances = financeState.panelType === panelState.type && financeState.open;
  const setShowFinances = (open: boolean) => setFinanceState({ panelType: panelState.type, open });
  const hasFinanceDetail = showFinances && panelState.type === "project-detail";

  // Desk booking is rendered as fullscreen overlay, not in this panel
  const isOpen = panelState.type !== "closed" && panelState.type !== "desk-booking";

  // Width: 280px normally, 540px when any fold-out is open
  const hasFoldOut = hasDetail || hasFinanceDetail;
  // Calendar detail = 260px, finance detail = 340px (wider for readability)
  const foldOutWidth = hasFinanceDetail ? "w-[620px]" : hasDetail ? "w-[540px]" : "w-[280px]";
  const widthClass = isOpen ? foldOutWidth : "w-0 border-l-0";

  return (
    <div
      className={`flex-shrink-0 overflow-hidden border-l border-gray-100 bg-white transition-all duration-300 ease-in-out ${widthClass}`}
    >
      {isOpen && (
        <div className="flex h-full">
          {/* ─── Main panel (left) ─── */}
          <div className="flex h-full w-[280px] flex-shrink-0 flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {PANEL_TITLE_KEYS[panelState.type] ? t(PANEL_TITLE_KEYS[panelState.type] as any) : ""}
              </h2>
              <button
                onClick={onClose}
                className="flex h-6 w-6 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={16} weight="fill" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {panelState.type === "assign-user" && (
                <AssignUserPanel
                  projectId={panelState.projectId}
                  projectName={panelState.projectName}
                  clientName={panelState.clientName}
                  allUsers={allUsers}
                  allAssignments={allAssignments}
                  onClose={onClose}
                />
              )}
              {panelState.type === "add-project" && (
                <AddProjectPanel
                  clientId={panelState.clientId}
                  clientName={panelState.clientName}
                  onClose={onClose}
                />
              )}
              {panelState.type === "add-client" && (
                <AddClientPanel onClose={onClose} />
              )}
              {panelState.type === "user-detail" && (
                <UserDetailPanel
                  key={`${panelState.userId}:${panelState.projectId}`}
                  userId={panelState.userId}
                  projectId={panelState.projectId}
                  userName={panelState.userName}
                  allUsers={allUsers}
                  allAssignments={allAssignments}
                  rows={rows}
                  onClose={onClose}
                  userRole={userRole}
                />
              )}
              {panelState.type === "add-user" && (
                <AddUserPanel onClose={onClose} />
              )}
              {panelState.type === "add-sub-project" && (
                <AddSubProjectPanel
                  projectId={panelState.projectId}
                  projectName={panelState.projectName}
                  clientName={panelState.clientName}
                  allProjects={allProjects}
                  onClose={onClose}
                />
              )}
              {panelState.type === "project-detail" && (
                <ProjectDetailPanel
                  projectId={panelState.projectId}
                  projectName={panelState.projectName}
                  clientName={panelState.clientName}
                  allProjects={allProjects}
                  allDependencies={allDependencies}
                  onClose={onClose}
                  onOpenAssignUser={onOpenAssignUser}
                  userRole={userRole}
                  onShowFinances={() => setShowFinances(!showFinances)}
                  showFinances={showFinances}
                />
              )}
              {panelState.type === "client-detail" && (
                <ClientDetailPanel
                  clientId={panelState.clientId}
                  clientName={panelState.clientName}
                  allClients={allClients}
                  allProjects={allProjects}
                  onClose={onClose}
                  userRole={userRole}
                />
              )}
              {panelState.type === "add-absence-client" && (
                <AddAbsenceClientPanel onClose={onClose} />
              )}
              {panelState.type === "add-absence-type" && (
                <AddAbsenceTypePanel
                  clientId={panelState.clientId}
                  clientName={panelState.clientName}
                  onClose={onClose}
                />
              )}
              {panelState.type === "assign-absence-user" && (
                <AssignUserPanel
                  projectId={panelState.projectId}
                  projectName={panelState.projectName}
                  clientName={panelState.clientName}
                  allUsers={allUsers}
                  allAssignments={allAssignments}
                  onClose={onClose}
                />
              )}
              {panelState.type === "absence-client-detail" && (
                <AbsenceClientDetailPanel
                  clientId={panelState.clientId}
                  clientName={panelState.clientName}
                  allClients={allClients}
                  allProjects={allProjects}
                  onClose={onClose}
                  userRole={userRole}
                />
              )}
              {panelState.type === "absence-type-detail" && (
                <AbsenceTypeDetailPanel
                  projectId={panelState.projectId}
                  projectName={panelState.projectName}
                  clientName={panelState.clientName}
                  allProjects={allProjects}
                  onClose={onClose}
                  onOpenAssignUser={onOpenAssignUser}
                  userRole={userRole}
                />
              )}
              {panelState.type === "add-calendar" && (
                <AddCalendarPanel onClose={onClose} />
              )}
              {panelState.type === "calendar-detail" && (
                <CalendarDetailPanel
                  integrationId={panelState.integrationId}
                  integrationLabel={panelState.integrationLabel}
                  allCalendarIntegrations={allCalendarIntegrations}
                  allUsers={allUsers}
                  currentUserId={currentUserId}
                  onClose={onClose}
                />
              )}
              {panelState.type === "calendar-events" && (
                <CalendarEventsPanel
                  integrationId={panelState.integrationId}
                  integrationLabel={panelState.integrationLabel}
                  date={panelState.date}
                  color={calendarColor}
                  onClose={onClose}
                  onEventSelect={handleEventSelect}
                />
              )}
            </div>
          </div>

          {/* ─── Detail fold-out panel (right) ─── */}
          {hasDetail && detailEvent && (
            <div className="w-[260px] flex-shrink-0 border-l border-gray-100 bg-white">
              <CalendarEventDetail
                event={detailEvent}
                color={calendarColor}
                onClose={() => setDetailState(s => ({ ...s, event: null }))}
              />
            </div>
          )}

          {/* ─── Finance fold-out panel (right) ─── */}
          {hasFinanceDetail && panelState.type === "project-detail" && cells && (
            <div className="flex w-[340px] flex-shrink-0 flex-col border-l border-gray-100 bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <h3 className="text-xs font-semibold text-gray-900">{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {t("finances" as any)}</h3>
                <button onClick={() => setShowFinances(false)} className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                  <X size={14} />
                </button>
              </div>
              <ProjectFinancePanel
                projectId={panelState.projectId}
                rows={rows}
                cells={cells}
                allProjects={allProjects}
                allUsers={allUsers}
                expenseMap={expenseMap}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
