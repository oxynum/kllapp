"use server";

import { requireOrgContext, requireManagerOrAdmin } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const clientSchema = z.object({
  name: z.string().min(1),
  contact: z.string().optional(),
  email: z.string().email().optional(),
  billingRate: z.string().optional(),
});

export async function createClient(formData: FormData) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);

  const parsed = clientSchema.parse({
    name: formData.get("name"),
    contact: formData.get("contact") || undefined,
    email: formData.get("email") || undefined,
    billingRate: formData.get("billingRate") || undefined,
  });

  await db.insert(clients).values({
    name: parsed.name,
    contact: parsed.contact ?? null,
    email: parsed.email ?? null,
    billingRate: parsed.billingRate ?? null,
    organizationId,
  });
  revalidatePath("/clients");
  revalidatePath("/");
}

const updateClientSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  contact: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
});

export async function updateClient(input: z.infer<typeof updateClientSchema>) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);
  const parsed = updateClientSchema.parse(input);
  const { id, ...fields } = parsed;

  const set: Record<string, unknown> = {};
  if (fields.name !== undefined) set.name = fields.name;
  if (fields.contact !== undefined) set.contact = fields.contact;
  if (fields.email !== undefined) set.email = fields.email;

  if (Object.keys(set).length > 0) {
    await db.update(clients).set(set).where(and(eq(clients.id, id), eq(clients.organizationId, organizationId)));
  }

  revalidatePath("/clients");
  revalidatePath("/");
}

export async function deleteClient(id: string) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);

  await db.delete(clients).where(and(eq(clients.id, id), eq(clients.organizationId, organizationId)));
  revalidatePath("/clients");
}
