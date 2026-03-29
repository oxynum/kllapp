"use client";

import { useTranslations } from "next-intl";

const LEGEND_ITEMS = [
  { key: "available", color: "#6ee7b7" },
  { key: "booked", color: "#d1d5db" },
  { key: "yourTeam", color: "#f9a8d4" },
  { key: "yourBooking", color: "#93c5fd" },
] as const;

export function DeskAvailabilityLegend() {
  const t = useTranslations("deskBooking");

  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-2">
      {LEGEND_ITEMS.map(({ key, color }) => (
        <div key={key} className="flex items-center gap-1.5">
          <div
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: color }}
          />
          <span className="text-xs text-gray-500">
            {t(key)}
          </span>
        </div>
      ))}
    </div>
  );
}
