import { getWorkplaces } from "./actions";
import { WorkplaceView } from "@/components/workplace/workplace-view";

export default async function WorkplacePage() {
  const workplaces = await getWorkplaces();
  return <WorkplaceView initialWorkplaces={workplaces} />;
}
