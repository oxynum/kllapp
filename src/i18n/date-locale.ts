import { fr } from "date-fns/locale/fr";
import { enUS } from "date-fns/locale/en-US";

const dateFnsLocales = { fr, en: enUS } as const;

export function getDateLocale(locale: string) {
  return dateFnsLocales[locale as keyof typeof dateFnsLocales] ?? fr;
}
