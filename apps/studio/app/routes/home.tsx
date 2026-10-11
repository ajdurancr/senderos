import { redirect, useActionData, useLoaderData, useLocation, useNavigation } from "react-router";

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
  const form = await request.formData();
  const url = new URL(request.url);
  const route = parseStudioPath(url.pathname);
  try {
    const result = await applyMissionControlAction(form, { executionContextId: url.searchParams.get('context') ?? undefined, projectId: url.searchParams.get('project') ?? route.projectId });
    if (result && 'redirectTo' in result && typeof result.redirectTo === 'string') return redirect(result.redirectTo);
    return { ok: true, intent: String(form.get('intent')), message: 'Changes saved.' };
  } catch (error) {
    return { ok: false, intent: String(form.get('intent')), message: error instanceof Error ? error.message : 'The action could not be completed. Refresh and try again.' };
  }
}

export default function Home() {
  const data = useLoaderData<typeof loader>();
  const pending = useNavigation().state !== "idle";
  const feedback = useActionData<typeof action>();
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
      {feedback && !pending && <div className={`action-feedback ${feedback.ok ? "" : "error"}`} role={feedback.ok ? "status" : "alert"}>{feedback.message}</div>}
      <MissionControlOverview data={filteredData} route={route} search={search} />
    </StudioLayout>
  );
}
