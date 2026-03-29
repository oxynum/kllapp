"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { acceptInvitation, declineInvitation, createOrganization } from "./actions";

interface Invitation {
  id: string;
  orgName: string;
  role: string | null;
}

interface OnboardingClientProps {
  invitations: Invitation[];
}

export function OnboardingClient({ invitations }: OnboardingClientProps) {
  const t = useTranslations("onboarding");
  const tCommon = useTranslations("common");
  const tEnum = useTranslations("enums");
  const [isPending, startTransition] = useTransition();

  const handleAccept = (id: string) => {
    startTransition(() => acceptInvitation(id));
  };

  const handleDecline = (id: string) => {
    startTransition(() => declineInvitation(id));
  };

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => createOrganization(formData));
  };

  return (
    <div className="space-y-6">
      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-medium text-gray-500">
            {t("pendingInvitations")}
          </h2>
          {invitations.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{inv.orgName}</p>
                <p className="text-[11px] text-gray-500">
                  {t("role")} : {tEnum(`role.${inv.role ?? "collaborator"}` as "role.admin" | "role.manager" | "role.collaborator")}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDecline(inv.id)}
                  disabled={isPending}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  {t("decline")}
                </button>
                <button
                  onClick={() => handleAccept(inv.id)}
                  disabled={isPending}
                  className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {isPending ? "..." : t("accept")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Separator */}
      {invitations.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400">{tCommon("or")}</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>
      )}

      {/* Create organization */}
      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            {t("orgName")}
          </label>
          <input
            name="name"
            required
            placeholder={t("orgPlaceholder")}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-black focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-black py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {isPending ? tCommon("creating") : t("createOrg")}
        </button>
      </form>
    </div>
  );
}
