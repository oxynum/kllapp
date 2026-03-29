import {
  eachDayOfInterval,
  startOfYear,
  endOfYear,
  isWeekend,
  addDays,
} from "date-fns";

/**
 * Compute Easter Sunday for a given year using the
 * Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
 */
function computeEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** Returns all French public holidays for a given year as "yyyy-MM-dd" strings. */
function getFrenchHolidays(year: number): Set<string> {
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const easter = computeEasterSunday(year);

  return new Set([
    // Fixed holidays
    `${year}-01-01`, // Jour de l'an
    `${year}-05-01`, // Fête du travail
    `${year}-05-08`, // Victoire 1945
    `${year}-07-14`, // Fête nationale
    `${year}-08-15`, // Assomption
    `${year}-11-01`, // Toussaint
    `${year}-11-11`, // Armistice
    `${year}-12-25`, // Noël
    // Easter-based holidays
    fmt(addDays(easter, 1)),  // Lundi de Pâques
    fmt(addDays(easter, 39)), // Ascension
    fmt(addDays(easter, 49)), // Lundi de Pentecôte
  ]);
}

// Cache per year to avoid recomputing
const holidayCache = new Map<number, Set<string>>();

function getHolidaysForYear(year: number): Set<string> {
  let holidays = holidayCache.get(year);
  if (!holidays) {
    holidays = getFrenchHolidays(year);
    holidayCache.set(year, holidays);
  }
  return holidays;
}

export function getDaysOfYear(year: number) {
  const start = startOfYear(new Date(year, 0, 1));
  const end = endOfYear(new Date(year, 0, 1));
  return eachDayOfInterval({ start, end });
}

export function isHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${year}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return getHolidaysForYear(year).has(dateStr);
}

export function isWorkingDay(date: Date): boolean {
  return !isWeekend(date) && !isHoliday(date);
}
