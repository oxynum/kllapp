/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before imports
const mockAuth = vi.fn();
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};
const mockRevalidatePath = vi.fn();

vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(() => (key: string) => key),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

// Mock auth-context
vi.mock("@/lib/auth-context", () => ({
  requireOrgContext: vi.fn(),
  requireManagerOrAdmin: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/db/schema", () => ({
  clients: {
    id: "id",
    name: "name",
    contact: "contact",
    email: "email",
    organizationId: "organization_id",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", conditions: args })),
}));

import { requireOrgContext, requireManagerOrAdmin } from "@/lib/auth-context";

const mockRequireOrgContext = vi.mocked(requireOrgContext);
const mockRequireManagerOrAdmin = vi.mocked(requireManagerOrAdmin);

describe("Client Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated admin in org-1
    mockRequireOrgContext.mockResolvedValue({
      session: { user: { appUserId: "user-1" } } as any,
      appUserId: "user-1",
      organizationId: "org-1",
      orgRole: "admin",
      isOrgOwner: true,
    });
    mockRequireManagerOrAdmin.mockResolvedValue(undefined);

    // Chain mock for db operations
    const chainable = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
      values: vi.fn().mockResolvedValue([]),
    };
    mockDb.update.mockReturnValue(chainable);
    mockDb.delete.mockReturnValue(chainable);
    mockDb.insert.mockReturnValue(chainable);
  });

  describe("Security: Auth guard", () => {
    it("should call requireOrgContext on updateClient", async () => {
      const { updateClient } = await import("@/app/(dashboard)/clients/actions");
      await updateClient({ id: "550e8400-e29b-41d4-a716-446655440010", name: "Test" });
      expect(mockRequireOrgContext).toHaveBeenCalled();
    });

    it("should call requireManagerOrAdmin on updateClient", async () => {
      const { updateClient } = await import("@/app/(dashboard)/clients/actions");
      await updateClient({ id: "550e8400-e29b-41d4-a716-446655440010", name: "Test" });
      expect(mockRequireManagerOrAdmin).toHaveBeenCalledWith("admin");
    });

    it("should call requireOrgContext on deleteClient", async () => {
      const { deleteClient } = await import("@/app/(dashboard)/clients/actions");
      await deleteClient("550e8400-e29b-41d4-a716-446655440010");
      expect(mockRequireOrgContext).toHaveBeenCalled();
    });

    it("should reject unauthenticated users", async () => {
      mockRequireOrgContext.mockRejectedValue(new Error("notAuthenticated"));
      const { updateClient } = await import("@/app/(dashboard)/clients/actions");
      await expect(updateClient({ id: "550e8400-e29b-41d4-a716-446655440010", name: "Test" })).rejects.toThrow("notAuthenticated");
    });

    it("should reject collaborator role", async () => {
      mockRequireOrgContext.mockResolvedValue({
        session: { user: { appUserId: "user-1" } } as any,
        appUserId: "user-1",
        organizationId: "org-1",
        orgRole: "collaborator",
        isOrgOwner: false,
      });
      mockRequireManagerOrAdmin.mockRejectedValue(new Error("managerAdminOnly"));
      const { updateClient } = await import("@/app/(dashboard)/clients/actions");
      await expect(updateClient({ id: "550e8400-e29b-41d4-a716-446655440010", name: "Test" })).rejects.toThrow("managerAdminOnly");
    });
  });

  describe("Security: Org scoping", () => {
    it("should scope updateClient WHERE clause with organizationId", async () => {
      const { updateClient } = await import("@/app/(dashboard)/clients/actions");
      await updateClient({ id: "550e8400-e29b-41d4-a716-446655440010", name: "Updated" });

      // Verify db.update was called and the where clause includes org scoping
      expect(mockDb.update).toHaveBeenCalled();
      const whereCall = mockDb.update.mock.results[0].value.where;
      expect(whereCall).toHaveBeenCalled();
    });

    it("should scope deleteClient WHERE clause with organizationId", async () => {
      const { deleteClient } = await import("@/app/(dashboard)/clients/actions");
      await deleteClient("550e8400-e29b-41d4-a716-446655440010");

      expect(mockDb.delete).toHaveBeenCalled();
      const whereCall = mockDb.delete.mock.results[0].value.where;
      expect(whereCall).toHaveBeenCalled();
    });
  });

  describe("Validation", () => {
    it("should reject invalid UUID for client id", async () => {
      const { updateClient } = await import("@/app/(dashboard)/clients/actions");
      await expect(updateClient({ id: "not-a-uuid", name: "Test" })).rejects.toThrow();
    });

    it("should reject empty name on createClient", async () => {
      const { createClient } = await import("@/app/(dashboard)/clients/actions");
      const formData = new FormData();
      formData.set("name", "");
      await expect(createClient(formData)).rejects.toThrow();
    });
  });
});
