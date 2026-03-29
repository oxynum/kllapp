"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { createProject } from "@/app/(dashboard)/projects/actions";

interface AddProjectPanelProps {
  clientId: string;
  clientName: string;
  onClose: () => void;
}

export function AddProjectPanel({
  clientId,
  clientName,
  onClose,
}: AddProjectPanelProps) {
  const t = useTranslations("project");
  const tCommon = useTranslations("common");
  const tEnum = useTranslations("enums");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("clientId", clientId);

    startTransition(async () => {
      await createProject(formData);
      onClose();
    });
  };

  return (
    <div className="p-4">
      <p className="mb-4 text-xs text-gray-500">{t("client")} : {clientName}</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Name */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500">
            {t("projectName")}
          </label>
          <input
            name="name"
            required
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
            placeholder={t("projectNamePlaceholder")}
          />
        </div>

        {/* Type */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500">
            {t("type")}
          </label>
          <select
            name="type"
            defaultValue="service"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 outline-none focus:border-gray-300 focus:bg-white"
          >
            <option value="service">{tEnum("projectType.service")}</option>
            <option value="product">{tEnum("projectType.product")}</option>
            <option value="training">{tEnum("projectType.training")}</option>
            <option value="internal">{tEnum("projectType.internal")}</option>
          </select>
        </div>

        {/* Daily Rate */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500">
            {t("dailyRate")}
          </label>
          <input
            name="dailyRate"
            type="number"
            step="0.01"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 outline-none placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
            placeholder="650"
          />
        </div>

        {/* Budget */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500">
            {t("budget")}
          </label>
          <input
            name="budget"
            type="number"
            step="0.01"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 outline-none placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
            placeholder="50000"
          />
        </div>

        {/* Start / End dates */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">
              {t("startDate")}
            </label>
            <input
              name="startDate"
              type="date"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 outline-none focus:border-gray-300 focus:bg-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">
              {t("endDate")}
            </label>
            <input
              name="endDate"
              type="date"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 outline-none focus:border-gray-300 focus:bg-white"
            />
          </div>
        </div>

        {/* Billable */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            name="billable"
            id="billable"
            defaultChecked
            value="true"
            className="h-3.5 w-3.5 rounded border-gray-300"
          />
          <label htmlFor="billable" className="text-[11px] font-medium text-gray-500">
            {t("billable")}
          </label>
        </div>

        <input type="hidden" name="status" value="active" />

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-gray-900 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
        >
          {isPending ? tCommon("creating") : t("createProject")}
        </button>
      </form>
    </div>
  );
}
