import { db } from "@/lib/db";
import { projects, clients, projectAssignments, users } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { OrgRole } from "@/lib/auth-context";
import type { ToolDefinition } from "./index";

export const queryProjectsTool: ToolDefinition = {
  name: "query_projects",
  description:
    "List projects in the organization with optional filters. Returns project details including client, status, budget, and assigned team members.",
  input_schema: {
    type: "object" as const,
    properties: {
      status: {
        type: "string",
        enum: ["draft", "active", "closed"],
        description: "Filter by project status (optional).",
      },
      client_id: {
        type: "string",
        description: "Filter by client ID (optional).",
      },
      user_id: {
        type: "string",
        description: "Filter projects assigned to a specific user (optional).",
      },
      search: {
        type: "string",
        description: "Search term to match against project or client name (optional).",
      },
    },
    required: [],
  },
  execute: async (
    params: Record<string, unknown>,
    ctx: { userId: string; organizationId: string; role: OrgRole }
  ) => {
    const { status, client_id, user_id, search } = params as {
      status?: string;
      client_id?: string;
      user_id?: string;
      search?: string;
    };

    const conditions = [eq(projects.organizationId, ctx.organizationId)];

    if (status) {
      conditions.push(eq(projects.status, status as "draft" | "active" | "closed"));
    }
    if (client_id) {
      conditions.push(eq(projects.clientId, client_id));
    }

    const query = db
      .select({
        id: projects.id,
        name: projects.name,
        clientName: clients.name,
        type: projects.type,
        status: projects.status,
        dailyRate: projects.dailyRate,
        fixedPrice: projects.fixedPrice,
        budget: projects.budget,
        billable: projects.billable,
        startDate: projects.startDate,
        endDate: projects.endDate,
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(and(...conditions))
      .orderBy(projects.name)
      .limit(50);

    let rows = await query;

    // Filter by search term in-memory (simpler than SQL LIKE with Drizzle)
    if (search) {
      const term = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(term) ||
          r.clientName?.toLowerCase().includes(term)
      );
    }

    // If filtering by user, get their assigned project IDs first
    if (user_id) {
      const assignments = await db
        .select({ projectId: projectAssignments.projectId })
        .from(projectAssignments)
        .where(eq(projectAssignments.userId, user_id));
      const assignedIds = new Set(assignments.map((a) => a.projectId));
      rows = rows.filter((r) => assignedIds.has(r.id));
    }

    // Get team members for each project
    const projectIds = rows.map((r) => r.id);
    const allAssignments =
      projectIds.length > 0
        ? await db
            .select({
              projectId: projectAssignments.projectId,
              userName: users.name,
            })
            .from(projectAssignments)
            .innerJoin(users, eq(projectAssignments.userId, users.id))
            .where(
              sql`${projectAssignments.projectId} IN (${sql.join(
                projectIds.map((id) => sql`${id}`),
                sql`, `
              )})`
            )
        : [];

    const teamByProject = new Map<string, string[]>();
    for (const a of allAssignments) {
      const list = teamByProject.get(a.projectId) ?? [];
      list.push(a.userName ?? "Unknown");
      teamByProject.set(a.projectId, list);
    }

    const data = rows.map((r) => ({
      ...r,
      team: teamByProject.get(r.id) ?? [],
    }));

    return { count: data.length, data };
  },
};
