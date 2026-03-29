"use client";

import { useTranslations } from "next-intl";

interface EditableFieldProps {
  label: string;
  value: string;
  editing: boolean;
  onEdit: () => void;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  canManage: boolean;
  isPending: boolean;
  suffix?: string;
  type?: string;
  defaultLabel?: string;
  inputWidth?: string;
  step?: string;
  min?: string;
}

export function EditableField({
  label,
  value,
  editing,
  onEdit,
  onChange,
  onSave,
  onCancel,
  canManage,
  isPending,
  suffix,
  type = "text",
  defaultLabel,
  inputWidth = "w-20",
  step,
  min,
}: EditableFieldProps) {
  const tCommon = useTranslations("common");
  const displayValue = value
    ? `${value}${suffix ? ` ${suffix}` : ""}`
    : defaultLabel ?? tCommon("notDefined");

  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-gray-500">{label}</span>
      {editing && canManage ? (
        <div className="flex items-center gap-1">
          <input
            type={type}
            step={step}
            min={min}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputWidth} rounded border border-gray-300 bg-white px-1.5 py-0.5 text-right text-[11px] text-gray-700 outline-none focus:border-gray-400`}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") onSave();
              if (e.key === "Escape") onCancel();
            }}
          />
          {suffix && <span className="text-[11px] text-gray-400">{suffix}</span>}
          <button
            onClick={onSave}
            disabled={isPending}
            className="ml-1 rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            OK
          </button>
        </div>
      ) : canManage ? (
        <button
          onClick={onEdit}
          className="text-[11px] font-medium text-gray-700 underline decoration-dashed decoration-gray-300 underline-offset-2 hover:text-gray-900"
        >
          {displayValue}
        </button>
      ) : (
        <span className="text-[11px] font-medium text-gray-700">
          {displayValue}
        </span>
      )}
    </div>
  );
}
