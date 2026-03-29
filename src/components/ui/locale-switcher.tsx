"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { updateUserLocale } from "@/app/(dashboard)/settings/locale-action";
import type { Locale } from "@/i18n/config";

const labels: Record<Locale, string> = { fr: "FR", en: "EN" };

export function LocaleSwitcher() {
  const locale = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();

  function switchTo(target: Locale) {
    if (target === locale) return;
    startTransition(() => updateUserLocale(target));
  }

  return (
    <div className="flex items-center gap-0.5 rounded-md bg-gray-50 p-0.5">
      {(Object.keys(labels) as Locale[]).map((l) => (
        <button
          key={l}
          onClick={() => switchTo(l)}
          disabled={isPending}
          className={`rounded px-2 py-0.5 text-[11px] font-medium transition-all ${
            l === locale
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-400 hover:text-gray-600"
          } disabled:opacity-50`}
        >
          {labels[l]}
        </button>
      ))}
    </div>
  );
}
