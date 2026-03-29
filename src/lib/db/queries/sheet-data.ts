import { db } from "@/lib/db";
import { clients, projects, users, projectAssignments, authUsers, organizationMembers, projectDependencies, calendarIntegrations, calendarShares, timeEntries, projectForecasts, workplaces, userWorkplaces } from "@/lib/db/schema";
import { eq, and, ne, inArray, gte, lte } from "drizzle-orm";
import { getResolvedAvatarUrl } from "@/lib/utils/avatars";
import type { SheetRow, UserInfo, ClientInfo, AssignmentInfo, ProjectInfo, DependencyInfo, CalendarIntegrationInfo, WorkplaceInfo } from "@/types";

export interface CellData {
  value: string;
  note?: string;
}

export interface SheetStructureResult {
  rows: SheetRow[];
  allUsers: UserInfo[];
  allClients: ClientInfo[];
  allAssignments: AssignmentInfo[];
  allProjects: ProjectInfo[];
  allDependencies: DependencyInfo[];
  allCalendarIntegrations: CalendarIntegrationInfo[];
  allWorkplaces: WorkplaceInfo[];
  userWorkplaceMap: Record<string, string>;
  initialCells: Record<string, CellData>;
}

export async function getSheetStructure(organizationId: string, callerRole?: string, callerUserId?: string): Promise<SheetStructureResult> {
  const allClients = await db.select().from(clients).where(eq(clients.organizationId, organizationId));
  const allProjectsRaw = await db.select().from(projects).where(eq(projects.organizationId, organizationId));

  // Get users who are members of this org (exclude declined only)
  const orgMemberUserIds = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        ne(organizationMembers.status, "declined")
      )
    );
  const memberIds = orgMemberUserIds.map((m) => m.userId).filter(Boolean) as string[];

  const allUsersWithAuth = memberIds.length > 0
    ? await db
        .select({
          id: users.id,
          authUserId: users.authUserId,
          email: users.email,
          name: users.name,
          role: users.role,
          dailyCost: users.dailyCost,
          hoursPerDay: users.hoursPerDay,
          defaultWorkplaceId: users.defaultWorkplaceId,
          status: users.status,
          authImage: authUsers.image,
        })
        .from(users)
        .leftJoin(authUsers, eq(users.authUserId, authUsers.id))
        .where(inArray(users.id, memberIds))
    : [];

  const projectIdArray = allProjectsRaw.map((p) => p.id);
  const allAssignments = projectIdArray.length > 0
    ? await db.select().from(projectAssignments).where(inArray(projectAssignments.projectId, projectIdArray))
    : [];

  const allDependenciesRaw = await db
    .select()
    .from(projectDependencies)
    .where(eq(projectDependencies.organizationId, organizationId));

  const rows: SheetRow[] = [];

  // --- Calendar section at the top (personal + shared) ---
  let userCalendars: { id: string; provider: string; label: string; color: string | null; isEnabled: boolean | null }[] = [];
  let sharedCalendars: { id: string; provider: string; label: string; color: string | null; isEnabled: boolean | null; ownerName: string | null }[] = [];
  let calendarSharesData: { calendarIntegrationId: string; sharedWithUserId: string }[] = [];

  if (callerUserId) {
    // Own calendars
    userCalendars = await db
      .select({
        id: calendarIntegrations.id,
        provider: calendarIntegrations.provider,
        label: calendarIntegrations.label,
        color: calendarIntegrations.color,
        isEnabled: calendarIntegrations.isEnabled,
      })
      .from(calendarIntegrations)
      .where(
        and(
          eq(calendarIntegrations.userId, callerUserId),
          eq(calendarIntegrations.organizationId, organizationId),
          eq(calendarIntegrations.isEnabled, true)
        )
      );

    // Shared calendars (from others)
    sharedCalendars = await db
      .select({
        id: calendarIntegrations.id,
        provider: calendarIntegrations.provider,
        label: calendarIntegrations.label,
        color: calendarIntegrations.color,
        isEnabled: calendarIntegrations.isEnabled,
        ownerName: users.name,
      })
      .from(calendarShares)
      .innerJoin(calendarIntegrations, eq(calendarShares.calendarIntegrationId, calendarIntegrations.id))
      .innerJoin(users, eq(calendarIntegrations.userId, users.id))
      .where(
        and(
          eq(calendarShares.sharedWithUserId, callerUserId),
          eq(calendarIntegrations.organizationId, organizationId),
          eq(calendarIntegrations.isEnabled, true)
        )
      );

    // Load share data for own calendars (to populate sharing UI)
    const ownCalendarIds = userCalendars.map((c) => c.id);
    if (ownCalendarIds.length > 0) {
      calendarSharesData = await db
        .select({
          calendarIntegrationId: calendarShares.calendarIntegrationId,
          sharedWithUserId: calendarShares.sharedWithUserId,
        })
        .from(calendarShares)
        .where(inArray(calendarShares.calendarIntegrationId, ownCalendarIds));
    }

    // Own calendars first
    for (const cal of userCalendars) {
      rows.push({
        id: `calendar:${cal.id}`,
        type: "calendar",
        label: cal.label,
        depth: 0,
        calendarIntegrationId: cal.id,
        calendarProvider: cal.provider,
        calendarColor: cal.color ?? undefined,
      });
    }

    // Then shared calendars
    for (const cal of sharedCalendars) {
      rows.push({
        id: `calendar:${cal.id}`,
        type: "calendar",
        label: cal.label,
        depth: 0,
        calendarIntegrationId: cal.id,
        calendarProvider: cal.provider,
        calendarColor: cal.color ?? undefined,
        calendarOwnerName: cal.ownerName ?? undefined,
      });
    }

    rows.push({
      id: "add-calendar-placeholder",
      type: "add-calendar-placeholder",
      label: "",
      depth: 0,
    });
  }

  // Split clients into regular and absence clients
  const regularClients = allClients.filter((c) => !c.isAbsence);
  const absenceClients = allClients.filter((c) => c.isAbsence);

  for (const client of regularClients) {
    rows.push({
      id: `client:${client.id}`,
      type: "client",
      label: client.name,
      clientId: client.id,
      depth: 0,
      isExpanded: true,
    });

    // Only top-level projects for this client
    const clientProjects = allProjectsRaw.filter(
      (p) => p.clientId === client.id && p.parentId === null
    );

    for (const project of clientProjects) {
      const subProjects = allProjectsRaw.filter(
        (p) => p.parentId === project.id
      );
      const hasSubProjects = subProjects.length > 0;

      rows.push({
        id: `project:${project.id}`,
        type: "project",
        label: project.name,
        parentId: `client:${client.id}`,
        projectId: project.id,
        clientId: client.id,
        depth: 1,
        isExpanded: true,
        dailyRate: project.dailyRate ? Number(project.dailyRate) : undefined,
        budget: project.budget ? Number(project.budget) : undefined,
        hasSubProjects,
        billable: project.billable,
        startDate: project.startDate ?? null,
        endDate: project.endDate ?? null,
      });

      if (hasSubProjects) {
        // --- With sub-projects ---
        for (const sub of subProjects) {
          rows.push({
            id: `project:${sub.id}`,
            type: "sub-project",
            label: sub.name,
            parentId: `project:${project.id}`,
            projectId: sub.id,
            clientId: client.id,
            depth: 2,
            isExpanded: true,
            dailyRate: sub.dailyRate
              ? Number(sub.dailyRate)
              : project.dailyRate
                ? Number(project.dailyRate)
                : undefined,
            budget: sub.budget ? Number(sub.budget) : undefined,
            billable: sub.billable,
            startDate: sub.startDate ?? null,
            endDate: sub.endDate ?? null,
          });

          const subAssignments = allAssignments.filter(
            (a) => a.projectId === sub.id
          );

          for (const assignment of subAssignments) {
            const user = allUsersWithAuth.find((u) => u.id === assignment.userId);
            if (!user) continue;

            rows.push({
              id: `user:${user.id}:project:${sub.id}`,
              type: "user",
              label: user.name ?? "Sans nom",
              parentId: `project:${sub.id}`,
              userId: user.id,
              projectId: sub.id,
              clientId: client.id,
              depth: 3,
              dailyRate: assignment.dailyRate
                ? Number(assignment.dailyRate)
                : sub.dailyRate
                  ? Number(sub.dailyRate)
                  : project.dailyRate
                    ? Number(project.dailyRate)
                    : undefined,
              dailyCost: assignment.dailyCost
                ? Number(assignment.dailyCost)
                : user.dailyCost
                  ? Number(user.dailyCost)
                  : undefined,
              hoursPerDay: user.hoursPerDay ? Number(user.hoursPerDay) : 7,
              billable: sub.billable,
              userImage: getResolvedAvatarUrl(user.authImage, user.email),
              defaultWorkplaceId: user.defaultWorkplaceId,
            });
          }

          // Total for this sub-project
          rows.push({
            id: `total:project:${sub.id}`,
            type: "total",
            label: "TOTAL",
            parentId: `project:${sub.id}`,
            projectId: sub.id,
            depth: 3,
          });
        }

        // Aggregate total for parent project
        rows.push({
          id: `total:parent-project:${project.id}`,
          type: "total",
          label: "TOTAL",
          parentId: `project:${project.id}`,
          projectId: project.id,
          depth: 2,
        });
      } else {
        // --- Without sub-projects (backward compatible) ---
        const assignments = allAssignments.filter(
          (a) => a.projectId === project.id
        );

        for (const assignment of assignments) {
          const user = allUsersWithAuth.find((u) => u.id === assignment.userId);
          if (!user) continue;

          rows.push({
            id: `user:${user.id}:project:${project.id}`,
            type: "user",
            label: user.name ?? "Sans nom",
            parentId: `project:${project.id}`,
            userId: user.id,
            projectId: project.id,
            clientId: client.id,
            depth: 2,
            dailyRate: assignment.dailyRate
              ? Number(assignment.dailyRate)
              : project.dailyRate
                ? Number(project.dailyRate)
                : undefined,
            dailyCost: assignment.dailyCost
              ? Number(assignment.dailyCost)
              : user.dailyCost
                ? Number(user.dailyCost)
                : undefined,
            hoursPerDay: user.hoursPerDay ? Number(user.hoursPerDay) : 7,
            billable: project.billable,
            userImage: getResolvedAvatarUrl(user.authImage, user.email),
          });
        }

        rows.push({
          id: `total:project:${project.id}`,
          type: "total",
          label: "TOTAL",
          parentId: `project:${project.id}`,
          projectId: project.id,
          depth: 2,
        });
      }
    }
  }

  // --- Absence section ---
  for (const absClient of absenceClients) {
    rows.push({
      id: `client:${absClient.id}`,
      type: "absence-client",
      label: absClient.name,
      clientId: absClient.id,
      depth: 0,
      isExpanded: true,
      isAbsence: true,
    });

    const absenceTypes = allProjectsRaw.filter(
      (p) => p.clientId === absClient.id && p.parentId === null
    );

    for (const absType of absenceTypes) {
      rows.push({
        id: `project:${absType.id}`,
        type: "absence-type",
        label: absType.name,
        parentId: `client:${absClient.id}`,
        projectId: absType.id,
        clientId: absClient.id,
        depth: 1,
        isExpanded: true,
        dailyRate: absType.dailyRate ? Number(absType.dailyRate) : undefined,
        billable: false,
        isAbsence: true,
      });

      const absAssignments = allAssignments.filter(
        (a) => a.projectId === absType.id
      );

      for (const assignment of absAssignments) {
        const user = allUsersWithAuth.find((u) => u.id === assignment.userId);
        if (!user) continue;

        rows.push({
          id: `user:${user.id}:project:${absType.id}`,
          type: "absence-user",
          label: user.name ?? "Sans nom",
          parentId: `project:${absType.id}`,
          userId: user.id,
          projectId: absType.id,
          clientId: absClient.id,
          depth: 2,
          dailyRate: undefined, // absences have no revenue
          dailyCost: assignment.dailyCost
            ? Number(assignment.dailyCost)
            : absType.dailyRate
              ? Number(absType.dailyRate)
              : user.dailyCost
                ? Number(user.dailyCost)
                : undefined,
          hoursPerDay: user.hoursPerDay ? Number(user.hoursPerDay) : 7,
          billable: false,
          isAbsence: true,
          userImage: getResolvedAvatarUrl(user.authImage, user.email),
        });
      }

      rows.push({
        id: `total:project:${absType.id}`,
        type: "absence-total",
        label: "TOTAL",
        parentId: `project:${absType.id}`,
        projectId: absType.id,
        depth: 2,
        isAbsence: true,
      });
    }
  }

  // Calendar rows were already added at the top of the rows array

  const isCollaborator = callerRole === "collaborator";

  // Mask financial data for collaborators
  if (isCollaborator) {
    for (const row of rows) {
      if (row.type === "user" || row.type === "absence-user") {
        row.dailyCost = undefined;
        row.hoursPerDay = undefined;
      }
    }
  }

  // Load time entries for the current year
  const year = new Date().getFullYear();
  const entries = await db
    .select({
      userId: timeEntries.userId,
      projectId: timeEntries.projectId,
      date: timeEntries.date,
      value: timeEntries.value,
      note: timeEntries.note,
    })
    .from(timeEntries)
    .where(
      and(
        gte(timeEntries.date, `${year}-01-01`),
        lte(timeEntries.date, `${year}-12-31`),
        memberIds.length > 0 ? inArray(timeEntries.userId, memberIds) : undefined
      )
    );

  const initialCells: Record<string, CellData> = {};
  for (const entry of entries) {
    const key = `${entry.userId}:${entry.projectId}:${entry.date}`;
    const cell: CellData = { value: entry.value };
    if (entry.note) cell.note = entry.note;
    initialCells[key] = cell;
  }

  // Load project forecasts (previsionnel)
  const forecasts = await db
    .select({
      projectId: projectForecasts.projectId,
      date: projectForecasts.date,
      value: projectForecasts.value,
    })
    .from(projectForecasts)
    .where(eq(projectForecasts.organizationId, organizationId));

  for (const f of forecasts) {
    initialCells[`forecast:${f.projectId}:${f.date}`] = { value: f.value };
  }

  return {
    rows,
    initialCells,
    allUsers: allUsersWithAuth.map((u) => ({
      id: u.id,
      name: u.name ?? "Sans nom",
      email: u.email,
      role: u.role,
      dailyCost: isCollaborator ? null : u.dailyCost,
      hoursPerDay: isCollaborator ? null : u.hoursPerDay,
      image: getResolvedAvatarUrl(u.authImage, u.email),
    })),
    allClients: allClients.map((c) => ({
      id: c.id,
      name: c.name,
      contact: c.contact,
      email: c.email,
    })),
    allAssignments: allAssignments.map((a) => ({
      id: a.id,
      projectId: a.projectId,
      userId: a.userId,
      dailyRate: isCollaborator ? null : a.dailyRate,
      dailyCost: isCollaborator ? null : a.dailyCost,
    })),
    allProjects: allProjectsRaw.map((p) => ({
      id: p.id,
      name: p.name,
      clientId: p.clientId,
      parentId: p.parentId,
      type: p.type,
      dailyRate: p.dailyRate,
      budget: p.budget,
      status: p.status,
      billable: p.billable,
      startDate: p.startDate ?? null,
      endDate: p.endDate ?? null,
    })),
    allDependencies: allDependenciesRaw.map((d) => ({
      id: d.id,
      sourceProjectId: d.sourceProjectId,
      targetProjectId: d.targetProjectId,
    })),
    allCalendarIntegrations: [
      ...userCalendars.map((c) => ({
        id: c.id,
        label: c.label,
        provider: c.provider,
        color: c.color,
        isEnabled: c.isEnabled ?? true,
        sharedWithUserIds: calendarSharesData
          .filter((s) => s.calendarIntegrationId === c.id)
          .map((s) => s.sharedWithUserId),
      })),
      ...sharedCalendars.map((c) => ({
        id: c.id,
        label: c.label,
        provider: c.provider,
        color: c.color,
        isEnabled: c.isEnabled ?? true,
        ownerName: c.ownerName ?? undefined,
        isSharedWithMe: true as const,
      })),
    ],
    // Workplaces
    allWorkplaces: await db
      .select({
        id: workplaces.id,
        name: workplaces.name,
        type: workplaces.type,
        color: workplaces.color,
        address: workplaces.address,
        sortOrder: workplaces.sortOrder,
      })
      .from(workplaces)
      .where(eq(workplaces.organizationId, organizationId))
      .orderBy(workplaces.sortOrder),
    // User workplace assignments
    userWorkplaceMap: Object.fromEntries(
      (
        await db
          .select({
            userId: userWorkplaces.userId,
            date: userWorkplaces.date,
            workplaceId: userWorkplaces.workplaceId,
          })
          .from(userWorkplaces)
          .where(eq(userWorkplaces.organizationId, organizationId))
      ).map((uw) => [`${uw.userId}:${uw.date}`, uw.workplaceId])
    ) as Record<string, string>,
  };
}
