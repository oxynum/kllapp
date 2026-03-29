"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { floorPlans, desks } from "@/lib/db/schema";
import { eq, and, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireOrgContext, requireManagerOrAdmin } from "@/lib/auth-context";
import type { FloorPlanElement, LayerGroup } from "@/types";

// ─── Schemas ────────────────────────────────────────────────

const floorPlanElementSchema = z.object({
  id: z.string(),
  type: z.enum(["room", "wall", "corridor", "door", "label"]),
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  rotation: z.number().optional(),
  points: z.array(z.number()).optional(),
  name: z.string().optional(),
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  strokeStyle: z.enum(["solid", "dashed", "dotted", "none"]).optional(),
  groupId: z.string().nullable().optional(),
  visible: z.boolean().optional(),
  locked: z.boolean().optional(),
  flipX: z.boolean().optional(),
  flipY: z.boolean().optional(),
});

const layerGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  isExpanded: z.boolean().default(true),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
});

const deskInputSchema = z.object({
  id: z.string().optional(), // undefined = new desk
  label: z.string().min(1),
  x: z.number(),
  y: z.number(),
  width: z.number().default(60),
  height: z.number().default(40),
  rotation: z.number().default(0),
  isAvailable: z.boolean().default(true),
  zone: z.string().nullable().optional(),
  groupId: z.string().nullable().optional(),
  visible: z.boolean().optional(),
  locked: z.boolean().optional(),
});

const saveSchema = z.object({
  workplaceId: z.string().uuid(),
  floorPlanId: z.string().uuid().optional(), // undefined = create
  name: z.string().min(1).max(100),
  floorNumber: z.number().int().min(0),
  width: z.number().int().min(200).max(4000),
  height: z.number().int().min(200).max(2000),
  layout: z.array(floorPlanElementSchema),
  groups: z.array(layerGroupSchema).default([]),
  desks: z.array(deskInputSchema),
});

// ─── Layout JSONB structure ─────────────────────────────────
// Stored as { elements: FloorPlanElement[], groups: LayerGroup[] }
// For backward compat, if the stored value is an array, treat it as elements only.

interface LayoutData {
  elements: FloorPlanElement[];
  groups: LayerGroup[];
}

function parseLayout(raw: unknown): LayoutData {
  if (Array.isArray(raw)) {
    // Old format: plain array of elements
    return { elements: raw as FloorPlanElement[], groups: [] };
  }
  if (raw && typeof raw === "object" && "elements" in raw) {
    const obj = raw as { elements: FloorPlanElement[]; groups?: LayerGroup[] };
    return { elements: obj.elements ?? [], groups: obj.groups ?? [] };
  }
  return { elements: [], groups: [] };
}

function serializeLayout(elements: FloorPlanElement[], groups: LayerGroup[]): unknown {
  return { elements, groups };
}

// ─── Save floor plan (upsert) ───────────────────────────────

export async function saveFloorPlan(input: z.infer<typeof saveSchema>) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);
  const parsed = saveSchema.parse(input);

  const layoutData = serializeLayout(
    parsed.layout as unknown as FloorPlanElement[],
    parsed.groups as unknown as LayerGroup[]
  );

  let floorPlanId: string;

  if (parsed.floorPlanId) {
    // Update existing floor plan
    await db
      .update(floorPlans)
      .set({
        name: parsed.name,
        floorNumber: parsed.floorNumber,
        layout: layoutData,
        width: parsed.width,
        height: parsed.height,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(floorPlans.id, parsed.floorPlanId),
          eq(floorPlans.organizationId, organizationId)
        )
      );
    floorPlanId = parsed.floorPlanId;
  } else {
    // Create new floor plan
    const [created] = await db
      .insert(floorPlans)
      .values({
        workplaceId: parsed.workplaceId,
        organizationId,
        name: parsed.name,
        floorNumber: parsed.floorNumber,
        layout: layoutData,
        width: parsed.width,
        height: parsed.height,
      })
      .returning({ id: floorPlans.id });
    floorPlanId = created.id;
  }

  // Sync desks: upsert all (handles both new and existing desks)
  const deskIdsToKeep: string[] = [];

  for (const desk of parsed.desks) {
    const [upserted] = await db
      .insert(desks)
      .values({
        id: desk.id || undefined,
        floorPlanId,
        organizationId,
        label: desk.label,
        x: String(desk.x),
        y: String(desk.y),
        width: String(desk.width),
        height: String(desk.height),
        rotation: String(desk.rotation),
        isAvailable: desk.isAvailable,
        zone: desk.zone ?? null,
        groupId: desk.groupId ?? null,
        visible: desk.visible ?? true,
        locked: desk.locked ?? false,
      })
      .onConflictDoUpdate({
        target: desks.id,
        set: {
          label: desk.label,
          x: String(desk.x),
          y: String(desk.y),
          width: String(desk.width),
          height: String(desk.height),
          rotation: String(desk.rotation),
          isAvailable: desk.isAvailable,
          zone: desk.zone ?? null,
          groupId: desk.groupId ?? null,
          visible: desk.visible ?? true,
          locked: desk.locked ?? false,
          updatedAt: new Date(),
        },
      })
      .returning({ id: desks.id });
    deskIdsToKeep.push(upserted.id);
  }

  // Delete desks that are no longer in the plan
  if (deskIdsToKeep.length > 0) {
    await db
      .delete(desks)
      .where(
        and(
          eq(desks.floorPlanId, floorPlanId),
          notInArray(desks.id, deskIdsToKeep)
        )
      );
  } else {
    // All desks removed
    await db.delete(desks).where(eq(desks.floorPlanId, floorPlanId));
  }

  revalidatePath("/");
  return { floorPlanId };
}

// ─── Get floor plans for a workplace ────────────────────────

export async function getFloorPlans(workplaceId: string) {
  const { organizationId } = await requireOrgContext();

  const plans = await db
    .select({
      id: floorPlans.id,
      workplaceId: floorPlans.workplaceId,
      name: floorPlans.name,
      floorNumber: floorPlans.floorNumber,
      layout: floorPlans.layout,
      width: floorPlans.width,
      height: floorPlans.height,
    })
    .from(floorPlans)
    .where(
      and(
        eq(floorPlans.workplaceId, workplaceId),
        eq(floorPlans.organizationId, organizationId)
      )
    )
    .orderBy(floorPlans.floorNumber);

  return plans;
}

// ─── Get floor plan with desks ──────────────────────────────

export async function getFloorPlanWithDesks(floorPlanId: string) {
  const { organizationId } = await requireOrgContext();

  const [plan] = await db
    .select({
      id: floorPlans.id,
      workplaceId: floorPlans.workplaceId,
      name: floorPlans.name,
      floorNumber: floorPlans.floorNumber,
      layout: floorPlans.layout,
      width: floorPlans.width,
      height: floorPlans.height,
    })
    .from(floorPlans)
    .where(
      and(
        eq(floorPlans.id, floorPlanId),
        eq(floorPlans.organizationId, organizationId)
      )
    );

  if (!plan) return null;

  const planDesks = await db
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
      groupId: desks.groupId,
      visible: desks.visible,
      locked: desks.locked,
    })
    .from(desks)
    .where(eq(desks.floorPlanId, floorPlanId));

  const layoutData = parseLayout(plan.layout);

  return {
    ...plan,
    layout: layoutData.elements,
    groups: layoutData.groups,
    desks: planDesks.map((d) => ({
      ...d,
      x: Number(d.x),
      y: Number(d.y),
      width: Number(d.width),
      height: Number(d.height),
      rotation: Number(d.rotation),
      groupId: d.groupId ?? null,
      visible: d.visible ?? true,
      locked: d.locked ?? false,
      isAvailable: d.isAvailable ?? true,
    })),
  };
}

// ─── Delete floor plan ──────────────────────────────────────

export async function deleteFloorPlan(floorPlanId: string) {
  const { organizationId, orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);

  await db
    .delete(floorPlans)
    .where(
      and(
        eq(floorPlans.id, floorPlanId),
        eq(floorPlans.organizationId, organizationId)
      )
    );

  revalidatePath("/");
}
