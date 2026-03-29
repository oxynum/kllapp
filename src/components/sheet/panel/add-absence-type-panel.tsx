"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { createAbsenceType } from "@/app/(dashboard)/absences/actions";

interface AddAbsenceTypePanelProps {
  clientId: string;
  clientName: string;
  onClose: () => void;
}

export function AddAbsenceTypePanel({
  clientId,
  clientName,
  onClose,
}: AddAbsenceTypePanelProps) {
  const t = useTranslations("absence");
  const tCommon = useTranslations("common");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("clientId", clientId);

    startTransition(async () => {
      await createAbsenceType(formData);
      onClose();
    });
  };

  return (
    <div className="p-4">
      <p className="mb-4 text-xs text-gray-500">{t("category")} : {clientName}</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Name */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500">
            {t("typeName")}
          </label>
          <input
            name="name"
            required
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
            placeholder={t("typeNamePlaceholder")}
          />
        </div>

        {/* Daily Cost */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500">
            {t("dailyCost")}
          </label>
          <input
            name="dailyCost"
            type="number"
            step="0.01"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 outline-none placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
            placeholder="0"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-gray-900 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
        >
          {isPending ? tCommon("creating") : t("createType")}
        </button>
      </form>
    </div>
  );
}
