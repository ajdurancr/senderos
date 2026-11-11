import { useEffect, useRef, useState } from 'react';
import { type ShouldRevalidateFunctionArgs, redirect, useActionData, useLoaderData, useLocation, useNavigation } from "react-router";

import { SnapshotStatus } from "../features/mission-control/components/snapshot-status";

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
  return await missionControlData(request);
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
        if (value && !['register-context', 'register-project'].includes(String(form.get('intent')))) destination.searchParams.set(key, value);
      }
      destination.searchParams.set('saved', String(form.get('intent')));
      return redirect(`${destination.pathname}${destination.search}`);
    }
    return { ok: true, intent: String(form.get('intent')), message: actionMessage(String(form.get('intent'))) };
  } catch (error) {
    return { ok: false, intent: String(form.get('intent')), message: error instanceof Error ? error.message : 'The action could not be completed. Refresh and try again.' };
  }
}

// A lost response is not proof that the server did not apply the save. Keep the
// editor and its reviewed snapshot mounted. Registration requires inspecting
// identities before resubmission; draft saves retain their concurrency checks.
export async function clientAction({ request, serverAction }: Route.ClientActionArgs) {
  const intent = String((await request.clone().formData()).get('intent'));
  try {
    return await serverAction();
  } catch (error) {
    if (!['replace-sendero-draft', 'update-goal', 'update-project', 'register-context', 'register-project'].includes(intent) || request.signal.aborted) throw error;
    const registration = intent === 'register-context' || intent === 'register-project';
    const message = registration
      ? `Studio could not confirm the ${intent === 'register-context' ? 'execution context' : 'project'} registration. Your input is kept here. The registration may have reached the server. Reload and inspect the execution context and project selectors before submitting again.`
      : intent === 'update-project'
      ? 'Studio could not confirm the project settings save. Your edits are kept here. The save may have reached the server. Reload to inspect the saved settings before submitting again.'
      : `Studio could not confirm the ${intent === 'update-goal' ? 'goal' : 'graph'} save. Your edits are kept here. The save may have reached the server. Retry with revision checks, or reload to inspect the saved draft.`;
    return { ok: false, intent, transportFailure: true, message };
  }
}

export function shouldRevalidate({ actionResult, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (actionResult?.transportFailure === true) return false;
  return defaultShouldRevalidate;
}

export default function Home() {
  const loaded = useLoaderData<typeof loader>();
  const pending = useNavigation().state !== "idle";
  const feedback = useActionData<typeof action>();
  const location = useLocation();
  const scope = `${location.pathname}${location.search}`;
  const [refreshed, setRefreshed] = useState<{ base: typeof loaded; scope: string; data: typeof loaded }>();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const refreshRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    refreshRequest.current?.abort();
    refreshRequest.current = null;
    setRefreshing(false);
    setRefreshError(false);
    setRefreshed(undefined);
    return () => refreshRequest.current?.abort();
  }, [loaded, scope]);
  const data = refreshed?.base === loaded && refreshed.scope === scope ? refreshed.data : loaded;
  async function refreshSnapshot() {
    if (refreshRequest.current || pending) return;
    const controller = new AbortController();
    refreshRequest.current = controller;
    setRefreshing(true);
    setRefreshError(false);
    const query = new URLSearchParams(location.search);
    query.set('_pathname', location.pathname);
    try {
      const response = await fetch(`/resources/snapshot?${query}`, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Refresh unavailable');
      const result = await response.json();
      if (result.ok !== true || !result.data || !Number.isFinite(result.data.asOf)) throw new Error('Invalid snapshot');
      if (!controller.signal.aborted) setRefreshed({ base: loaded, scope, data: result.data });
    } catch {
      if (!controller.signal.aborted) setRefreshError(true);
    } finally {
      if (refreshRequest.current === controller) {
        refreshRequest.current = null;
        setRefreshing(false);
      }
    }
  }
  const route = parseStudioPath(location.pathname);
  const search = new URLSearchParams(location.search);
  const savedMessages: Record<string, string> = {
    'create-agent': 'Agent created.', 'update-agent': 'Agent changes saved.',
    'create-sendero': 'New draft created. Validate and publish when ready.',
    'import-sendero': 'Definition imported as a draft. Validate and publish when ready.',
    'create-goal': 'Goal created.',
    'register-context': 'Execution context added. Add its first project below.',
    'register-project': 'Project added. Configure it here or open Goals to create its first goal.',
  };
  const savedMessage = savedMessages[search.get('saved') ?? ''];
  const filteredData = filterMissionControlData(
    data,
    search.get("context") ?? undefined,
    search.get("project") ?? route.projectId,
  );
  return (
    <StudioLayout data={data} pending={pending} route={route} search={search}>
      <SnapshotStatus asOf={data.asOf} pending={pending} refreshing={refreshing} error={refreshError} onRefresh={refreshSnapshot} />
      {savedMessage && !feedback && !pending && <div className="action-feedback" role="status">{savedMessage}</div>}
      {feedback && !pending && !(!feedback.ok && ['register-context', 'register-project'].includes(feedback.intent)) && <div className={`action-feedback ${feedback.ok ? "" : "error"}`} role={feedback.ok ? "status" : "alert"}>{feedback.message}</div>}
      <MissionControlOverview data={filteredData} route={route} search={search} />
    </StudioLayout>
  );
}

function actionMessage(intent: string) {
  const messages: Record<string, string> = {
    "update-goal": "Goal preparation saved. Start remains a separate action.",
    "set-activation-budget": "Activation limit saved. Review ready activations before dispatching.",
    "set-retry-budget": "Attempt limit saved. Review ready activations before dispatching.",
    start: "Goal started. Review ready activations before reserving runs.",
    "dispatch-plan": "Runs reserved. External hosts claim and start execution separately.",
    stop: "Stop requested for this goal and all its active branches. Owned attempts await the host's cancellation report.",
    "cancel-goal": "Goal cancellation recorded. Owned sessions remain blocked until every host acknowledges stopping.",
    evidence: "Evidence recorded. Completion follows the workflow's evidence, review and host requirements.",
    review: "Review decision recorded. Completion follows the attempt's evidence and host reports.",
    "publish-sendero": "Sendero published. Existing goals keep their pinned version.",
    "draft-sendero": "Editable draft created. Published definitions remain unchanged.",
  };
  return messages[intent] ?? "Changes saved.";
}
