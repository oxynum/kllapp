"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createCalendarIntegration } from "@/app/(dashboard)/calendar/actions";

const PROVIDERS = ["google", "outlook", "apple", "other"] as const;

const PROVIDER_PLACEHOLDERS: Record<string, string> = {
  google: "https://calendar.google.com/calendar/ical/.../basic.ics",
  outlook: "https://outlook.live.com/owa/calendar/.../calendar.ics",
  apple: "https://p00-caldav.icloud.com/.../calendar.ics",
  other: "https://example.com/calendar.ics",
};

const COLOR_OPTIONS = [
  "#0891b2", // teal (default)
  "#6366f1", // indigo
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ef4444", // red
  "#8b5cf6", // violet
  "#64748b", // slate
];

interface AddCalendarPanelProps {
  onClose: () => void;
}

export function AddCalendarPanel({ onClose }: AddCalendarPanelProps) {
  const t = useTranslations("calendar");
  const tCommon = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number] | null>(null);
  const [icsUrl, setIcsUrl] = useState("");
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [error, setError] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!provider || !icsUrl.trim() || !label.trim()) return;

    const formData = new FormData();
    formData.set("provider", provider);
    formData.set("icsUrl", icsUrl.trim());
    formData.set("label", label.trim());
    formData.set("color", color);

    startTransition(async () => {
      try {
        await createCalendarIntegration(formData);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("urlFailed"));
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="p-4">
      {/* Provider selection */}
      <div className="mb-4">
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          {t("selectProvider")}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                provider === p
                  ? "border-cyan-600 bg-cyan-50 text-cyan-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t(p)}
            </button>
          ))}
        </div>
      </div>

      {provider && (
        <>
          {/* iCal URL */}
          <div className="mb-3">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              {t("icsUrl")}
            </label>
            <input
              type="url"
              value={icsUrl}
              onChange={(e) => setIcsUrl(e.target.value)}
              placeholder={PROVIDER_PLACEHOLDERS[provider] ?? t("icsUrlPlaceholder")}
              required
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 placeholder:text-gray-300 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-100"
            />
          </div>

          {/* Help toggle */}
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="mb-3 text-[10px] font-medium text-cyan-600 hover:text-cyan-700"
          >
            {t("urlHelp")} {showHelp ? "▲" : "▼"}
          </button>
          {showHelp && (
            <div className="mb-3 rounded-lg bg-gray-50 p-2.5 text-[10px] leading-relaxed text-gray-500">
              {provider === "google" && t("googleHelp")}
              {provider === "outlook" && t("outlookHelp")}
              {provider === "apple" && t("appleHelp")}
              {provider === "other" && t("icsUrlPlaceholder")}
            </div>
          )}

          {/* Label */}
          <div className="mb-3">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              {t("label")}
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("labelPlaceholder")}
              required
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 placeholder:text-gray-300 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-100"
            />
          </div>

          {/* Color */}
          <div className="mb-4">
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              {t("color")}
            </label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-6 w-6 rounded-full border-2 transition-all ${
                    color === c ? "border-gray-900 scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending || !icsUrl.trim() || !label.trim()}
            className="w-full rounded-lg bg-cyan-600 py-2 text-xs font-medium text-white transition-colors hover:bg-cyan-700 disabled:opacity-50"
          >
            {isPending ? t("testingUrl") : t("addCalendar")}
          </button>
        </>
      )}
    </form>
  );
}
