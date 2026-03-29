"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ExpenseData } from "@/types";

interface ScanResult {
  amount?: number;
  currency?: string;
  date?: string;
  vendor?: string;
  description?: string;
  vat_amount?: number | null;
  category_hint?: string;
}

interface ExpensePopoverProps {
  x: number;
  y: number;
  cellKey: string;
  userId: string;
  projectId: string;
  dateStr: string;
  expenses: ExpenseData[];
  categories: { id: string; name: string }[];
  onSave: (data: {
    amount: string;
    description: string;
    categoryId: string;
    attachmentUrl?: string;
  }) => void;
  onDelete: (expenseId: string) => void;
  onClose: () => void;
}

const CATEGORY_HINT_MAP: Record<string, string[]> = {
  transport: ["transport", "déplacement", "travel", "mileage", "km"],
  meals: ["repas", "restaurant", "meal", "food", "lunch", "dinner"],
  accommodation: ["hébergement", "hôtel", "hotel", "accommodation", "lodging"],
  supplies: ["fourniture", "matériel", "supplies", "office", "equipment"],
  software: ["logiciel", "software", "licence", "saas", "subscription"],
  telecom: ["télécom", "téléphone", "internet", "telecom", "phone", "mobile"],
};

function findCategoryByHint(
  hint: string | undefined,
  categories: { id: string; name: string }[]
): string | undefined {
  if (!hint || categories.length === 0) return undefined;
  const keywords = CATEGORY_HINT_MAP[hint] ?? [hint];
  const match = categories.find((cat) =>
    keywords.some((kw) => cat.name.toLowerCase().includes(kw.toLowerCase()))
  );
  return match?.id;
}

export function ExpensePopover({
  x,
  y,
  expenses,
  categories,
  onSave,
  onDelete,
  onClose,
}: ExpensePopoverProps) {
  const t = useTranslations("expense");
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"list" | "add">(
    expenses.length === 0 ? "add" : "list"
  );
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [attachmentUrl, setAttachmentUrl] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setScanError(null);
    try {
      // 1. Upload the file to S3
      const uploadForm = new FormData();
      uploadForm.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadForm });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const uploadData = await uploadRes.json();
      setAttachmentUrl(uploadData.url);

      // 2. Scan with AI to extract receipt data
      setUploading(false);
      setScanning(true);
      const scanForm = new FormData();
      scanForm.append("file", file);
      const scanRes = await fetch("/api/scan-receipt", { method: "POST", body: scanForm });

      if (scanRes.ok) {
        const { data } = (await scanRes.json()) as { data: ScanResult };
        if (data.amount) setAmount(String(data.amount));
        if (data.description) {
          const desc = data.vendor
            ? `${data.vendor} — ${data.description}`
            : data.description;
          setDescription(desc);
        } else if (data.vendor) {
          setDescription(data.vendor);
        }
        const hintCat = findCategoryByHint(data.category_hint, categories);
        if (hintCat) setCategoryId(hintCat);
      } else {
        setScanError(t("scanFailed"));
      }
    } catch {
      setScanError(t("scanFailed"));
    } finally {
      setUploading(false);
      setScanning(false);
    }
  };

  const handleSave = () => {
    if (!amount || !categoryId) return;
    onSave({
      amount,
      description,
      categoryId,
      attachmentUrl,
    });
    setAmount("");
    setDescription("");
    setAttachmentUrl(undefined);
    setMode("list");
  };

  const total = expenses.reduce(
    (sum, e) => sum + parseFloat(e.amount),
    0
  );

  return (
    <div
      ref={ref}
      className="fixed z-50 w-80 rounded-lg border border-gray-200 bg-white shadow-lg"
      style={{ left: x, top: y }}
    >
      {mode === "list" ? (
        <div className="p-3">
          {expenses.length === 0 ? (
            <p className="text-xs text-gray-400">{t("noExpenses")}</p>
          ) : (
            <>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-start justify-between rounded-md border border-gray-100 bg-gray-50 px-2.5 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-gray-900">
                          {parseFloat(expense.amount).toFixed(2)} &euro;
                        </span>
                        <span className="rounded bg-gray-200 px-1 py-0.5 text-[10px] text-gray-600">
                          {expense.categoryName}
                        </span>
                      </div>
                      {expense.description && (
                        <p className="mt-0.5 truncate text-[11px] text-gray-500">
                          {expense.description}
                        </p>
                      )}
                      {expense.attachmentUrl && (
                        <a
                          href={expense.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 inline-block text-[10px] text-blue-500 underline"
                        >
                          {t("attachment")}
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => onDelete(expense.id)}
                      className="ml-2 shrink-0 rounded p-0.5 text-[10px] text-gray-400 hover:bg-gray-200 hover:text-red-500"
                    >
                      &#x2715;
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
                <span className="text-xs font-medium text-gray-700">
                  {t("total")} : {total.toFixed(2)} &euro;
                </span>
              </div>
            </>
          )}
          <button
            onClick={() => setMode("add")}
            className="mt-2 w-full rounded-md border border-dashed border-gray-300 py-1.5 text-[11px] font-medium text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700"
          >
            + {t("addExpense")}
          </button>
        </div>
      ) : (
        <div className="p-3">
          {/* Upload & AI scan — placed first so it pre-fills the form below */}
          <div className="mb-3">
            <label className="mb-0.5 block text-[10px] font-medium text-gray-500">
              {t("attachment")}
            </label>
            {attachmentUrl ? (
              <div className="flex items-center gap-1.5">
                <a
                  href={attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-blue-500 underline"
                >
                  {t("attachment")}
                </a>
                <button
                  onClick={() => setAttachmentUrl(undefined)}
                  className="text-[10px] text-gray-400 hover:text-red-500"
                >
                  &#x2715;
                </button>
              </div>
            ) : (
              <label className="block cursor-pointer rounded-md border border-dashed border-gray-300 py-2.5 text-center text-[11px] text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-600">
                {uploading
                  ? t("uploading")
                  : scanning
                    ? t("scanning")
                    : t("uploadAndScan")}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  disabled={uploading || scanning}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
              </label>
            )}
            {scanning && (
              <p className="mt-1 text-[10px] text-amber-600 animate-pulse">
                {t("scanningHint")}
              </p>
            )}
            {scanError && (
              <p className="mt-1 text-[10px] text-red-500">{scanError}</p>
            )}
          </div>

          <div className="space-y-2">
            <div>
              <label className="mb-0.5 block text-[10px] font-medium text-gray-500">
                {t("amount")}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-gray-300 focus:bg-white"
                placeholder={scanning ? "..." : "0.00"}
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] font-medium text-gray-500">
                {t("category")}
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-gray-300 focus:bg-white"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] font-medium text-gray-500">
                {t("description")}
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-gray-300 focus:bg-white"
                placeholder={scanning ? "..." : ""}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-1.5">
            <button
              onClick={() => {
                if (expenses.length > 0) {
                  setMode("list");
                } else {
                  onClose();
                }
              }}
              className="rounded-md px-2.5 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-gray-100"
            >
              {t("cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={!amount || !categoryId || uploading || scanning}
              className="rounded-md bg-gray-900 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
            >
              {t("save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
