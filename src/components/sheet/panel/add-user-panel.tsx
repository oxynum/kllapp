"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { createUser } from "@/app/(dashboard)/team/actions";

interface AddUserPanelProps {
  onClose: () => void;
}

export function AddUserPanel({ onClose }: AddUserPanelProps) {
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("user");
  const tCommon = useTranslations("common");
  const tEnum = useTranslations("enums");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      await createUser(formData);
      onClose();
    });
  };

  return (
    <div className="p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Nom */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500">
            {t("fullName")}
          </label>
          <input
            name="name"
            required
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
            placeholder={t("namePlaceholder")}
          />
        </div>

        {/* Email */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500">
            {t("email")}
          </label>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
            placeholder={t("emailPlaceholder")}
          />
        </div>

        {/* Rôle */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500">
            {t("role")}
          </label>
          <select
            name="role"
            defaultValue="collaborator"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 outline-none transition-colors focus:border-gray-300 focus:bg-white"
          >
            <option value="collaborator">{tEnum("role.collaborator")}</option>
            <option value="manager">{tEnum("role.manager")}</option>
            <option value="admin">{tEnum("role.admin")}</option>
          </select>
        </div>

        {/* Coût journalier */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500">
            {t("dailyCost")}
          </label>
          <input
            name="dailyCost"
            type="number"
            step="0.01"
            min="0"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
            placeholder="350"
          />
        </div>

        {/* Volume horaire/jour */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500">
            {t("hoursPerDay")}
          </label>
          <input
            name="hoursPerDay"
            type="number"
            step="0.5"
            min="1"
            max="24"
            defaultValue="7"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
            placeholder="7"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-gray-900 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
        >
          {isPending ? tCommon("creating") : t("createUser")}
        </button>
      </form>
    </div>
  );
}
