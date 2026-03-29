"use client";

import { ReactNode } from "react";
import { RoomProvider, ClientSideSuspense } from "@liveblocks/react/suspense";
import { LiveMap } from "@liveblocks/client";
import { KllappLogo } from "@/components/ui/kllapp-logo";

export function SheetRoomProvider({
  orgId,
  year,
  children,
}: {
  orgId: string;
  year: number;
  children: ReactNode;
}) {
  return (
    <RoomProvider
      id={`kllapp:${orgId}:sheet-${year}`}
      initialPresence={{ name: "", color: "", cursor: null, visibleRegion: null }}
      initialStorage={{ cells: new LiveMap() }}
    >
      <ClientSideSuspense
        fallback={
          <div className="flex h-full flex-col items-center justify-center gap-5">
            <KllappLogo className="h-6 w-auto text-gray-900" color="currentColor" />
            <span className="text-sm text-gray-400">Chargement</span>
          </div>
        }
      >
        {children}
      </ClientSideSuspense>
    </RoomProvider>
  );
}
