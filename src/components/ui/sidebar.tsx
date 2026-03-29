"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Calendar, Community, ShieldCheck } from "iconoir-react";
import { PaperPlaneRight, CircleNotch, Microphone, MicrophoneSlash, X, DotsSixVertical } from "@phosphor-icons/react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AgentIcon } from "./agent-icon";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const GLASS = {
  background: "rgba(255, 255, 255, 0.22)",
  backdropFilter: "blur(24px) saturate(180%)",
  WebkitBackdropFilter: "blur(24px) saturate(180%)",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.4)",
};

export function FloatingNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tAi = useTranslations("ai");

  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.isSuperAdmin ?? false;

  const navItems = [
    { href: "/", icon: Calendar, label: t("spreadsheet") },
    { href: "/team", icon: Community, label: t("team") },
    ...(isSuperAdmin ? [{ href: "/admin", icon: ShieldCheck, label: "Admin" }] : []),
  ];

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Drag state
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (chatOpen) setTimeout(() => inputRef.current?.focus(), 200);
  }, [chatOpen]);

  // Close on Escape
  useEffect(() => {
    if (!chatOpen) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setChatOpen(false); };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [chatOpen]);

  // Drag handlers
  const onDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
    e.preventDefault();

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      setDragOffset({ x: ev.clientX - dragStart.current.x, y: ev.clientY - dragStart.current.y });
    };
    const onUp = () => {
      isDragging.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [dragOffset]);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isLoading) return;

    const userMessage: Message = { role: "user", content: msg };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const history = messages.map(m => ({ role: m.role, content: m.content }));

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history }),
      });

      if (!response.ok) {
        setMessages(prev => [...prev, { role: "assistant", content: tAi("errorOccurred") }]);
        setIsLoading(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) { setIsLoading(false); return; }

      const decoder = new TextDecoder();
      let assistantContent = "";
      let buffer = "";

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const chunk = JSON.parse(data);
            if (chunk.type === "text") {
              assistantContent += chunk.content;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                return updated;
              });
            }
          } catch { /* skip */ }
        }
      }
    } catch {
      setMessages(prev => [
        ...prev.filter(m => m.content !== ""),
        { role: "assistant", content: tAi("errorOccurred") },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, tAi]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = navigator.language || "fr-FR";
    recognition.interimResults = true;
    recognition.continuous = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transcript = Array.from(event.results).map((r: any) => r[0].transcript).join("");
      setInput(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const mdClasses = "prose prose-sm prose-gray max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_strong]:text-gray-900 [&_code]:rounded [&_code]:bg-white/50 [&_code]:px-1 [&_code]:text-[12px] [&_table]:my-2 [&_table]:w-full [&_table]:text-[12px] [&_table]:border-collapse [&_th]:bg-white/40 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-gray-500 [&_th]:border-b [&_th]:border-gray-200/50 [&_td]:px-2 [&_td]:py-1 [&_td]:border-b [&_td]:border-gray-100/50 [&_td]:text-gray-700 [&_tr:last-child_td]:border-0 [&_blockquote]:border-l-2 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-gray-500";

  return (
    <>
      {/* ── Floating Nav ── visible when chat is closed */}
      <nav
        className={`fixed left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-white/30 px-3 py-2 transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          chatOpen ? "pointer-events-none translate-y-4 opacity-0" : "translate-y-0 opacity-100"
        }`}
        style={{
          bottom: "calc(var(--bottom-bar-height, 40px) + 42px)",
          ...GLASS,
        }}
      >
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { setChatOpen(true); setDragOffset({ x: 0, y: 0 }); }}
            className="flex flex-col items-center justify-center gap-1 rounded-xl px-3.5 py-1.5 text-gray-500 transition-all hover:bg-white/20 hover:text-gray-800"
          >
            <AgentIcon size={26} />
            <span className="text-[10px] font-medium leading-none">{tAi("assistantName")}</span>
          </button>
          <div className="mx-0.5 h-10 w-px bg-gray-300/30" />
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl px-3.5 py-1.5 transition-all ${
                  isActive
                    ? "bg-white/35 text-gray-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
                    : "text-gray-500 hover:bg-white/20 hover:text-gray-800"
                }`}
              >
                <Icon width={26} height={26} />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Chat Window ── visible when chat is open */}
      <div
        className={`fixed z-50 w-[440px] overflow-hidden rounded-2xl border border-white/30 transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          chatOpen ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        }`}
        style={{
          bottom: "calc(var(--bottom-bar-height, 40px) + 20px)",
          left: "50%",
          transform: `translate(calc(-50% + ${dragOffset.x}px), ${dragOffset.y}px) ${chatOpen ? "scale(1)" : "scale(0.95)"}`,
          ...GLASS,
        }}
      >
        {/* Drag header */}
        <div
          className="flex cursor-grab items-center justify-between px-3 py-2 active:cursor-grabbing"
          onMouseDown={onDragStart}
        >
          <div className="flex items-center gap-2">
            <DotsSixVertical size={12} className="text-gray-400" />
            <AgentIcon size={14} />
            <span className="text-[12px] font-medium text-gray-700">{tAi("assistantName")}</span>
          </div>
          <button
            onClick={() => setChatOpen(false)}
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-white/40 hover:text-gray-600"
          >
            <X size={12} />
          </button>
        </div>

        {/* Messages */}
        <div className="max-h-[40vh] overflow-y-auto border-t border-white/20">
          {messages.length === 0 && (
            <div className="px-4 py-4 text-center">
              <p className="text-[12px] text-gray-400">{tAi("welcomeTitle")}</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`border-b border-white/10 px-4 py-2.5 ${msg.role === "user" ? "bg-white/10" : ""}`}>
              <div className={`text-[13px] leading-relaxed text-gray-700 ${msg.role === "user" ? "font-medium" : ""}`}>
                {msg.role === "assistant" ? (
                  msg.content ? (
                    <div className={mdClasses}>
                      <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
                    </div>
                  ) : isLoading && i === messages.length - 1 ? (
                    <span className="flex items-center gap-1.5 text-[12px] text-gray-400">
                      <CircleNotch size={12} className="animate-spin" />
                      {tAi("thinking")}
                    </span>
                  ) : null
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-white/20 px-3 py-2">
          <div className="flex items-end gap-2 rounded-xl border border-white/40 bg-white/20 px-3 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={tAi("placeholder")}
              rows={1}
              className="min-h-[28px] max-h-20 flex-1 resize-none bg-transparent text-[13px] text-gray-800 outline-none placeholder:text-gray-400"
            />
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={toggleListening}
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                  isListening ? "bg-red-100 text-red-600" : "text-gray-400 hover:bg-white/40 hover:text-gray-600"
                }`}
              >
                {isListening ? <MicrophoneSlash size={14} /> : <Microphone size={14} />}
              </button>
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-900 text-white transition-colors hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500"
              >
                {isLoading ? <CircleNotch size={12} className="animate-spin" /> : <PaperPlaneRight size={12} weight="fill" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
