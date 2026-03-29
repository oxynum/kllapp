import { db } from "@/lib/db";
import { organizationMembers, organizations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { KllappLogo } from "@/components/ui/kllapp-logo";
import { OnboardingClient } from "./onboarding-client";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.appUserId) redirect("/login");

  if (session.user.currentOrganizationId) redirect("/");

  const t = await getTranslations("onboarding");

  const pendingInvitations = await db
    .select({
      id: organizationMembers.id,
      orgName: organizations.name,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(
      and(
        eq(organizationMembers.userId, session.user.appUserId),
        eq(organizationMembers.status, "pending")
      )
    );

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="flex flex-col items-center gap-4">
          <KllappLogo className="h-8" />
          <p className="text-sm text-gray-500">
            {t("welcome")}
          </p>
        </div>

        <OnboardingClient invitations={pendingInvitations} />
      </div>
    </div>
  );
}
