"use client";

import { useState, useCallback } from "react";
import { ChatPanel } from "./chat-panel";
import { ChatTrigger } from "./chat-trigger";
import { CommandBar } from "./command-bar";

export function AIChatWrapper() {
  const [chatOpen, setChatOpen] = useState(false);

  const handleOpenChatFromCommand = useCallback((_message: string) => {
    setChatOpen(true);
    // TODO: pre-fill chat with the message
  }, []);

  return (
    <>
      {!chatOpen && <ChatTrigger onClick={() => setChatOpen(true)} />}
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
      <CommandBar onOpenChat={handleOpenChatFromCommand} />
    </>
  );
}
