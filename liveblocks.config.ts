import { LiveMap, LiveObject } from "@liveblocks/client";

type CellValue = {
  value: string;
  note?: string;
};

type Presence = {
  name: string;
  color: string;
  image?: string;
  cursor: { col: number; row: number } | null;
  visibleRegion: { x: number; y: number; width: number; height: number } | null;
};

type Storage = {
  cells: LiveMap<string, LiveObject<CellValue>>;
};

type UserMeta = {
  id: string;
  info: {
    name: string;
    email: string;
    color: string;
    role: string;
    image?: string;
  };
};

declare global {
  interface Liveblocks {
    Presence: Presence;
    Storage: Storage;
    UserMeta: UserMeta;
  }
}

export {};
