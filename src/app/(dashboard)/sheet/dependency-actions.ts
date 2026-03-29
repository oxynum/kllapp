"use server";

import { requireOrgContext } from "@/lib/auth-context";
import { z } from "zod";
import { db } from "@/lib/db";
import { projectDependencies } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const createDependencySchema = z.object({
  sourceProjectId: z.string().uuid(),
  targetProjectId: z.string().uuid(),
});

export async function createDependencyAction(
  input: z.infer<typeof createDependencySchema>
) {
  const { organizationId } = await requireOrgContext();
  const parsed = createDependencySchema.parse(input);

  if (parsed.sourceProjectId === parsed.targetProjectId) {
    throw new Error("Cannot create a dependency to itself");
  }

  await db.insert(projectDependencies).values({
    sourceProjectId: parsed.sourceProjectId,
    targetProjectId: parsed.targetProjectId,
    organizationId,
  });

  revalidatePath("/");
  return { success: true };
}

export async function deleteDependencyAction(dependencyId: string) {
  const { organizationId } = await requireOrgContext();
  const id = z.string().uuid().parse(dependencyId);

  await db
    .delete(projectDependencies)
    .where(
      and(
        eq(projectDependencies.id, id),
        eq(projectDependencies.organizationId, organizationId)
      )
    );

  revalidatePath("/");
  return { success: true };
}
