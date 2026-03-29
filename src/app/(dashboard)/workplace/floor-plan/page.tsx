import { redirect } from "next/navigation";
import { getWorkplaces } from "../actions";
import { getFloorPlans, getFloorPlanWithDesks } from "./actions";
import { FloorPlanEditor } from "@/components/floor-plan/floor-plan-editor";
import { requireOrgContext, requireManagerOrAdmin } from "@/lib/auth-context";

interface Props {
  searchParams: Promise<{ workplaceId?: string; floorId?: string }>;
}

export default async function FloorPlanPage({ searchParams }: Props) {
  const { orgRole } = await requireOrgContext();
  await requireManagerOrAdmin(orgRole);

  const params = await searchParams;
  const { workplaceId, floorId } = params;

  if (!workplaceId) {
    redirect("/workplace");
  }

  const [allWorkplaces, floors] = await Promise.all([
    getWorkplaces(),
    getFloorPlans(workplaceId),
  ]);

  const workplace = allWorkplaces.find((w) => w.id === workplaceId);
  if (!workplace) {
    redirect("/workplace");
  }

  // Load initial floor plan data if a floor is selected
  let initialFloorPlan = null;
  const targetFloorId = floorId ?? floors[0]?.id;
  if (targetFloorId) {
    initialFloorPlan = await getFloorPlanWithDesks(targetFloorId);
  }

  return (
    <div className="flex h-screen flex-col">
      <FloorPlanEditor
        workplaceId={workplaceId}
        workplaceName={workplace.name}
        floors={floors.map((f) => ({
          id: f.id,
          name: f.name,
          floorNumber: f.floorNumber,
        }))}
        initialFloorPlan={initialFloorPlan}
      />
    </div>
  );
}
