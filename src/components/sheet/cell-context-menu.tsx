"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { House, Buildings, MapPin, X, Desk } from "@phosphor-icons/react";
import type { WorkplaceInfo } from "@/types";

const WP_ICONS = { remote: House, office: Buildings, client: MapPin };

interface CellContextMenuProps {
  x: number;
  y: number;
  hasNote: boolean;
  hasExpenses: boolean;
  expenseCount: number;
  onAddComment: () => void;
  onDeleteComment: () => void;
  onAddExpense: () => void;
  onViewExpenses: () => void;
  onClose: () => void;
  workplaces?: WorkplaceInfo[];
  currentWorkplaceId?: string | null;
  onSetWorkplace?: (workplaceId: string) => void;
  onRemoveWorkplace?: () => void;
  onBookDesk?: () => void;
  showBookDesk?: boolean;
}

export function CellContextMenu({
  x,
  y,
  hasNote,
  hasExpenses,
  expenseCount,
  onAddComment,
  onDeleteComment,
  onAddExpense,
  onViewExpenses,
  onClose,
  workplaces = [],
  currentWorkplaceId,
  onSetWorkplace,
  onRemoveWorkplace,
  onBookDesk,
  showBookDesk = false,
}: CellContextMenuProps) {
  const t = useTranslations("comment");
  const tExpense = useTranslations("expense");
  const tWp = useTranslations("workplace");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
      style={{ left: x, top: y }}
    >
      <button
        onClick={onAddComment}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-700 transition-colors hover:bg-gray-50"
      >
        {hasNote ? t("edit") : t("add")}
      </button>
      {hasNote && (
        <button
          onClick={onDeleteComment}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 transition-colors hover:bg-red-50"
        >
          {t("delete")}
        </button>
      )}
      <div className="my-1 border-t border-gray-100" />
      <button
        onClick={onAddExpense}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-700 transition-colors hover:bg-gray-50"
      >
        {tExpense("addExpense")}
      </button>
      {hasExpenses && (
        <button
          onClick={onViewExpenses}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-700 transition-colors hover:bg-gray-50"
        >
          {tExpense("viewExpenses", { count: expenseCount })}
        </button>
      )}
      {workplaces.length > 0 && onSetWorkplace && (
        <>
          <div className="my-1 border-t border-gray-100" />
          <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">{tWp("setWorkplace")}</p>
          {workplaces.map((wp) => {
            const Icon = WP_ICONS[wp.type];
            const isActive = wp.id === currentWorkplaceId;
            return (
              <button
                key={wp.id}
                onClick={() => { onSetWorkplace(wp.id); onClose(); }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                  isActive ? "bg-gray-100 font-medium text-gray-900" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon size={12} style={{ color: wp.color ?? undefined }} />
                {wp.name}
              </button>
            );
          })}
          {currentWorkplaceId && onRemoveWorkplace && (
            <button
              onClick={() => { onRemoveWorkplace(); onClose(); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-500 transition-colors hover:bg-red-50"
            >
              <X size={12} />
              {tWp("removeWorkplace")}
            </button>
          )}
        </>
      )}
      {showBookDesk && onBookDesk && (
        <>
          <div className="my-1 border-t border-gray-100" />
          <button
            onClick={() => { onBookDesk(); onClose(); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-blue-600 transition-colors hover:bg-blue-50"
          >
            <Desk size={12} />
            {tWp("bookDesk")}
          </button>
        </>
      )}
    </div>
  );
}
