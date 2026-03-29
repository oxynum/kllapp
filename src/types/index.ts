export interface SheetRow {
  id: string;
  type: "client" | "project" | "sub-project" | "user" | "total" | "absence" | "expense" | "add-client-placeholder" | "absence-client" | "absence-type" | "absence-user" | "absence-total" | "add-absence-placeholder" | "calendar" | "add-calendar-placeholder";
  label: string;
  parentId?: string;
  depth: number;
  isExpanded?: boolean;
  userId?: string;
  projectId?: string;
  clientId?: string;
  dailyRate?: number;
  dailyCost?: number;
  hoursPerDay?: number;
  hasSubProjects?: boolean;
  billable?: boolean;
  userImage?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isAbsence?: boolean;
  calendarIntegrationId?: string;
  calendarProvider?: string;
  calendarColor?: string;
  calendarOwnerName?: string;
  defaultWorkplaceId?: string | null;
  budget?: number;
}

export interface SheetFilters {
  clientIds: Set<string>;
  projectIds: Set<string>;
  userIds: Set<string>;
}

export type DisplayMode = "days" | "hours";
export type ViewMode = "spreadsheet" | "gantt" | "workplace";

// Panel state for inline sheet management
export type PanelMode =
  | { type: "closed" }
  | { type: "assign-user"; projectId: string; projectName: string; clientName: string }
  | { type: "add-project"; clientId: string; clientName: string }
  | { type: "add-client" }
  | { type: "user-detail"; userId: string; projectId: string; userName: string }
  | { type: "add-user" }
  | { type: "add-sub-project"; projectId: string; projectName: string; clientName: string }
  | { type: "project-detail"; projectId: string; projectName: string; clientName: string }
  | { type: "client-detail"; clientId: string; clientName: string }
  | { type: "add-absence-client" }
  | { type: "add-absence-type"; clientId: string; clientName: string }
  | { type: "assign-absence-user"; projectId: string; projectName: string; clientName: string }
  | { type: "absence-client-detail"; clientId: string; clientName: string }
  | { type: "absence-type-detail"; projectId: string; projectName: string; clientName: string }
  | { type: "add-calendar" }
  | { type: "calendar-detail"; integrationId: string; integrationLabel: string }
  | { type: "calendar-events"; integrationId: string; integrationLabel: string; date: string }
  | { type: "desk-booking"; userId: string; date: string; workplaceId: string; userName: string };

// Data types exposed from getSheetStructure for panel usage
export interface UserInfo {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  dailyCost: string | null;
  hoursPerDay: string | null;
  image: string | null;
}

export interface ClientInfo {
  id: string;
  name: string;
  contact: string | null;
  email: string | null;
}

export interface AssignmentInfo {
  id: string;
  projectId: string;
  userId: string;
  dailyRate: string | null;
  dailyCost: string | null;
}

export interface DependencyInfo {
  id: string;
  sourceProjectId: string;
  targetProjectId: string;
}

export interface CalendarEventInfo {
  uid: string;
  summary: string;
  description?: string;
  htmlDescription?: string;
  location?: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
}

export interface WorkplaceInfo {
  id: string;
  name: string;
  type: "remote" | "office" | "client";
  color: string | null;
  address: string | null;
  sortOrder: number | null;
  hasFloorPlan?: boolean;
}

// ─── Floor plan & desk booking types ────────────────────────────

export type FloorPlanElementType = "room" | "wall" | "corridor" | "door" | "label";

export interface FloorPlanElement {
  id: string;
  type: FloorPlanElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  points?: number[];
  name?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeStyle?: "solid" | "dashed" | "dotted" | "none";
  groupId?: string | null;
  visible?: boolean;
  locked?: boolean;
  flipX?: boolean;
  flipY?: boolean;
}

export type EditorTool = "select" | "room" | "wall" | "door" | "desk" | "label" | "delete";
export type GridStyle = "lines" | "dots" | "none";

export interface LayerGroup {
  id: string;
  name: string;
  isExpanded: boolean;
  visible: boolean;
  locked: boolean;
}

/** Unified item for the layers panel — elements + desks share the same list */
export type LayerItem =
  | { kind: "element"; data: FloorPlanElement }
  | { kind: "desk"; data: DeskData }
  | { kind: "group"; data: LayerGroup };

export interface DeskData {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  isAvailable: boolean;
  zone?: string | null;
  groupId?: string | null;
  visible?: boolean;
  locked?: boolean;
}

export interface FloorPlanData {
  id: string;
  workplaceId: string;
  name: string;
  floorNumber: number;
  layout: FloorPlanElement[];
  width: number;
  height: number;
  desks: DeskData[];
}

export type DeskBookingStatus = "available" | "booked" | "team" | "yours" | "unavailable";

export interface DeskWithBooking extends DeskData {
  status: DeskBookingStatus;
  bookedByUserId?: string | null;
  bookedByUserName?: string | null;
  bookedByUserImage?: string | null;
}

export interface CalendarIntegrationInfo {
  id: string;
  label: string;
  provider: string;
  color?: string | null;
  isEnabled: boolean;
  ownerName?: string;
  isSharedWithMe?: boolean;
  sharedWithUserIds?: string[];
}

export interface ExpenseData {
  id: string;
  userId: string | null;
  projectId: string | null;
  date: string;
  amount: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  attachmentUrl: string | null;
}

export interface ProjectInfo {
  id: string;
  name: string;
  clientId: string | null;
  parentId: string | null;
  type: string | null;
  dailyRate: string | null;
  budget: string | null;
  status: string | null;
  billable: boolean;
  startDate: string | null;
  endDate: string | null;
}
