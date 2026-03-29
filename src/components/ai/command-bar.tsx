"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Lightning,
  Check,
  X,
  CircleNotch,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

interface ParsedAction {
  intent: string;
  params: Record<string, unknown>;
  confidence: number;
  needsConfirmation: boolean;
  displayMessage: string;
}

interface ActionResult {
  success: boolean;
  message: string;
  data?: { redirectToChat?: boolean; question?: string };
}

interface CommandBarProps {
  onOpenChat?: (message: string) => void;
}

export function CommandBar({ onOpenChat }: CommandBarProps) {
  const t = useTranslations("ai");
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<ParsedAction | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setPendingAction(null);
        setResult(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setInput("");
      setPendingAction(null);
      setResult(null);
    }
  }, [open]);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setResult(null);
    setPendingAction(null);

    try {
      const res = await fetch("/api/ai/quick-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim() }),
      });

      if (!res.ok) {
        setResult({ success: false, message: "Could not process command." });
        return;
      }

      const data = await res.json();

      if (data.needsConfirmation) {
        setPendingAction(data.action);
      } else if (data.result) {
        // Check if should redirect to chat
        if (data.result.data?.redirectToChat && onOpenChat) {
          onOpenChat(data.result.data.question || input.trim());
          setOpen(false);
        } else {
          setResult(data.result);
          if (data.result.success) {
            setTimeout(() => setOpen(false), 1500);
          }
        }
      }
    } catch {
      setResult({ success: false, message: "Request failed." });
    } finally {
      setLoading(false);
    }
  }, [input, loading, onOpenChat]);

  const handleConfirm = useCallback(async () => {
    if (!pendingAction || loading) return;
    setLoading(true);

    try {
      const res = await fetch("/api/ai/quick-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim(), confirm: true }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data.result);
        setPendingAction(null);
        if (data.result?.success) {
          setTimeout(() => setOpen(false), 1500);
        }
      }
    } catch {
      setResult({ success: false, message: "Confirmation failed." });
    } finally {
      setLoading(false);
    }
  }, [pendingAction, loading, input]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Command bar */}
      <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl">
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
          <Lightning size={18} weight="fill" className="shrink-0 text-violet-500" />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder={t("commandBarPlaceholder")}
            className="flex-1 text-sm text-gray-900 outline-none placeholder:text-gray-400"
            disabled={loading}
          />
          {loading ? (
            <CircleNotch size={16} className="animate-spin text-violet-500" />
          ) : (
            <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
              {navigator.platform?.includes("Mac") ? "⌘K" : "Ctrl+K"}
            </kbd>
          )}
        </div>

        {/* Hint */}
        {!pendingAction && !result && (
          <div className="px-4 py-2.5">
            <p className="text-[11px] text-gray-400">{t("commandBarHint")}</p>
          </div>
        )}

        {/* Pending confirmation */}
        {pendingAction && (
          <div className="px-4 py-3">
            <p className="mb-2 text-sm text-gray-700">
              {pendingAction.displayMessage}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
              >
                <Check size={12} weight="bold" />
                {t("accept")}
              </button>
              <button
                onClick={() => {
                  setPendingAction(null);
                  inputRef.current?.focus();
                }}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                <X size={12} weight="bold" />
                {t("dismiss")}
              </button>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="px-4 py-3">
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                result.success
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {result.success ? (
                <Check size={14} weight="bold" />
              ) : (
                <X size={14} weight="bold" />
              )}
              {result.message}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
