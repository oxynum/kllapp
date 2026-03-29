"use client";

import { type ComponentProps } from "react";
import { SheetWorkspace } from "./sheet-workspace";
import { SheetRoomProvider } from "./room-provider";

export function ClientSheet(props: ComponentProps<typeof SheetWorkspace>) {
  const { currentOrgId, year } = props;

  if (!currentOrgId) {
    return null;
  }

  return (
    <SheetRoomProvider orgId={currentOrgId} year={year}>
      <SheetWorkspace {...props} />
    </SheetRoomProvider>
  );
}
