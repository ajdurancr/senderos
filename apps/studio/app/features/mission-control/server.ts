import {
  databaseConnectionFromEnvironment,
  listEvents,
  type GoalKind,
  listSenderoVersions,
  getSenderoGraph,
  createAgent,
  updateAgent,
  newSendero,
  replaceSenderoDraft,
  dispatchReviewed,
  listHosts,
} from "@senderos/core";

import { readDispatchReview, type DispatchScope } from "./dispatch-review";

import {
  prepareStudioDatabase,
  senderosForStudio,
} from "../../server/senderos.server";

export async function missionControlData() {
  await prepareStudioDatabase();
  const senderos = senderosForStudio();
  const [overview, executionContexts, agents, transitions, senderoGraphs, events] =
    await Promise.all([
      senderos.missionControl.overview(),
      senderos.commands.executionContexts.list(),
      senderos.commands.agents.list(),
      senderos.commands.agents.transitions(),
      senderos.missionControl.senderos.listGraphs(),
      listEvents({}),
    ]);
  const database = databaseConnectionFromEnvironment();
  const allGraphs = [];
  for (const version of await listSenderoVersions()) {
    const graph = await getSenderoGraph(version.senderoId, version.version);
    if (graph) allGraphs.push(graph);
  }
  const runtime = {
    database: {
      urlEnv: "SENDEROS_DATABASE_URL",
      authTokenEnv: "SENDEROS_DATABASE_AUTH_TOKEN",
      endpoint: database.url.startsWith("file:")
        ? "Local libSQL database"
        : new URL(database.url).host,
      remote: !database.url.startsWith("file:"),
    },
  };
  return { ...overview, hosts: await listHosts(), executionContexts, agents, transitions, senderoGraphs, events, runtime,
    draftGraphs: allGraphs.filter(g => g.version.status === 'draft'),
    historyGraphs: allGraphs.filter(g => g.version.status === 'published') };
}

export type MissionControlData = Awaited<ReturnType<typeof missionControlData>>;

export async function applyMissionControlAction(form: FormData, requestScope?: DispatchScope) {
  await prepareStudioDatabase();
  const senderos = senderosForStudio();
  const intent = String(form.get("intent"));
  if (intent === 'create-agent' || intent === 'update-agent') {
    const input = {
      slug: String(form.get('slug') ?? '').trim(), name: String(form.get('name') ?? '').trim(),
      description: String(form.get('description') ?? ''), instructions: String(form.get('instructions') ?? ''),
      status: String(form.get('status') ?? 'active') as 'active' | 'disabled' | 'archived',
    };
    if (!input.name || !input.slug || !input.instructions.trim()) throw new Error('Name, slug, and instructions are required.');
    const agent = intent === 'create-agent' ? await createAgent(input) : await updateAgent({ id: String(form.get('agentId')), ...input });
    return { redirectTo: `/agents/${encodeURIComponent(agent.id)}` };
  }
  if (intent === 'create-sendero' || intent === 'import-sendero') {
    const input = intent === 'import-sendero' ? readDefinition(form) : {
      name: String(form.get('name') ?? '').trim(), slug: String(form.get('slug') ?? '').trim(), description: String(form.get('description') ?? ''),
    };
    const definition = input as unknown as Parameters<typeof newSendero>[0];
    const graph = await newSendero({ slug: definition.slug, name: definition.name, description: definition.description, nodes: definition.nodes, edges: definition.edges, maxActivations: definition.maxActivations });
    return { redirectTo: `/senderos/${encodeURIComponent(graph.sendero.id)}` };
  }
  if (intent === 'replace-sendero-draft') {
    const definition = readDefinition(form);
    const expectedRevision = String(form.get('expectedRevision') ?? '').trim();
    if (!expectedRevision) throw new Error('The reviewed draft revision is missing. Refresh the Sendero before saving.');
    await replaceSenderoDraft({ expectedRevision, nodes: definition.nodes, edges: definition.edges, maxActivations: definition.maxActivations, senderoId: String(form.get('senderoId')), expectedVersionId: String(form.get('expectedVersionId')) } as Parameters<typeof replaceSenderoDraft>[0]);
    return;
  }

  if (intent === 'draft-sendero') return senderos.commands.senderos.draft(String(form.get('senderoId')));
  if (intent === 'publish-sendero') {
    const expectedVersionId = String(form.get('expectedVersionId') ?? '').trim();
    const expectedRevision = String(form.get('expectedRevision') ?? '').trim();
    if (!expectedVersionId || !expectedRevision) throw new Error('The reviewed draft version or revision is missing. Refresh the Sendero before publishing.');
    return senderos.commands.senderos.publish(String(form.get('senderoId')), expectedVersionId, expectedRevision);
  }

  if (intent === "create-goal") {
    const goal = await senderos.commands.goals.create({
      projectId: String(form.get("projectId")),
      title: String(form.get("title")),
      kind: String(form.get("kind")) as GoalKind,
      specText: String(form.get("specText")),
      senderoVersionId: String(form.get("senderoVersionId") ?? "") || undefined,
    });
    return { redirectTo: `/projects/${encodeURIComponent(goal.projectId)}/canvas/goals/${encodeURIComponent(goal.id)}` };
  }
  if (intent === "start")
    await senderos.missionControl.startGoal({
      goalId: String(form.get("goalId")),
    });
  if (intent === "retry")
    await senderos.missionControl.retryExecution({
      goalId: String(form.get("goalId")),
    });
  if (intent === "dispatch-plan") {
    const review = readDispatchReview(form);
    if (requestScope && (review.scope.executionContextId !== requestScope.executionContextId || review.scope.projectId !== requestScope.projectId)) {
      throw new Error('The dispatch scope changed. Refresh and review the plan again.');
    }
    await dispatchReviewed({ ...review.scope, items: review.items });
  }

  if (intent === "stop")
    await senderos.missionControl.stopExecution({
      runId: String(form.get("runId")),
    });
  if (intent === "evidence")
    await senderos.commands.attempts.recordEvidence({
      attemptId: String(form.get("attemptId")),
      kind: "manual",
      label: String(form.get("label")),
      url: String(form.get("url")) || undefined,
    });
  if (intent === "review")
    await senderos.commands.attempts.review({
      attemptId: String(form.get("attemptId")),
      status: String(form.get("status")) as
        "approved" | "changes_requested" | "rejected",
      reviewer: "Studio operator",
      rationale: String(form.get("rationale")) || undefined,
    });
  if (intent === "update-project")
    await senderos.commands.projects.update({
      id: String(form.get("projectId")),
      name: String(form.get("name")),
      targetBranch: String(form.get("targetBranch")),
      integrationMode: String(form.get("integrationMode")) as
        "github_pr" | "local_merge" | "none",
    });
  if (intent === "update-sendero-node-position" || intent === "update-sendero-layout") {
    const positions = intent === 'update-sendero-node-position'
      ? { [String(form.get('nodeId'))]: { x: Number(form.get('positionX')), y: Number(form.get('positionY')) } }
      : JSON.parse(String(form.get('positions'))) as Record<string, { x: number; y: number }>;
    await senderos.missionControl.senderos.updateLayout({
      senderoId: String(form.get('senderoId')),
      expectedVersionId: String(form.get('expectedVersionId')),
      expectedRevision: reviewedRevision(form),
      positions,
    });
  }
  if (intent === "update-sendero-node")
    await senderos.missionControl.senderos.updateNode({
      id: String(form.get("nodeId")),
      expectedRevision: reviewedRevision(form),
      label: String(form.get("label")),
    });
  if (intent === "update-sendero-edge")
    await senderos.missionControl.senderos.updateEdge({
      id: String(form.get("edgeId")),
      expectedRevision: reviewedRevision(form),
      name: String(form.get("name")),
      description: String(form.get("description")),
      transitionObjective: String(form.get("transitionObjective")),
      condition: form.has("conditionJson") ? JSON.parse(String(form.get("conditionJson"))) as Record<string, unknown> : undefined,
      completion: form.has("evidenceKinds") || form.has("requireReview") ? { requireReview: form.get('requireReview') === 'on', evidenceKinds: String(form.get('evidenceKinds') ?? '').split(',').map(s => s.trim()).filter(Boolean) } : undefined,
      status: String(form.get("status")) as
        "draft" | "active" | "disabled" | "archived",
    });
}

function readDefinition(form: FormData): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(String(form.get('definition')));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch { throw new Error('The definition must be a valid JSON object. Your draft was not changed.'); }
}

function reviewedRevision(form: FormData): string {
  const revision = String(form.get('expectedRevision') ?? '').trim();
  if (!revision) throw new Error('The reviewed definition revision is missing. Refresh before saving.');
  return revision;
}
