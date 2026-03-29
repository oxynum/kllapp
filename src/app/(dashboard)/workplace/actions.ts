"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { workplaces, userWorkplaces, deskBookings, desks, floorPlans, users, authUsers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireOrgContext, requireManagerOrAdmin } from "@/lib/auth-context";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["remote", "office", "client"]),
  address: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  color: z.string().optional(),
});

export async function createWorkplace(input: z.infer<typeof createSchema>) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);
  const parsed = createSchema.parse(input);

  // Get max sort order
  const existing = await db
    .select({ sortOrder: workplaces.sortOrder })
    .from(workplaces)
    .where(eq(workplaces.organizationId, organizationId))
    .orderBy(workplaces.sortOrder);

  const maxOrder = existing.length > 0 ? Math.max(...existing.map(e => e.sortOrder ?? 0)) : -1;

  const [workplace] = await db
    .insert(workplaces)
    .values({
      organizationId,
      name: parsed.name,
      type: parsed.type,
      address: parsed.address || null,
      latitude: parsed.latitude || null,
      longitude: parsed.longitude || null,
      color: parsed.color || null,
      sortOrder: maxOrder + 1,
    })
    .returning();

  revalidatePath("/");
  return workplace;
}

export async function updateWorkplace(id: string, input: Partial<z.infer<typeof createSchema>>) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);

  await db
    .update(workplaces)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(workplaces.id, id), eq(workplaces.organizationId, organizationId)));

  revalidatePath("/");
}

export async function deleteWorkplace(id: string) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);

  await db
    .delete(workplaces)
    .where(and(eq(workplaces.id, id), eq(workplaces.organizationId, organizationId)));

  revalidatePath("/");
}

export async function getWorkplaces() {
  const { organizationId } = await requireOrgContext();

  return db
    .select({
      id: workplaces.id,
      name: workplaces.name,
      type: workplaces.type,
      address: workplaces.address,
      latitude: workplaces.latitude,
      longitude: workplaces.longitude,
      color: workplaces.color,
      sortOrder: workplaces.sortOrder,
    })
    .from(workplaces)
    .where(eq(workplaces.organizationId, organizationId))
    .orderBy(workplaces.sortOrder);
}

// ─── User workplace assignment ────────────────────────────

const assignSchema = z.object({
  userId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  workplaceId: z.string().uuid(),
});

export async function setUserWorkplace(input: z.infer<typeof assignSchema>) {
  const { organizationId } = await requireOrgContext();
  const parsed = assignSchema.parse(input);

  await db
    .insert(userWorkplaces)
    .values({
      userId: parsed.userId,
      workplaceId: parsed.workplaceId,
      organizationId,
      date: parsed.date,
    })
    .onConflictDoUpdate({
      target: [userWorkplaces.userId, userWorkplaces.date],
      set: { workplaceId: parsed.workplaceId },
    });

  revalidatePath("/");
}

export async function removeUserWorkplace(userId: string, date: string) {
  const { organizationId } = await requireOrgContext();

  await db
    .delete(userWorkplaces)
    .where(
      and(
        eq(userWorkplaces.userId, userId),
        eq(userWorkplaces.date, date),
        eq(userWorkplaces.organizationId, organizationId)
      )
    );

  revalidatePath("/");
}

// ─── Desk booking ───────────────────────────────────────────

const bookDeskSchema = z.object({
  deskId: z.string().uuid(),
  userId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function bookDesk(input: z.infer<typeof bookDeskSchema>) {
  const { organizationId, appUserId, orgRole } = await requireOrgContext();
  const parsed = bookDeskSchema.parse(input);

  // Collaborators can only book for themselves
  if (orgRole === "collaborator" && parsed.userId !== appUserId) {
    throw new Error("Cannot book desk for another user");
  }

  // Verify desk exists and belongs to this org
  const [desk] = await db
    .select({ id: desks.id, floorPlanId: desks.floorPlanId, isAvailable: desks.isAvailable })
    .from(desks)
    .where(and(eq(desks.id, parsed.deskId), eq(desks.organizationId, organizationId)));

  if (!desk) throw new Error("Desk not found");
  if (!desk.isAvailable) throw new Error("Desk is not available");

  // Get workplace ID from floor plan
  const [plan] = await db
    .select({ workplaceId: floorPlans.workplaceId })
    .from(floorPlans)
    .where(eq(floorPlans.id, desk.floorPlanId));

  if (!plan) throw new Error("Floor plan not found");

  // Insert booking (unique index prevents double-booking)
  try {
    await db.insert(deskBookings).values({
      deskId: parsed.deskId,
      userId: parsed.userId,
      organizationId,
      date: parsed.date,
      bookedBy: appUserId,
    });
  } catch {
    throw new Error("This desk is already booked for this date");
  }

  // Also set user workplace for that day
  await db
    .insert(userWorkplaces)
    .values({
      userId: parsed.userId,
      workplaceId: plan.workplaceId,
      organizationId,
      date: parsed.date,
    })
    .onConflictDoUpdate({
      target: [userWorkplaces.userId, userWorkplaces.date],
      set: { workplaceId: plan.workplaceId },
    });

  revalidatePath("/");
}

export async function cancelDeskBooking(input: { userId: string; date: string }) {
  const { organizationId, appUserId, orgRole } = await requireOrgContext();

  // Collaborators can only cancel their own bookings
  if (orgRole === "collaborator" && input.userId !== appUserId) {
    throw new Error("Cannot cancel another user's booking");
  }

  await db
    .delete(deskBookings)
    .where(
      and(
        eq(deskBookings.userId, input.userId),
        eq(deskBookings.date, input.date),
        eq(deskBookings.organizationId, organizationId)
      )
    );

  revalidatePath("/");
}

export async function getDeskAvailability(input: { floorPlanId: string; date: string }) {
  const { organizationId } = await requireOrgContext();

  // Get all desks for this floor plan
  const allDesks = await db
    .select({
      id: desks.id,
      label: desks.label,
      x: desks.x,
      y: desks.y,
      width: desks.width,
      height: desks.height,
      rotation: desks.rotation,
      isAvailable: desks.isAvailable,
      zone: desks.zone,
    })
    .from(desks)
    .where(
      and(
        eq(desks.floorPlanId, input.floorPlanId),
        eq(desks.organizationId, organizationId)
      )
    );

  // Get all bookings for this date on these desks
  const deskIds = allDesks.map((d) => d.id);
  let bookingsForDate: { deskId: string; userId: string; userName: string | null; userImage: string | null }[] = [];

  if (deskIds.length > 0) {
    const rawBookings = await db
      .select({
        deskId: deskBookings.deskId,
        userId: deskBookings.userId,
        userName: users.name,
        userImage: authUsers.image,
      })
      .from(deskBookings)
      .innerJoin(users, eq(deskBookings.userId, users.id))
      .leftJoin(authUsers, eq(users.authUserId, authUsers.id))
      .where(
        and(
          eq(deskBookings.date, input.date),
          eq(deskBookings.organizationId, organizationId)
        )
      );

    bookingsForDate = rawBookings.filter((b) => deskIds.includes(b.deskId));
  }

  const bookingMap = new Map(bookingsForDate.map((b) => [b.deskId, b]));

  return allDesks.map((desk) => {
    const booking = bookingMap.get(desk.id);
    return {
      id: desk.id,
      label: desk.label,
      x: Number(desk.x),
      y: Number(desk.y),
      width: Number(desk.width),
      height: Number(desk.height),
      rotation: Number(desk.rotation),
      isAvailable: desk.isAvailable ?? true,
      zone: desk.zone,
      bookedByUserId: booking?.userId ?? null,
      bookedByUserName: booking?.userName ?? null,
      bookedByUserImage: booking?.userImage ?? null,
    };
  });
}

export async function assignDeskToUser(input: z.infer<typeof bookDeskSchema>) {
  const { orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);
  return bookDesk(input);
}
