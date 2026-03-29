import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockOnConflictDoUpdate = vi.fn();
const mockReturning = vi.fn();
const mockDelete = vi.fn();
const mockWhere = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  timeEntries: {
    id: "id",
    userId: "user_id",
    projectId: "project_id",
    date: "date",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => ({ type: "and", conditions: args })),
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
}));

describe("Time Entries - Upsert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
    mockOnConflictDoUpdate.mockReturnValue({ returning: mockReturning });
    mockReturning.mockResolvedValue([{ id: "te-1" }]);

    mockDelete.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue([]);
  });

  it("should use onConflictDoUpdate for upsert (atomic operation)", async () => {
    const { upsertTimeEntry } = await import("@/lib/db/queries/time-entries");

    await upsertTimeEntry({
      userId: "user-1",
      projectId: "project-1",
      date: "2024-01-15",
      value: "1",
      type: "worked",
    });

    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        projectId: "project-1",
        date: "2024-01-15",
        value: "1",
        type: "worked",
      })
    );
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.any(Array),
        set: expect.objectContaining({
          value: "1",
          type: "worked",
        }),
      })
    );
  });

  it("should use onConflictDoUpdate for note upsert", async () => {
    const { upsertTimeEntryNote } = await import("@/lib/db/queries/time-entries");

    await upsertTimeEntryNote({
      userId: "user-1",
      projectId: "project-1",
      date: "2024-01-15",
      note: "Test note",
    });

    expect(mockInsert).toHaveBeenCalled();
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        set: expect.objectContaining({ note: "Test note" }),
      })
    );
  });

  it("should delete entry correctly", async () => {
    const { deleteTimeEntry } = await import("@/lib/db/queries/time-entries");

    await deleteTimeEntry("user-1", "project-1", "2024-01-15");

    expect(mockDelete).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
  });
});
