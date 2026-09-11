import { redirect, useLoaderData, useLocation, useNavigation } from "react-router";

import { MissionControlOverview } from "../features/mission-control/overview";
import { applyMissionControlAction, missionControlData } from "../features/mission-control/server";
import { StudioLayout } from "../layouts/studio-layout";
import { parseStudioPath, projectPath } from "../features/mission-control/navigation";
import type { Route } from "./+types/home";

export function meta() {
  return [
    { title: "Mission Control · Senderos Studio" },
    { name: "description", content: "Operational control plane for verified software outcomes." },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const data = await missionControlData();
  if (new URL(request.url).pathname === "/" && data.projects[0])
    throw redirect(projectPath(data.projects[0].id));
  return data;
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
  return (
    <StudioLayout data={data} pending={pending} route={route}>
      <MissionControlOverview data={data} route={route} search={new URLSearchParams(location.search)} />
    </StudioLayout>
  );
}
