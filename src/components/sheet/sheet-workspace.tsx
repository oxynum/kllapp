"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChartBar } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useStorage, useMutation } from "@liveblocks/react/suspense";
import { LiveObject } from "@liveblocks/client";
import { getCalendarIndicators } from "@/app/(dashboard)/calendar/actions";
import { getExpensesAction } from "@/app/(dashboard)/sheet/actions";
import type { ExpenseData } from "@/types";
import { SheetDataGrid } from "./data-grid";
import { SheetPanel } from "./sheet-panel";
import { SummaryBar } from "./summary-bar";
import { MobileBottomSheet } from "./mobile-bottom-sheet";
import { useSheetPanel } from "./use-sheet-panel";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useWeekNavigation } from "@/hooks/use-week-navigation";
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
import { CalendarEventsPanel } from "./panel/calendar-events-panel";
import { DeskBookingPanel } from "./panel/desk-booking-panel";
import type { SheetRow, UserInfo, ClientInfo, AssignmentInfo, ProjectInfo, DependencyInfo, SheetFilters, CalendarIntegrationInfo, WorkplaceInfo } from "@/types";
import type { OrgRole } from "@/lib/auth-context";
import type { CellData } from "@/lib/db/queries/sheet-data";

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
};

interface SheetWorkspaceProps {
  rows: SheetRow[];
  year: number;
  allUsers: UserInfo[];
  allClients: ClientInfo[];
  allAssignments: AssignmentInfo[];
  allProjects: ProjectInfo[];
  allDependencies: DependencyInfo[];
  allCalendarIntegrations: CalendarIntegrationInfo[];
  allWorkplaces: WorkplaceInfo[];
  userWorkplaceMap: Record<string, string>;
  expenseCategories: { id: string; name: string }[];
  initialCells: Record<string, CellData>;
  userName: string;
  userImage?: string | null;
  currentOrgId?: string;
  currentOrgName?: string;
  userOrganizations?: { id: string; name: string }[];
  currentUserId: string;
  userRole?: OrgRole;
  pendingInvitations?: Array<{
    membershipId: string;
    orgId: string;
    orgName: string;
    role: string | null;
    invitedAt: Date | null;
  }>;
}

export function SheetWorkspace({
  rows,
  year,
  allUsers,
  allClients,
  allAssignments,
  allProjects,
  allDependencies,
  allCalendarIntegrations,
  allWorkplaces,
  userWorkplaceMap,
  expenseCategories,
  initialCells,
  userName,
  userImage,
  currentOrgId,
  currentOrgName,
  userOrganizations,
  currentUserId,
  userRole,
  pendingInvitations,
}: SheetWorkspaceProps) {
  const { isMobile } = useMediaQuery();
  const { weekDays, weekLabel, goToPrevWeek, goToNextWeek, goToToday } = useWeekNavigation();
  const t = useTranslations("panel");

  const {
    panelState,
    openAssignUser,
    openAddProject,
    openAddClient,
    openUserDetail,
    openAddUser,
    openAddSubProject,
    openProjectDetail,
    openClientDetail,
    openAddAbsenceClient,
    openAddAbsenceType,
    openAssignAbsenceUser,
    openAbsenceClientDetail,
    openAbsenceTypeDetail,
    openAddCalendar,
    openCalendarDetail,
    openCalendarEvents,
    openDeskBooking,
    closePanel,
    isOpen,
  } = useSheetPanel();

  const [profitSelection, setProfitSelection] = useState<{
    id: string;
    type: "project" | "client";
    label: string;
  } | null>(null);

  const [bottomBarVisible, setBottomBarVisible] = useState(true);

  // Initialize Liveblocks storage from DB data (only if room is empty)
  const initializeStorage = useMutation(({ storage }, dbCells: Record<string, CellData>) => {
    const liveCells = storage.get("cells");
    if (liveCells.size === 0) {
      for (const [key, data] of Object.entries(dbCells)) {
        liveCells.set(key, new LiveObject({ value: data.value, note: data.note }));
      }
    }
  }, []);

  useEffect(() => {
    initializeStorage(initialCells);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Read cells from Liveblocks storage (synced in real-time)
  const rawCells = useStorage((root) => {
    const result: Record<string, CellData> = {};
    root.cells.forEach((val, key) => {
      result[key] = { value: val.value, note: val.note };
    });
    return result;
  });
  const cells = rawCells ?? {};

  const updateCell = useMutation(({ storage }, cellKey: string, value: string, note?: string | null) => {
    const liveCells = storage.get("cells");
    if (value === "" || value === "0") {
      if (note === undefined) {
        liveCells.delete(cellKey);
      } else {
        liveCells.set(cellKey, new LiveObject({ value: "0", note: note || undefined }));
      }
    } else {
      const existing = liveCells.get(cellKey);
      liveCells.set(cellKey, new LiveObject({
        value,
        note: note !== undefined ? (note || undefined) : existing?.get("note"),
      }));
    }
  }, []);

  const updateNote = useMutation(({ storage }, cellKey: string, note: string | null) => {
    const liveCells = storage.get("cells");
    const existing = liveCells.get(cellKey);
    if (note) {
      liveCells.set(cellKey, new LiveObject({ value: existing?.get("value") ?? "0", note }));
    } else if (existing) {
      const currentValue = existing.get("value");
      if (currentValue === "0" || currentValue === "") {
        liveCells.delete(cellKey);
      } else {
        liveCells.set(cellKey, new LiveObject({ value: currentValue }));
      }
    }
  }, []);

  const handleSelectProfit = (id: string, type: "project" | "client", label: string) => {
    setProfitSelection({ id, type, label });
    setBottomBarVisible(true);
  };

  const [showMobileBottom, setShowMobileBottom] = useState(false);

  const [filters, setFilters] = useState<SheetFilters>({
    clientIds: new Set(),
    projectIds: new Set(),
    userIds: new Set(),
  });

  const filteredRows = useMemo(() => {
    const isFiltered =
      filters.clientIds.size > 0 ||
      filters.projectIds.size > 0 ||
      filters.userIds.size > 0;
    if (!isFiltered) return rows;

    // Extend projectIds to include child sub-projects
    const expandedProjectIds = new Set(filters.projectIds);
    if (filters.projectIds.size > 0) {
      for (const p of allProjects) {
        if (p.parentId && expandedProjectIds.has(p.parentId)) {
          expandedProjectIds.add(p.id);
        }
      }
    }

    // Pass 1: identify matching user rows (AND between dimensions, OR within)
    const matchedUserRowIds = new Set<string>();
    for (const r of rows) {
      if (r.type !== "user" && r.type !== "absence-user") continue;
      const clientOk =
        filters.clientIds.size === 0 || (r.clientId && filters.clientIds.has(r.clientId));
      const projectOk =
        expandedProjectIds.size === 0 ||
        (filters.projectIds.size === 0) ||
        (r.projectId && expandedProjectIds.has(r.projectId));
      const userOk =
        filters.userIds.size === 0 || (r.userId && filters.userIds.has(r.userId));
      if (clientOk && projectOk && userOk) {
        matchedUserRowIds.add(r.id);
      }
    }

    // Pass 2: collect ancestor IDs (project, sub-project, client parents)
    const keepIds = new Set(matchedUserRowIds);
    for (const r of rows) {
      if (!matchedUserRowIds.has(r.id)) continue;
      let parentId = r.parentId;
      while (parentId) {
        keepIds.add(parentId);
        const parent = rows.find((p) => p.id === parentId);
        parentId = parent?.parentId;
      }
    }

    // Pass 3: keep total rows tied to matched projects
    for (const r of rows) {
      if ((r.type === "total" || r.type === "absence-total") && r.projectId && keepIds.has(r.projectId)) {
        keepIds.add(r.id);
      }
    }

    // Always keep calendar rows and placeholders (personal, not filterable)
    for (const r of rows) {
      if (r.type === "calendar" || r.type === "add-calendar-placeholder") {
        keepIds.add(r.id);
      }
    }

    return rows.filter((r) => keepIds.has(r.id));
  }, [rows, filters, allProjects]);

  // Calendar indicators state
  const [calendarIndicators, setCalendarIndicators] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const calendarRows = rows.filter((r) => r.type === "calendar" && r.calendarIntegrationId);
    if (calendarRows.length === 0) {
      setCalendarIndicators({});
      return;
    }
    const ids = calendarRows.map((r) => r.calendarIntegrationId!);
    const currentYear = new Date().getFullYear();
    getCalendarIndicators({
      integrationIds: ids,
      startDate: `${currentYear}-01-01`,
      endDate: `${currentYear}-12-31`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }).then(setCalendarIndicators);
  }, [rows]);

  // Expense data state
  const [expenseMap, setExpenseMap] = useState<Record<string, ExpenseData[]>>({});
  const [expenseRefreshKey, setExpenseRefreshKey] = useState(0);

  useEffect(() => {
    const currentYear = new Date().getFullYear();
    getExpensesAction(`${currentYear}-01-01`, `${currentYear}-12-31`).then(
      (expenses) => {
        const map: Record<string, ExpenseData[]> = {};
        for (const exp of expenses) {
          if (!exp.userId || !exp.projectId) continue;
          const key = `${exp.userId}:${exp.projectId}:${exp.date}`;
          if (!map[key]) map[key] = [];
          map[key].push(exp);
        }
        setExpenseMap(map);
      }
    );
  }, [expenseRefreshKey]);

  // Track bottom bar height and expose via CSS variable for FloatingNav — desktop only
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isMobile) return;
    if (!bottomBarVisible) {
      document.documentElement.style.setProperty("--bottom-bar-height", "0px");
      return;
    }
    if (!bottomRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        document.documentElement.style.setProperty(
          "--bottom-bar-height",
          `${entry.contentRect.height}px`
        );
      }
    });
    observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, [isMobile, bottomBarVisible]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const panelTitle = PANEL_TITLE_KEYS[panelState.type] ? t(PANEL_TITLE_KEYS[panelState.type] as any) : "";

  const panelContent = (
    <>
      {panelState.type === "assign-user" && (
        <AssignUserPanel
          projectId={panelState.projectId}
          projectName={panelState.projectName}
          clientName={panelState.clientName}
          allUsers={allUsers}
          allAssignments={allAssignments}
          onClose={closePanel}
        />
      )}
      {panelState.type === "add-project" && (
        <AddProjectPanel
          clientId={panelState.clientId}
          clientName={panelState.clientName}
          onClose={closePanel}
        />
      )}
      {panelState.type === "add-client" && (
        <AddClientPanel onClose={closePanel} />
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
          onClose={closePanel}
          userRole={userRole}
        />
      )}
      {panelState.type === "add-user" && (
        <AddUserPanel onClose={closePanel} />
      )}
      {panelState.type === "add-sub-project" && (
        <AddSubProjectPanel
          projectId={panelState.projectId}
          projectName={panelState.projectName}
          clientName={panelState.clientName}
          allProjects={allProjects}
          onClose={closePanel}
        />
      )}
      {panelState.type === "project-detail" && (
        <ProjectDetailPanel
          projectId={panelState.projectId}
          projectName={panelState.projectName}
          clientName={panelState.clientName}
          allProjects={allProjects}
          allDependencies={allDependencies}
          onClose={closePanel}
          onOpenAssignUser={openAssignUser}
          userRole={userRole}
        />
      )}
      {panelState.type === "client-detail" && (
        <ClientDetailPanel
          clientId={panelState.clientId}
          clientName={panelState.clientName}
          allClients={allClients}
          allProjects={allProjects}
          onClose={closePanel}
          userRole={userRole}
        />
      )}
      {panelState.type === "add-absence-client" && (
        <AddAbsenceClientPanel onClose={closePanel} />
      )}
      {panelState.type === "add-absence-type" && (
        <AddAbsenceTypePanel
          clientId={panelState.clientId}
          clientName={panelState.clientName}
          onClose={closePanel}
        />
      )}
      {panelState.type === "assign-absence-user" && (
        <AssignUserPanel
          projectId={panelState.projectId}
          projectName={panelState.projectName}
          clientName={panelState.clientName}
          allUsers={allUsers}
          allAssignments={allAssignments}
          onClose={closePanel}
        />
      )}
      {panelState.type === "absence-client-detail" && (
        <AbsenceClientDetailPanel
          clientId={panelState.clientId}
          clientName={panelState.clientName}
          allClients={allClients}
          allProjects={allProjects}
          onClose={closePanel}
          userRole={userRole}
        />
      )}
      {panelState.type === "absence-type-detail" && (
        <AbsenceTypeDetailPanel
          projectId={panelState.projectId}
          projectName={panelState.projectName}
          clientName={panelState.clientName}
          allProjects={allProjects}
          onClose={closePanel}
          onOpenAssignUser={openAssignAbsenceUser}
          userRole={userRole}
        />
      )}
      {panelState.type === "add-calendar" && (
        <AddCalendarPanel onClose={closePanel} />
      )}
      {panelState.type === "calendar-detail" && (
        <CalendarDetailPanel
          integrationId={panelState.integrationId}
          integrationLabel={panelState.integrationLabel}
          allCalendarIntegrations={allCalendarIntegrations}
          allUsers={allUsers}
          currentUserId={currentUserId}
          onClose={closePanel}
        />
      )}
      {panelState.type === "calendar-events" && (
        <CalendarEventsPanel
          integrationId={panelState.integrationId}
          integrationLabel={panelState.integrationLabel}
          date={panelState.date}
          color={allCalendarIntegrations.find((c) => c.id === panelState.integrationId)?.color}
          onClose={closePanel}
        />
      )}
    </>
  );

  return (
    <div className="flex h-full flex-col" style={{ paddingBottom: isMobile ? 0 : "var(--bottom-bar-height, 0px)" }}>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className={`min-w-0 flex-1 transition-all duration-200 ${isOpen && !isMobile ? "mr-0" : ""}`}>
          <SheetDataGrid
            rows={filteredRows}
            year={year}
            cells={cells}
            onUpdateCell={updateCell}
            onUpdateNote={updateNote}
            onAssignUser={openAssignUser}
            onAddProject={openAddProject}
            onUserDetail={openUserDetail}
            onAddSubProject={openAddSubProject}
            onProjectDetail={openProjectDetail}
            onSelectProject={(id, label) =>
              handleSelectProfit(id, "project", label)
            }
            onClientDetail={openClientDetail}
            onSelectClient={(id, label) =>
              handleSelectProfit(id, "client", label)
            }
            onAddClient={openAddClient}
            onAddUser={openAddUser}
            onAddAbsenceClient={openAddAbsenceClient}
            onAddAbsenceType={openAddAbsenceType}
            onAssignAbsenceUser={openAssignAbsenceUser}
            onAbsenceClientDetail={openAbsenceClientDetail}
            onAbsenceTypeDetail={openAbsenceTypeDetail}
            onAddCalendar={openAddCalendar}
            onCalendarDetail={openCalendarDetail}
            onCalendarEvents={openCalendarEvents}
            calendarIndicators={calendarIndicators}
            allDependencies={allDependencies}
            userName={userName}
            userImage={userImage}
            currentOrgId={currentOrgId}
            currentOrgName={currentOrgName}
            userOrganizations={userOrganizations}
            userRole={userRole}
            pendingInvitations={pendingInvitations}
            allClients={allClients}
            allProjects={allProjects}
            allUsers={allUsers}
            filters={filters}
            onFiltersChange={setFilters}
            isMobile={isMobile}
            weekDays={isMobile ? weekDays : undefined}
            onPrevWeek={goToPrevWeek}
            onNextWeek={goToNextWeek}
            onTodayWeek={goToToday}
            weekLabel={weekLabel}
            expenseMap={expenseMap}
            expenseCategories={expenseCategories}
            onExpenseCreated={() => setExpenseRefreshKey((k) => k + 1)}
            onExpenseDeleted={() => setExpenseRefreshKey((k) => k + 1)}
            allWorkplaces={allWorkplaces}
            userWorkplaceMap={userWorkplaceMap}
            onBookDesk={openDeskBooking}
          />
        </div>

        {/* Panel: bottom sheet on mobile, side panel on desktop */}
        {isMobile ? (
          <MobileBottomSheet isOpen={isOpen} onClose={closePanel} title={panelTitle}>
            {panelContent}
          </MobileBottomSheet>
        ) : (
          <SheetPanel
            panelState={panelState}
            onClose={closePanel}
            onOpenAssignUser={openAssignUser}
            allUsers={allUsers}
            allClients={allClients}
            allAssignments={allAssignments}
            allProjects={allProjects}
            allDependencies={allDependencies}
            allCalendarIntegrations={allCalendarIntegrations}
            rows={rows}
            cells={cells}
            expenseMap={expenseMap}
            currentUserId={currentUserId}
            userRole={userRole}
          />
        )}
      </div>

      {/* Desk booking overlay */}
      {panelState.type === "desk-booking" && (
        <DeskBookingPanel
          userId={panelState.userId}
          date={panelState.date}
          workplaceId={panelState.workplaceId}
          userName={panelState.userName}
          userImage={allUsers.find((u) => u.id === panelState.userId)?.image}
          currentUserId={currentUserId}
          onClose={closePanel}
        />
      )}

      {/* Bottom bars */}
      {isMobile ? (
        <>
          {showMobileBottom && (
            <div className="fixed bottom-14 left-0 right-0 z-40 bg-white shadow-[0_-1px_3px_rgba(0,0,0,0.08)]">
              <SummaryBar
                rows={filteredRows}
                allProjects={allProjects}
                allUsers={allUsers}
                selection={profitSelection}
                onClearSelection={() => setProfitSelection(null)}
                expenseMap={expenseMap}
                cells={cells}
              />
            </div>
          )}
          <button
            onClick={() => setShowMobileBottom((v) => !v)}
            className="fixed bottom-4 right-4 z-50 rounded-full bg-gray-900 p-2.5 text-white shadow-lg active:bg-gray-800"
          >
            <ChartBar size={18} />
          </button>
        </>
      ) : (
        <>
          <div
            ref={bottomRef}
            className={`fixed bottom-0 left-0 right-0 z-40 bg-white shadow-[0_-1px_3px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-in-out ${!bottomBarVisible ? "translate-y-full" : ""}`}
          >
            <SummaryBar
              rows={filteredRows}
              allProjects={allProjects}
              allUsers={allUsers}
              selection={profitSelection}
              onClearSelection={() => setProfitSelection(null)}
              onHideBar={() => setBottomBarVisible(false)}
              expenseMap={expenseMap}
              cells={cells}
            />
          </div>
          {!bottomBarVisible && (
            <button
              onClick={() => setBottomBarVisible(true)}
              className="fixed bottom-4 right-4 z-50 rounded-full bg-gray-900 p-2.5 text-white shadow-lg hover:bg-gray-800 transition-colors"
            >
              <ChartBar size={18} />
            </button>
          )}
        </>
      )}
    </div>
  );
}
