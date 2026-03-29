"use client";

import { Robot, User } from "@phosphor-icons/react";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";

  if (!message.content) return null;

  const htmlContent = isUser
    ? null
    : DOMPurify.sanitize(marked.parse(message.content) as string);

  return (
    <div className={`mb-3 flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
          isUser ? "bg-gray-100" : "bg-violet-100"
        }`}
      >
        {isUser ? (
          <User size={13} weight="fill" className="text-gray-500" />
        ) : (
          <Robot size={13} weight="fill" className="text-violet-600" />
        )}
      </div>

      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-gray-900 text-white"
            : "bg-gray-50 text-gray-800"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div
            className="ai-response prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-code:text-violet-700 prose-code:bg-violet-50 prose-code:rounded prose-code:px-1 prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-table:text-xs"
            dangerouslySetInnerHTML={{ __html: htmlContent! }}
          />
        )}
      </div>
    </div>
  );
}
