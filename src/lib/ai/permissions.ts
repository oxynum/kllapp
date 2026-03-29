import type { OrgRole } from "@/lib/auth-context";

/**
 * Defines which AI tools each role can access.
 * - "self" means the tool can only operate on the calling user's own data
 * - "all" means the tool can operate on any user in the organization
 */

type ToolAccess = "self" | "all";

interface ToolPermission {
  allowedRoles: OrgRole[];
  dataScope: Record<OrgRole, ToolAccess>;
}

const TOOL_PERMISSIONS: Record<string, ToolPermission> = {
  query_time_entries: {
    allowedRoles: ["admin", "manager", "collaborator"],
    dataScope: { admin: "all", manager: "all", collaborator: "self" },
  },
  query_expenses: {
    allowedRoles: ["admin", "manager", "collaborator"],
    dataScope: { admin: "all", manager: "all", collaborator: "self" },
  },
  query_projects: {
    allowedRoles: ["admin", "manager", "collaborator"],
    dataScope: { admin: "all", manager: "all", collaborator: "all" },
  },
  query_absences: {
    allowedRoles: ["admin", "manager", "collaborator"],
    dataScope: { admin: "all", manager: "all", collaborator: "self" },
  },
  get_user_availability: {
    allowedRoles: ["admin", "manager"],
    dataScope: { admin: "all", manager: "all", collaborator: "self" },
  },
  get_project_health: {
    allowedRoles: ["admin", "manager"],
    dataScope: { admin: "all", manager: "all", collaborator: "self" },
  },
  compute_profitability: {
    allowedRoles: ["admin"],
    dataScope: { admin: "all", manager: "all", collaborator: "self" },
  },
  create_time_entry: {
    allowedRoles: ["admin", "manager", "collaborator"],
    dataScope: { admin: "self", manager: "self", collaborator: "self" },
  },
  create_expense: {
    allowedRoles: ["admin", "manager", "collaborator"],
    dataScope: { admin: "self", manager: "self", collaborator: "self" },
  },
  get_calendar_events: {
    allowedRoles: ["admin", "manager", "collaborator"],
    dataScope: { admin: "self", manager: "self", collaborator: "self" },
  },
};

export function canUseTool(role: OrgRole, toolName: string): boolean {
  const perm = TOOL_PERMISSIONS[toolName];
  if (!perm) return false;
  return perm.allowedRoles.includes(role);
}

export function getDataScope(role: OrgRole, toolName: string): ToolAccess {
  const perm = TOOL_PERMISSIONS[toolName];
  if (!perm) return "self";
  return perm.dataScope[role] ?? "self";
}

export function getAvailableTools(role: OrgRole): string[] {
  return Object.entries(TOOL_PERMISSIONS)
    .filter(([, perm]) => perm.allowedRoles.includes(role))
    .map(([name]) => name);
}
