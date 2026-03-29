"use client";

import { useState, useMemo, useCallback } from "react";
import { startOfWeek, addWeeks, subWeeks, eachDayOfInterval, endOfWeek, format } from "date-fns";
import { useLocale } from "next-intl";
import { getDateLocale } from "@/i18n/date-locale";

export function useWeekNavigation() {
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);

  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const weekDays = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) }),
    [weekStart]
  );

  const weekLabel = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[6];
    const startDay = format(start, "d", { locale: dateLocale });
    const endDay = format(end, "d", { locale: dateLocale });
    const endMonth = format(end, "MMM", { locale: dateLocale });
    const startMonth = format(start, "MMM", { locale: dateLocale });
    const year = format(end, "yyyy");

    if (startMonth === endMonth) {
      return `${startDay} - ${endDay} ${endMonth} ${year}`;
    }
    return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${year}`;
  }, [weekDays, dateLocale]);

  const goToPrevWeek = useCallback(() => setWeekStart((w) => subWeeks(w, 1)), []);
  const goToNextWeek = useCallback(() => setWeekStart((w) => addWeeks(w, 1)), []);
  const goToToday = useCallback(
    () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 })),
    []
  );

  return { weekDays, weekLabel, goToPrevWeek, goToNextWeek, goToToday };
}
