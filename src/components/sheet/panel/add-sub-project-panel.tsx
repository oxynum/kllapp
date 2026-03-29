"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { createSubProject } from "@/app/(dashboard)/projects/actions";
import type { ProjectInfo } from "@/types";

interface AddSubProjectPanelProps {
  projectId: string;
  projectName: string;
  clientName: string;
  allProjects: ProjectInfo[];
  onClose: () => void;
}

export function AddSubProjectPanel({
  projectId,
  projectName,
  clientName,
  allProjects,
  onClose,
}: AddSubProjectPanelProps) {
  const t = useTranslations("project");
  const tCommon = useTranslations("common");
  const [isPending, startTransition] = useTransition();

  const parentProject = allProjects.find((p) => p.id === projectId);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("parentId", projectId);

    startTransition(async () => {
      await createSubProject(formData);
      onClose();
    });
  };

  return (
    <div className="p-4">
      <p className="mb-4 text-xs text-gray-500">
        {clientName} &rsaquo; {projectName}
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Name */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500">
            {t("subProjectName")}
          </label>
          <input
            name="name"
            required
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
            placeholder="Ex: Formation, Dev, Support"
          />
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
            placeholder={parentProject?.dailyRate ?? t("inheritsParent")}
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
            placeholder={t("optional")}
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
            defaultChecked={parentProject?.billable ?? true}
            value="true"
            className="h-3.5 w-3.5 rounded border-gray-300"
          />
          <label htmlFor="billable" className="text-[11px] font-medium text-gray-500">
            {t("billable")}
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-gray-900 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
        >
          {isPending ? tCommon("creating") : t("createSubProject")}
        </button>
      </form>
    </div>
  );
}
