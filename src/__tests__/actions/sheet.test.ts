/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};
const mockRevalidatePath = vi.fn();

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(() => (key: string) => key),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));

const mockUpsertTimeEntry = vi.fn().mockResolvedValue([{ id: "te-1" }]);
const mockUpsertTimeEntryNote = vi.fn().mockResolvedValue([{ id: "te-1" }]);
const mockDeleteTimeEntry = vi.fn().mockResolvedValue(undefined);
const mockUpdateProjectDates = vi.fn().mockResolvedValue([{ id: "p-1" }]);

vi.mock("@/lib/db/queries/time-entries", () => ({
  upsertTimeEntry: (...args: unknown[]) => mockUpsertTimeEntry(...args),
  upsertTimeEntryNote: (...args: unknown[]) => mockUpsertTimeEntryNote(...args),
  deleteTimeEntry: (...args: unknown[]) => mockDeleteTimeEntry(...args),
}));

vi.mock("@/lib/db/queries/project-dates", () => ({
  updateProjectDates: (...args: unknown[]) => mockUpdateProjectDates(...args),
}));

vi.mock("@/lib/db/schema", () => ({
  projects: { id: "id", organizationId: "organization_id" },
  organizationMembers: {
    id: "id",
    userId: "user_id",
    organizationId: "organization_id",
    status: "status",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", conditions: args })),
  ne: vi.fn((a, b) => ({ type: "ne", field: a, value: b })),
}));

// Mock requireOrgContext
vi.mock("@/lib/auth-context", () => ({
  requireOrgContext: vi.fn(),
  requireManagerOrAdmin: vi.fn(),
}));

import { requireOrgContext, requireManagerOrAdmin } from "@/lib/auth-context";

const mockRequireOrgContext = vi.mocked(requireOrgContext);
const mockRequireManagerOrAdmin = vi.mocked(requireManagerOrAdmin);

describe("Sheet Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockRequireOrgContext.mockResolvedValue({
      session: { user: { appUserId: "user-1" } } as any,
      appUserId: "user-1",
      organizationId: "org-1",
      orgRole: "admin",
      isOrgOwner: true,
    });
    mockRequireManagerOrAdmin.mockResolvedValue(undefined);

    // Mock project verification
    const selectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: "project-1" }]),
      }),
    };
    mockDb.select.mockReturnValue(selectChain);
  });

  describe("updateCellAction", () => {
    it("should require authentication", async () => {
      mockRequireOrgContext.mockRejectedValue(new Error("notAuthenticated"));
      const { updateCellAction } = await import("@/app/(dashboard)/sheet/actions");
      await expect(
        updateCellAction({
          userId: "550e8400-e29b-41d4-a716-446655440000",
          projectId: "550e8400-e29b-41d4-a716-446655440001",
          date: "2024-01-15",
          value: "1",
          type: "worked",
        })
      ).rejects.toThrow("notAuthenticated");
    });

    it("should reject invalid date format", async () => {
      const { updateCellAction } = await import("@/app/(dashboard)/sheet/actions");
      await expect(
        updateCellAction({
          userId: "550e8400-e29b-41d4-a716-446655440000",
          projectId: "550e8400-e29b-41d4-a716-446655440001",
          date: "15-01-2024",
          value: "1",
          type: "worked",
        })
      ).rejects.toThrow();
    });

    it("should reject invalid time entry type", async () => {
      const { updateCellAction } = await import("@/app/(dashboard)/sheet/actions");
      await expect(
        updateCellAction({
          userId: "550e8400-e29b-41d4-a716-446655440000",
          projectId: "550e8400-e29b-41d4-a716-446655440001",
          date: "2024-01-15",
          value: "1",
          type: "invalid" as any,
        })
      ).rejects.toThrow();
    });
  });

  describe("Security: Collaborator restrictions", () => {
    it("should prevent collaborator from editing other users' entries", async () => {
      mockRequireOrgContext.mockResolvedValue({
        session: { user: { appUserId: "user-1" } } as any,
        appUserId: "user-1",
        organizationId: "org-1",
        orgRole: "collaborator",
        isOrgOwner: false,
      });

      const { updateCellAction } = await import("@/app/(dashboard)/sheet/actions");
      await expect(
        updateCellAction({
          userId: "550e8400-e29b-41d4-a716-446655440099", // different user
          projectId: "550e8400-e29b-41d4-a716-446655440001",
          date: "2024-01-15",
          value: "1",
          type: "worked",
        })
      ).rejects.toThrow("Cannot edit other users' entries");
    });

    it("should prevent collaborator from editing other users' notes", async () => {
      mockRequireOrgContext.mockResolvedValue({
        session: { user: { appUserId: "user-1" } } as any,
        appUserId: "user-1",
        organizationId: "org-1",
        orgRole: "collaborator",
        isOrgOwner: false,
      });

      const { updateNoteAction } = await import("@/app/(dashboard)/sheet/actions");
      await expect(
        updateNoteAction({
          userId: "550e8400-e29b-41d4-a716-446655440099",
          projectId: "550e8400-e29b-41d4-a716-446655440001",
          date: "2024-01-15",
          note: "test",
        })
      ).rejects.toThrow("Cannot edit other users' notes");
    });
  });

  describe("updateProjectDatesAction", () => {
    it("should require manager/admin role", async () => {
      mockRequireOrgContext.mockResolvedValue({
        session: { user: { appUserId: "user-1" } } as any,
        appUserId: "user-1",
        organizationId: "org-1",
        orgRole: "collaborator",
        isOrgOwner: false,
      });
      mockRequireManagerOrAdmin.mockRejectedValue(new Error("managerAdminOnly"));

      const { updateProjectDatesAction } = await import("@/app/(dashboard)/sheet/actions");
      await expect(
        updateProjectDatesAction({
          projectId: "550e8400-e29b-41d4-a716-446655440001",
          startDate: "2024-01-01",
          endDate: "2024-12-31",
        })
      ).rejects.toThrow("managerAdminOnly");
    });
  });
});
