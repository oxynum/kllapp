import { ClientSheet } from "@/components/sheet/client-sheet";
import { DisplayModeProvider } from "@/components/sheet/display-mode-context";
import { getSheetStructure } from "@/lib/db/queries/sheet-data";
import { requireOrgContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { organizationMembers, organizations } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { getExpenseCategories } from "@/lib/db/queries/expenses";

export default async function HomePage() {
  const { session, appUserId, organizationId, orgRole } = await requireOrgContext();
  const year = new Date().getFullYear();

  // Parallelize all independent DB queries
  const [sheetData, userOrgs, pendingInvitations, expenseCategories] = await Promise.all([
    getSheetStructure(organizationId, orgRole, appUserId),
    db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(
        and(
          eq(organizationMembers.userId, appUserId),
          ne(organizationMembers.status, "declined")
        )
      ),
    db
      .select({
        membershipId: organizationMembers.id,
        orgId: organizationMembers.organizationId,
        orgName: organizations.name,
        role: organizationMembers.role,
        invitedAt: organizationMembers.invitedAt,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(
        and(
          eq(organizationMembers.userId, appUserId),
          eq(organizationMembers.status, "pending")
        )
      ),
    getExpenseCategories(organizationId),
  ]);

  const { rows, allUsers, allClients, allAssignments, allProjects, allDependencies, allCalendarIntegrations, allWorkplaces, userWorkplaceMap, initialCells } = sheetData;

  const currentOrg = userOrgs.find((o) => o.id === organizationId);

  return (
    <div className="flex h-full flex-col">
      <DisplayModeProvider>
        <ClientSheet
          rows={rows}
          year={year}
          allUsers={allUsers}
          allClients={allClients}
          allAssignments={allAssignments}
          allProjects={allProjects}
          allDependencies={allDependencies}
          allCalendarIntegrations={allCalendarIntegrations}
          allWorkplaces={allWorkplaces}
          userWorkplaceMap={userWorkplaceMap}
          expenseCategories={expenseCategories}
          initialCells={initialCells}
          currentUserId={appUserId}
          userName={session?.user?.name ?? "Utilisateur"}
          userImage={session?.user?.image ?? null}
          currentOrgId={organizationId}
          currentOrgName={currentOrg?.name ?? "Organisation"}
          userOrganizations={userOrgs}
          userRole={orgRole}
          pendingInvitations={pendingInvitations}
        />
      </DisplayModeProvider>
    </div>
  );
}
