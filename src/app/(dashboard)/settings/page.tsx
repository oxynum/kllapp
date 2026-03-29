import { requireOrgContext, requireManagerOrAdmin } from "@/lib/auth-context";
import { getOrganizationDetails } from "./actions";
import { SettingsView } from "@/components/settings/settings-view";

export default async function SettingsPage() {
  const { orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);
  const { org, members, currentUserRole, isCurrentUserOwner, currentUserId } = await getOrganizationDetails();

  return (
    <SettingsView
      org={org}
      members={members}
      currentUserRole={currentUserRole}
      isCurrentUserOwner={isCurrentUserOwner}
      currentUserId={currentUserId}
    />
  );
}
