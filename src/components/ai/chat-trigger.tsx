"use client";

import { Robot } from "@phosphor-icons/react";

interface ChatTriggerProps {
  onClick: () => void;
}

export function ChatTrigger({ onClick }: ChatTriggerProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-600/30 transition-all hover:scale-105 hover:bg-violet-700 hover:shadow-xl hover:shadow-violet-600/40 active:scale-95"
      title="Assistant IA"
    >
      <Robot size={22} weight="fill" />
    </button>
  );
}
