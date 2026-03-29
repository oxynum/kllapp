import { db } from "@/lib/db";
import { timeEntries } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function upsertTimeEntry(data: {
  userId: string;
  projectId: string;
  date: string;
  value: string;
  type: "worked" | "forecast" | "pipeline";
  probability?: number;
  note?: string;
}) {
  return db
    .insert(timeEntries)
    .values(data)
    .onConflictDoUpdate({
      target: [timeEntries.userId, timeEntries.projectId, timeEntries.date],
      set: {
        value: data.value,
        type: data.type,
        probability: data.probability,
        note: data.note,
      },
    })
    .returning();
}

export async function upsertTimeEntryNote(data: {
  userId: string;
  projectId: string;
  date: string;
  note: string | null;
}) {
  return db
    .insert(timeEntries)
    .values({
      userId: data.userId,
      projectId: data.projectId,
      date: data.date,
      value: "0",
      type: "worked",
      note: data.note,
    })
    .onConflictDoUpdate({
      target: [timeEntries.userId, timeEntries.projectId, timeEntries.date],
      set: { note: data.note },
    })
    .returning();
}

export async function deleteTimeEntry(
  userId: string,
  projectId: string,
  date: string
) {
  return db
    .delete(timeEntries)
    .where(
      and(
        eq(timeEntries.userId, userId),
        eq(timeEntries.projectId, projectId),
        eq(timeEntries.date, date)
      )
    );
}
