"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { DisplayMode, ViewMode } from "@/types";

const DisplayModeContext = createContext<{
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}>({
  displayMode: "days",
  setDisplayMode: () => {},
  viewMode: "spreadsheet",
  setViewMode: () => {},
});

export function DisplayModeProvider({ children }: { children: ReactNode }) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>("days");
  const [viewMode, setViewMode] = useState<ViewMode>("spreadsheet");

  return (
    <DisplayModeContext.Provider value={{ displayMode, setDisplayMode, viewMode, setViewMode }}>
      {children}
    </DisplayModeContext.Provider>
  );
}

export function useDisplayMode() {
  return useContext(DisplayModeContext);
}
