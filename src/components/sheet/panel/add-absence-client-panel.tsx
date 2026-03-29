"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { createAbsenceClient, createAbsenceClientWithDefaults } from "@/app/(dashboard)/absences/actions";

interface AddAbsenceClientPanelProps {
  onClose: () => void;
}

export function AddAbsenceClientPanel({ onClose }: AddAbsenceClientPanelProps) {
  const t = useTranslations("absence");
  const tCommon = useTranslations("common");
  const [isPending, startTransition] = useTransition();

  const handleDefaults = () => {
    startTransition(async () => {
      await createAbsenceClientWithDefaults();
      onClose();
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      await createAbsenceClient(formData);
      onClose();
    });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Quick create with defaults */}
      <div>
        <button
          onClick={handleDefaults}
          disabled={isPending}
          className="w-full rounded-lg bg-gray-900 py-2 text-xs font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
        >
          {isPending ? tCommon("creating") : t("createWithDefaults")}
        </button>
        <p className="mt-1.5 text-[10px] leading-tight text-gray-400">
          {t("createWithDefaultsDesc")}
        </p>
      </div>

      {/* Separator */}
      <div className="flex items-center gap-2">
        <div className="flex-1 border-t border-gray-200" />
        <span className="text-[10px] text-gray-400">{t("orCustom")}</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      {/* Custom creation form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500">
            {t("categoryName")}
          </label>
          <input
            name="name"
            required
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
            placeholder={t("categoryNamePlaceholder")}
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          {isPending ? tCommon("creating") : t("createCategory")}
        </button>
      </form>
    </div>
  );
}
