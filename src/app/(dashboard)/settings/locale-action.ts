"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireOrgContext } from "@/lib/auth-context";
import { locales, type Locale } from "@/i18n/config";

export async function updateUserLocale(locale: Locale) {
  if (!locales.includes(locale)) return;

  const { appUserId } = await requireOrgContext();

  await db.update(users).set({ locale }).where(eq(users.id, appUserId));

  const cookieStore = await cookies();
  cookieStore.set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  revalidatePath("/");
}
