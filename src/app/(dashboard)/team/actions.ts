"use server";

import { requireOrgContext, requireManagerOrAdmin } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { users, organizationMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["admin", "manager", "collaborator"]).default("collaborator"),
  dailyCost: z.string().optional(),
  hoursPerDay: z.string().optional(),
});

export async function createUser(formData: FormData) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);

  const parsed = userSchema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role") || "collaborator",
    dailyCost: formData.get("dailyCost") || undefined,
    hoursPerDay: formData.get("hoursPerDay") || undefined,
  });

  // Check if user with this email already exists
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.email));

  let userId: string;

  if (existing) {
    userId = existing.id;
    // Update fields if provided
    await db.update(users).set({
      name: parsed.name,
      dailyCost: parsed.dailyCost ?? null,
      hoursPerDay: parsed.hoursPerDay ?? "7",
    }).where(eq(users.id, userId));
  } else {
    const [newUser] = await db.insert(users).values({
      name: parsed.name,
      email: parsed.email,
      role: parsed.role,
      dailyCost: parsed.dailyCost ?? null,
      hoursPerDay: parsed.hoursPerDay ?? "7",
    }).returning({ id: users.id });
    userId = newUser.id;
  }

  // Check if membership already exists
  const [existingMember] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.email, parsed.email)
      )
    );

  if (!existingMember) {
    await db.insert(organizationMembers).values({
      organizationId,
      userId,
      email: parsed.email,
      role: parsed.role,
      status: "active",
    });
  }

  revalidatePath("/team");
  revalidatePath("/");
}

const updateUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["admin", "manager", "collaborator"]).optional(),
  dailyCost: z.string().nullable().optional(),
  hoursPerDay: z.string().nullable().optional(),
  defaultWorkplaceId: z.string().uuid().nullable().optional(),
  memberStatus: z.enum(["pending", "active"]).optional(),
});

export async function updateUser(input: z.infer<typeof updateUserSchema>) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);
  const parsed = updateUserSchema.parse(input);
  const { id, ...fields } = parsed;

  // Verify user is a member of this org
  const [membership] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, id),
        eq(organizationMembers.organizationId, organizationId),
      )
    );
  if (!membership) throw new Error("User not found in organization");

  // Update global user fields (name, email, dailyCost, hoursPerDay)
  const userSet: Record<string, unknown> = {};
  if (fields.name !== undefined) userSet.name = fields.name;
  if (fields.email !== undefined) userSet.email = fields.email;
  if (fields.dailyCost !== undefined) userSet.dailyCost = fields.dailyCost;
  if (fields.hoursPerDay !== undefined) userSet.hoursPerDay = fields.hoursPerDay;
  if (fields.defaultWorkplaceId !== undefined) userSet.defaultWorkplaceId = fields.defaultWorkplaceId;

  if (Object.keys(userSet).length > 0) {
    await db.update(users).set(userSet).where(eq(users.id, id));
  }

  // Update org-scoped fields (role, memberStatus) on the membership
  const memberSet: Record<string, unknown> = {};
  if (fields.role !== undefined) memberSet.role = fields.role;
  if (fields.memberStatus !== undefined) memberSet.status = fields.memberStatus;

  if (Object.keys(memberSet).length > 0) {
    await db.update(organizationMembers).set(memberSet).where(eq(organizationMembers.id, membership.id));
  }

  revalidatePath("/team");
  revalidatePath("/");
}

const sendInvitationSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendInvitation(input: z.infer<typeof sendInvitationSchema>) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);
  const parsed = sendInvitationSchema.parse(input);

  // Fetch org name for email context
  const { organizations } = await import("@/lib/db/schema");
  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId));

  const orgName = org?.name ?? "KLLAPP";

  // Determine recipient locale
  const [recipient] = await db
    .select({ locale: users.locale })
    .from(users)
    .where(eq(users.email, parsed.email));
  const recipientLocale = recipient?.locale ?? "fr";

  // Validate locale before dynamic import (security: prevent path traversal)
  const validLocales = ["fr", "en"];
  const safeLocale = validLocales.includes(recipientLocale) ? recipientLocale : "fr";

  const messages = (await import(`@/messages/${safeLocale}.json`)).default;
  const emailT = messages.email.invitation;

  const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (!baseUrl) throw new Error("AUTH_URL environment variable is not configured");
  const loginUrl = `${baseUrl}/login`;

  const safeName = escapeHtml(parsed.name);
  const safeOrgName = escapeHtml(orgName);

  const subject = emailT.subject.replace("{orgName}", orgName);
  const greeting = emailT.greeting.replace("{name}", safeName);
  const body = emailT.body.replace("{orgName}", safeOrgName);

  const { emailLogs } = await import("@/lib/db/schema");
  const { appUserId } = await requireOrgContext();

  const { sendEmail } = await import("@/lib/email");
  await sendEmail({
    to: parsed.email,
    subject,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111827; margin-bottom: 16px;">${greeting}</h2>
        <p style="color: #4b5563; line-height: 1.6;">
          ${body}
        </p>
        <p style="color: #4b5563; line-height: 1.6;">
          ${emailT.cta}
        </p>
        <a href="${loginUrl}" style="display: inline-block; background: #111827; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 16px 0;">
          ${emailT.button}
        </a>
        <p style="color: #9ca3af; font-size: 13px; margin-top: 24px;">
          ${emailT.footer}
        </p>
      </div>
    `,
  });

  // Log the email for admin tracking
  await db.insert(emailLogs).values({
    category: "invitation",
    recipientEmail: parsed.email,
    organizationId,
    sentBy: appUserId,
    subject,
  });
}

export async function deleteUser(id: string) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);

  // Remove org membership instead of deleting user entirely
  await db
    .delete(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, id),
        eq(organizationMembers.organizationId, organizationId)
      )
    );

  revalidatePath("/team");
  revalidatePath("/");
}
