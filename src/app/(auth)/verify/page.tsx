import { getTranslations } from "next-intl/server";
import { KllappLogo } from "@/components/ui/kllapp-logo";

export default async function VerifyPage() {
  const t = await getTranslations("auth.verify");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-4 p-8 text-center">
        <KllappLogo className="mx-auto h-8" />
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-gray-500">
          {t("description")}
        </p>
      </div>
    </div>
  );
}
