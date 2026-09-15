import { useLoaderData, useLocation, useNavigation } from "react-router";

import { MissionControlOverview } from "../features/mission-control/overview";
import { applyMissionControlAction, missionControlData } from "../features/mission-control/server";
import { StudioLayout } from "../layouts/studio-layout";
import { parseStudioPath } from "../features/mission-control/navigation";
import { filterMissionControlData } from "../features/mission-control/scope-filters";
import type { Route } from "./+types/home";

export function meta() {
  return [
    { title: "Mission Control · Senderos Studio" },
    { name: "description", content: "Operational control plane for verified software outcomes." },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  return await missionControlData();
}
export async function action({ request }: Route.ActionArgs) {
  await applyMissionControlAction(await request.formData());
  return null;
}

export default function Home() {
  const data = useLoaderData<typeof loader>();
  const pending = useNavigation().state !== "idle";
  const location = useLocation();
  const route = parseStudioPath(location.pathname);
  const search = new URLSearchParams(location.search);
  const filteredData = filterMissionControlData(
    data,
    search.get("context") ?? undefined,
    search.get("project") ?? route.projectId,
  );
  return (
    <StudioLayout data={data} pending={pending} route={route} search={search}>
      <MissionControlOverview data={filteredData} route={route} search={search} />
    </StudioLayout>
  );
}
