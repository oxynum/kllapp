import { db } from "@/lib/db";
import { users, authUsers, organizationMembers } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { TeamView } from "@/components/team/team-view";
import { getResolvedAvatarUrl } from "@/lib/utils/avatars";
import { requireOrgContext } from "@/lib/auth-context";
import { getWorkplaces } from "@/app/(dashboard)/workplace/actions";

export default async function TeamPage() {
  const { organizationId, orgRole } = await requireOrgContext();

  // Get all non-declined members for this org (with their membership status and role)
  const orgMembers = await db
    .select({
      userId: organizationMembers.userId,
      memberStatus: organizationMembers.status,
      memberRole: organizationMembers.role,
    })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        ne(organizationMembers.status, "declined")
      )
    );
  const memberInfoMap = new Map(
    orgMembers.filter((m) => m.userId).map((m) => [m.userId!, { status: m.memberStatus, role: m.memberRole }])
  );
  const memberUserIdSet = new Set(memberInfoMap.keys());

  const allUsersRaw = await db
    .select({
      id: users.id,
      authUserId: users.authUserId,
      email: users.email,
      name: users.name,
      role: users.role,
      hourlyCost: users.hourlyCost,
      dailyCost: users.dailyCost,
      hoursPerDay: users.hoursPerDay,
      defaultWorkplaceId: users.defaultWorkplaceId,
      status: users.status,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      authImage: authUsers.image,
    })
    .from(users)
    .leftJoin(authUsers, eq(users.authUserId, authUsers.id));

  const allUsers = allUsersRaw
    .filter((u) => memberUserIdSet.has(u.id))
    .map((u) => {
      const info = memberInfoMap.get(u.id);
      return {
        ...u,
        role: (info?.role as "admin" | "manager" | "collaborator" | null) ?? u.role,
        image: getResolvedAvatarUrl(u.authImage, u.email),
        memberStatus: info?.status ?? "pending",
      };
    });

  const workplacesList = await getWorkplaces();

  return <TeamView users={allUsers} userRole={orgRole} workplaces={workplacesList} />;
}
