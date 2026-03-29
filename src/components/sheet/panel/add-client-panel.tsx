"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/app/(dashboard)/clients/actions";

interface AddClientPanelProps {
  onClose: () => void;
}

export function AddClientPanel({ onClose }: AddClientPanelProps) {
  const t = useTranslations("client");
  const tCommon = useTranslations("common");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      await createClient(formData);
      onClose();
    });
  };

  return (
    <div className="p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Name */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500">
            {t("clientName")}
          </label>
          <input
            name="name"
            required
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
            placeholder={t("clientNamePlaceholder")}
          />
        </div>

        {/* Contact */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500">
            {t("contact")}
          </label>
          <input
            name="contact"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 outline-none placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
            placeholder={t("contactPlaceholder")}
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
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 outline-none placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
            placeholder={t("emailPlaceholder")}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-gray-900 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
        >
          {isPending ? tCommon("creating") : t("createClient")}
        </button>
      </form>
    </div>
  );
}
