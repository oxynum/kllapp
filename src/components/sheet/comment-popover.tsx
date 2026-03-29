"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

interface CommentPopoverProps {
  x: number;
  y: number;
  initialNote: string;
  onSave: (note: string) => void;
  onCancel: () => void;
}

export function CommentPopover({
  x,
  y,
  initialNote,
  onSave,
  onCancel,
}: CommentPopoverProps) {
  const t = useTranslations("comment");
  const tCommon = useTranslations("common");
  const [note, setNote] = useState(initialNote);
  const ref = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onCancel]);

  return (
    <div
      ref={ref}
      className="fixed z-50 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
      style={{ left: x, top: y }}
    >
      <textarea
        ref={textareaRef}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        className="w-full resize-none rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 outline-none placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
        placeholder={t("placeholder")}
      />
      <div className="mt-2 flex justify-end gap-1.5">
        <button
          onClick={onCancel}
          className="rounded-md px-2.5 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-gray-100"
        >
          {tCommon("cancel")}
        </button>
        <button
          onClick={() => onSave(note)}
          className="rounded-md bg-gray-900 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-gray-800"
        >
          {tCommon("save")}
        </button>
      </div>
    </div>
  );
}
