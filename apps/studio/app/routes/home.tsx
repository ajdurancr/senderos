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
    if (result && 'redirectTo' in result && typeof result.redirectTo === 'string') {
      const destination = new URL(result.redirectTo, url.origin);
      for (const key of ['context', 'project']) {
        const value = url.searchParams.get(key);
        if (value) destination.searchParams.set(key, value);
      }
      destination.searchParams.set('saved', String(form.get('intent')));
      return redirect(`${destination.pathname}${destination.search}`);
    }
    return { ok: true, intent: String(form.get('intent')), message: actionMessage(String(form.get('intent'))) };
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
  const savedMessages: Record<string, string> = {
    'create-agent': 'Agent created.', 'update-agent': 'Agent changes saved.',
    'create-sendero': 'New draft created. Validate and publish when ready.',
    'import-sendero': 'Definition imported as a draft. Validate and publish when ready.',
    'create-goal': 'Goal created.',
  };
  const savedMessage = savedMessages[search.get('saved') ?? ''];
  const filteredData = filterMissionControlData(
    data,
    search.get("context") ?? undefined,
    search.get("project") ?? route.projectId,
  );
  return (
    <StudioLayout data={data} pending={pending} route={route} search={search}>
      {savedMessage && !feedback && !pending && <div className="action-feedback" role="status">{savedMessage}</div>}
      {feedback && !pending && <div className={`action-feedback ${feedback.ok ? "" : "error"}`} role={feedback.ok ? "status" : "alert"}>{feedback.message}</div>}
      <MissionControlOverview data={filteredData} route={route} search={search} />
    </StudioLayout>
  );
}

function actionMessage(intent: string) {
  const messages: Record<string, string> = {
    start: "Goal started. Review ready activations before reserving runs.",
    "dispatch-plan": "Runs reserved. External hosts claim and start execution separately.",
    stop: "Stop requested for this goal and all its active branches. Owned attempts await the host's cancellation report.",
    evidence: "Manual evidence recorded. Required test evidence must be reported separately.",
    review: "Review decision recorded. Completion follows the attempt's evidence and host reports.",
    "publish-sendero": "Sendero published. Existing goals keep their pinned version.",
    "draft-sendero": "Editable draft created. Published definitions remain unchanged.",
  };
  return messages[intent] ?? "Changes saved.";
}
