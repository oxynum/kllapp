import { getTranslations } from "next-intl/server";
import { KllappLogo } from "@/components/ui/kllapp-logo";
import Link from "next/link";

export default async function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("legal");

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/login">
            <KllappLogo className="h-5 w-auto" />
          </Link>
          <nav className="flex items-center gap-6 text-[13px] text-gray-400">
            <Link
              href="/privacy"
              className="transition-colors hover:text-gray-900"
            >
              {t("privacy")}
            </Link>
            <Link
              href="/terms"
              className="transition-colors hover:text-gray-900"
            >
              {t("terms")}
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">{children}</main>

      <footer className="border-t border-gray-100">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6 text-[13px] text-gray-400">
          <span>{t("copyright", { year: new Date().getFullYear() })}</span>
          <div className="flex items-center gap-6">
            <Link
              href="/privacy"
              className="transition-colors hover:text-gray-700"
            >
              {t("privacy")}
            </Link>
            <Link
              href="/terms"
              className="transition-colors hover:text-gray-700"
            >
              {t("terms")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
