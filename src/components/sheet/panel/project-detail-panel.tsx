"use client";

import { useState, useTransition } from "react";
import { Trash, Plus, UserPlus, ChartBar } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { updateProject, deleteSubProject, createSubProject, deleteProject } from "@/app/(dashboard)/projects/actions";
import { createDependencyAction, deleteDependencyAction } from "@/app/(dashboard)/sheet/dependency-actions";
import type { ProjectInfo, DependencyInfo } from "@/types";
import type { OrgRole } from "@/lib/auth-context";
import { EditableField } from "@/components/ui/editable-field";

interface ProjectDetailPanelProps {
  projectId: string;
  projectName: string;
  clientName: string;
  allProjects: ProjectInfo[];
  allDependencies: DependencyInfo[];
  onClose: () => void;
  onOpenAssignUser?: (projectId: string, projectName: string, clientName: string) => void;
  userRole?: OrgRole;
  onShowFinances?: () => void;
  showFinances?: boolean;
}

export function ProjectDetailPanel({
  projectId,
  projectName,
  clientName,
  allProjects,
  allDependencies,
  onClose,
  onOpenAssignUser,
  userRole,
  onShowFinances,
  showFinances,
}: ProjectDetailPanelProps) {
  const t = useTranslations("project");
  const tCommon = useTranslations("common");
  const tEnum = useTranslations("enums");
  const canManage = userRole === "admin" || userRole === "manager";
  const [isPending, startTransition] = useTransition();

  const project = allProjects.find((p) => p.id === projectId);
  const isSubProject = !!project?.parentId;
  const subProjects = allProjects.filter((p) => p.parentId === projectId);

  // Editable fields
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(project?.name ?? projectName);
  const [editingType, setEditingType] = useState(false);
  const [typeValue, setTypeValue] = useState(project?.type ?? "service");
  const [editingRate, setEditingRate] = useState(false);
  const [rateValue, setRateValue] = useState(project?.dailyRate ?? "");
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetValue, setBudgetValue] = useState(project?.budget ?? "");
  const [editingStatus, setEditingStatus] = useState(false);
  const [statusValue, setStatusValue] = useState(project?.status ?? "draft");
  const [billableValue, setBillableValue] = useState(project?.billable ?? true);
  const [startDateValue, setStartDateValue] = useState(project?.startDate ?? "");
  const [endDateValue, setEndDateValue] = useState(project?.endDate ?? "");

  // Inline add sub-project
  const [showAddSub, setShowAddSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");

  // Dependencies
  const [showAddDep, setShowAddDep] = useState(false);
  const projectDeps = allDependencies.filter(
    (d) => d.sourceProjectId === projectId || d.targetProjectId === projectId
  );
  const linkedProjectIds = new Set(
    projectDeps.flatMap((d) => [d.sourceProjectId, d.targetProjectId])
  );
  const availableDepTargets = allProjects.filter(
    (p) => p.id !== projectId && !linkedProjectIds.has(p.id)
  );

  const handleSave = (field: string, value: string | null | boolean) => {
    startTransition(async () => {
      await updateProject({ id: projectId, [field]: value });
    });
  };

  const handleDeleteSub = (subId: string) => {
    startTransition(async () => {
      await deleteSubProject(subId);
    });
  };

  const handleAddDep = (targetId: string) => {
    startTransition(async () => {
      await createDependencyAction({
        sourceProjectId: projectId,
        targetProjectId: targetId,
      });
      setShowAddDep(false);
    });
  };

  const handleDeleteDep = (depId: string) => {
    startTransition(async () => {
      await deleteDependencyAction(depId);
    });
  };

  const handleAddSub = () => {
    if (!newSubName.trim()) return;
    const formData = new FormData();
    formData.set("name", newSubName.trim());
    formData.set("parentId", projectId);

    startTransition(async () => {
      await createSubProject(formData);
      setNewSubName("");
      setShowAddSub(false);
    });
  };

  return (
    <div className="p-4">
      {/* Breadcrumb */}
      <p className="mb-4 text-xs text-gray-500">
        {clientName}
        {isSubProject && project?.parentId && (
          <>
            {" "}&rsaquo;{" "}
            {allProjects.find((p) => p.id === project.parentId)?.name ?? ""}
          </>
        )}
      </p>

      {/* Main info */}
      <div className="mb-4 space-y-2 rounded-lg bg-gray-50 p-3">
        {/* Name */}
        <EditableField
          label={t("name")}
          value={nameValue}
          editing={editingName}
          onEdit={() => setEditingName(true)}
          onChange={setNameValue}
          onSave={() => {
            handleSave("name", nameValue);
            setEditingName(false);
          }}
          onCancel={() => setEditingName(false)}
          type="text"
          canManage={canManage}
          isPending={isPending}
        />

        {/* Client (read-only) */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-500">{t("client")}</span>
          <span className="text-[11px] font-medium text-gray-700">
            {clientName}
          </span>
        </div>

        {/* Type */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-500">{t("type")}</span>
          {editingType && canManage ? (
            <div className="flex items-center gap-1">
              <select
                value={typeValue}
                onChange={(e) => setTypeValue(e.target.value)}
                className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] text-gray-700 outline-none focus:border-gray-400"
                autoFocus
              >
                <option value="service">{tEnum("projectType.service")}</option>
                <option value="product">{tEnum("projectType.product")}</option>
                <option value="training">{tEnum("projectType.training")}</option>
                <option value="internal">{tEnum("projectType.internal")}</option>
              </select>
              <button
                onClick={() => {
                  handleSave("type", typeValue);
                  setEditingType(false);
                }}
                disabled={isPending}
                className="ml-1 rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                OK
              </button>
            </div>
          ) : canManage ? (
            <button
              onClick={() => setEditingType(true)}
              className="text-[11px] font-medium text-gray-700 underline decoration-dashed decoration-gray-300 underline-offset-2 hover:text-gray-900"
            >
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {tEnum(`projectType.${typeValue ?? "service"}` as any)}
            </button>
          ) : (
            <span className="text-[11px] font-medium text-gray-700">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {tEnum(`projectType.${typeValue ?? "service"}` as any)}
            </span>
          )}
        </div>

        {/* Daily Rate */}
        <EditableField
          label={t("tjm")}
          value={rateValue}
          editing={editingRate}
          onEdit={() => setEditingRate(true)}
          onChange={setRateValue}
          onSave={() => {
            handleSave("dailyRate", rateValue || null);
            setEditingRate(false);
          }}
          onCancel={() => setEditingRate(false)}
          suffix="€"
          type="number"
          step="0.01"
          min="0"
          canManage={canManage}
          isPending={isPending}
        />

        {/* Budget */}
        <EditableField
          label={t("budget")}
          value={budgetValue}
          editing={editingBudget}
          onEdit={() => setEditingBudget(true)}
          onChange={setBudgetValue}
          onSave={() => {
            handleSave("budget", budgetValue || null);
            setEditingBudget(false);
          }}
          onCancel={() => setEditingBudget(false)}
          suffix="€"
          type="number"
          step="0.01"
          min="0"
          canManage={canManage}
          isPending={isPending}
        />

        {/* Status */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-500">{t("status")}</span>
          {editingStatus && canManage ? (
            <div className="flex items-center gap-1">
              <select
                value={statusValue}
                onChange={(e) => setStatusValue(e.target.value)}
                className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] text-gray-700 outline-none focus:border-gray-400"
                autoFocus
              >
                <option value="draft">{tEnum("projectStatus.draft")}</option>
                <option value="active">{tEnum("projectStatus.active")}</option>
                <option value="closed">{tEnum("projectStatus.closed")}</option>
              </select>
              <button
                onClick={() => {
                  handleSave("status", statusValue);
                  setEditingStatus(false);
                }}
                disabled={isPending}
                className="ml-1 rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                OK
              </button>
            </div>
          ) : canManage ? (
            <button
              onClick={() => setEditingStatus(true)}
              className="text-[11px] font-medium text-gray-700 underline decoration-dashed decoration-gray-300 underline-offset-2 hover:text-gray-900"
            >
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {tEnum(`projectStatus.${statusValue ?? "draft"}` as any)}
            </button>
          ) : (
            <span className="text-[11px] font-medium text-gray-700">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {tEnum(`projectStatus.${statusValue ?? "draft"}` as any)}
            </span>
          )}
        </div>

        {/* Start Date */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-500">{t("startDate")}</span>
          {canManage ? (
            <input
              type="date"
              value={startDateValue}
              onChange={(e) => {
                setStartDateValue(e.target.value);
                handleSave("startDate", e.target.value || null);
              }}
              className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] text-gray-700 outline-none focus:border-gray-400"
            />
          ) : (
            <span className="text-[11px] font-medium text-gray-700">
              {startDateValue || tCommon("notDefined")}
            </span>
          )}
        </div>

        {/* End Date */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-500">{t("endDate")}</span>
          {canManage ? (
            <input
              type="date"
              value={endDateValue}
              onChange={(e) => {
                setEndDateValue(e.target.value);
                handleSave("endDate", e.target.value || null);
              }}
              className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] text-gray-700 outline-none focus:border-gray-400"
            />
          ) : (
            <span className="text-[11px] font-medium text-gray-700">
              {endDateValue || tCommon("notDefined")}
            </span>
          )}
        </div>

        {/* Billable */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-500">{t("billable")}</span>
          {canManage ? (
            <button
              onClick={() => {
                const newVal = !billableValue;
                setBillableValue(newVal);
                handleSave("billable", newVal);
              }}
              disabled={isPending}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                billableValue ? "bg-emerald-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  billableValue ? "translate-x-[18px]" : "translate-x-[2px]"
                }`}
              />
            </button>
          ) : (
            <span className={`text-[11px] font-medium ${billableValue ? "text-emerald-600" : "text-gray-400"}`}>
              {billableValue ? tCommon("yes") : tCommon("no")}
            </span>
          )}
        </div>
      </div>

      {/* Assign user button */}
      {canManage && (
        <button
          onClick={() => onOpenAssignUser?.(projectId, nameValue, clientName)}
          className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <UserPlus size={14} weight="fill" />
          {t("assignCollaborator")}
        </button>
      )}

      {/* Finances button */}
      {onShowFinances && (
        <button
          onClick={onShowFinances}
          className={`mb-4 flex w-full items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-medium transition-colors ${
            showFinances
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          <ChartBar size={14} weight="fill" />
          {tCommon("finances")}
        </button>
      )}

      {/* Sub-projects section — only for top-level projects */}
      {!isSubProject && (
        <div className="mb-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {t("subProjects")}
          </h3>

          {subProjects.length === 0 && !showAddSub && (
            <p className="mb-2 text-[11px] text-gray-400">{t("noSubProjects")}</p>
          )}

          {subProjects.map((sub) => (
            <div
              key={sub.id}
              className="mb-1 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
            >
              <div>
                <p className="text-xs font-medium text-gray-700">{sub.name}</p>
                {sub.dailyRate && (
                  <p className="text-[10px] text-gray-400">TJM: {sub.dailyRate} €</p>
                )}
              </div>
              {canManage && (
                <button
                  onClick={() => handleDeleteSub(sub.id)}
                  disabled={isPending}
                  className="flex h-5 w-5 items-center justify-center rounded text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                >
                  <Trash size={12} weight="fill" />
                </button>
              )}
            </div>
          ))}

          {canManage && (showAddSub ? (
            <div className="mt-2 flex items-center gap-1">
              <input
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 outline-none placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
                placeholder={t("subProjectName")}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddSub();
                  if (e.key === "Escape") {
                    setShowAddSub(false);
                    setNewSubName("");
                  }
                }}
              />
              <button
                onClick={handleAddSub}
                disabled={isPending || !newSubName.trim()}
                className="rounded-lg bg-gray-900 px-2 py-1 text-[10px] font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {isPending ? "..." : "OK"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddSub(true)}
              className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-gray-200 py-1.5 text-xs text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-600"
            >
              <Plus size={12} weight="fill" />
              {t("addSubProject")}
            </button>
          ))}
        </div>
      )}

      {/* Dependencies section */}
      <div className="mb-4">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          {t("dependencies")}
        </h3>

        {projectDeps.length === 0 && !showAddDep && (
          <p className="mb-2 text-[11px] text-gray-400">{t("noDependencies")}</p>
        )}

        {projectDeps.map((dep) => {
          const linkedId =
            dep.sourceProjectId === projectId
              ? dep.targetProjectId
              : dep.sourceProjectId;
          const linkedProject = allProjects.find((p) => p.id === linkedId);
          const direction =
            dep.sourceProjectId === projectId ? t("dependsOn") : t("requiredBy");

          return (
            <div
              key={dep.id}
              className="mb-1 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-gray-700">
                  {linkedProject?.name ?? "Projet inconnu"}
                </p>
                <p className="text-[10px] text-gray-400">{direction}</p>
              </div>
              {canManage && (
                <button
                  onClick={() => handleDeleteDep(dep.id)}
                  disabled={isPending}
                  className="ml-2 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                >
                  <Trash size={12} weight="fill" />
                </button>
              )}
            </div>
          );
        })}

        {canManage && (showAddDep ? (
          <div className="mt-2">
            <select
              onChange={(e) => {
                if (e.target.value) handleAddDep(e.target.value);
              }}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-gray-300 focus:bg-white"
              autoFocus
              defaultValue=""
            >
              <option value="" disabled>
                {t("selectProject")}
              </option>
              {availableDepTargets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowAddDep(false)}
              className="mt-1 w-full text-center text-[10px] text-gray-400 hover:text-gray-600"
            >
              {tCommon("cancel")}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddDep(true)}
            className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-gray-200 py-1.5 text-xs text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-600"
          >
            <Plus size={12} weight="fill" />
            {t("addDependency")}
          </button>
        ))}
      </div>

      {/* Delete sub-project button (only for sub-projects, managers/admins only) */}
      {canManage && isSubProject && (
        <button
          onClick={() => {
            startTransition(async () => {
              await deleteSubProject(projectId);
              onClose();
            });
          }}
          disabled={isPending}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
        >
          <Trash size={14} weight="fill" />
          {isPending ? tCommon("deleting") : t("deleteSubProject")}
        </button>
      )}

      {/* Delete project button (only for top-level projects, managers/admins only) */}
      {canManage && !isSubProject && (
        <button
          onClick={() => {
            startTransition(async () => {
              await deleteProject(projectId);
              onClose();
            });
          }}
          disabled={isPending}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
        >
          <Trash size={14} weight="fill" />
          {isPending ? tCommon("deleting") : t("deleteProject")}
        </button>
      )}
    </div>
  );
}
