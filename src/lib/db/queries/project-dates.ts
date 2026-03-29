import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function updateProjectDates(data: {
  projectId: string;
  startDate: string | null;
  endDate: string | null;
}) {
  return db
    .update(projects)
    .set({
      startDate: data.startDate,
      endDate: data.endDate,
    })
    .where(eq(projects.id, data.projectId))
    .returning({ id: projects.id });
}
