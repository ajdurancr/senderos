import {
  createSenderos,
  registerExecutionContext,
  databaseConnectionFromEnvironment,
  type GoalKind,
  type EvidenceKind,
  createAgent,
  updateAgent,
  newSendero,
  replaceSenderoDraft,
  dispatchReviewed,
  listHosts,
} from "@senderos/core";

import { studioEvents } from "./activity";
import { filterMissionControlData } from "./scope-filters";
import { parseStudioPath } from "./navigation";
import { studioGraphData } from "./graph-data";

import { readDispatchReview, type DispatchScope } from "./dispatch-review";

import {
  prepareStudioDatabase,
  senderosForStudio,
} from "../../server/senderos.server";

export async function missionControlData(request?: Request) {
  await prepareStudioDatabase();
  const url = request ? new URL(request.url) : undefined;
  const executionContextId = url?.searchParams.get('context') || undefined;
  const projectId = url ? url.searchParams.get('project') || parseStudioPath(url.pathname).projectId : undefined;
  const senderos = executionContextId ? createSenderos({ executionContextId }) : senderosForStudio();
  const [completeOverview, executionContexts, agents, transitions, senderoGraphs] =
    await Promise.all([
      senderos.missionControl.overview({ projectId }),
      senderos.commands.executionContexts.list(),
      senderos.commands.agents.list(),
      senderos.commands.agents.transitions(),
      senderos.missionControl.senderos.listGraphs(),
    ]);
  // The shell needs all project choices when switching contexts. Operational
  // records and lifecycle decisions come from the selected context above.
  const projects = executionContextId || projectId ? await senderosForStudio().commands.projects.list() : completeOverview.projects;
  // Apply the same scope before serialization and pinned-definition loading as
  // the client views. Navigation still receives every project choice.
  const overview = filterMissionControlData({ ...completeOverview, events: [] }, executionContextId, projectId);
  const activity = await studioEvents(overview, request);
  const database = databaseConnectionFromEnvironment();
  const graphs = await studioGraphData(overview.goals, senderoGraphs, request);
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
  return { ...overview, projects, queue: { ...overview.queue, reviews: overview.queue.reviews.filter(({ attempt }) => !["succeeded", "failed", "canceled"].includes(attempt.status)) }, asOf: Date.now(), hosts: await listHosts(), executionContexts, agents, transitions, senderoGraphs, ...activity, runtime,
    ...graphs };
}

export type MissionControlData = Awaited<ReturnType<typeof missionControlData>>;

export async function applyMissionControlAction(form: FormData, requestScope?: DispatchScope) {
  await prepareStudioDatabase();
  const senderos = senderosForStudio();
  const intent = String(form.get("intent"));
  const supported = new Set([
    'register-context', 'register-project', 'create-agent', 'update-agent', 'create-sendero', 'import-sendero',
    'replace-sendero-draft', 'draft-sendero', 'publish-sendero', 'create-goal', 'update-goal',
    'set-activation-budget', 'set-retry-budget', 'start', 'retry', 'dispatch-plan', 'stop', 'cancel-goal', 'evidence', 'review', 'update-project',
    'update-sendero-node-position', 'update-sendero-layout', 'update-sendero-node', 'update-sendero-edge',
  ]);
  if (!supported.has(intent)) throw new Error('This action is not supported. Refresh Studio and try again.');
  if (intent === 'register-context' || intent === 'register-project') {
    const name = String(form.get('name') ?? '').trim();
    if (!name) throw new Error(intent === 'register-context' ? 'Execution context name is required.' : 'Project name is required.');
    if (name.length > 200) throw new Error('Use a name of 200 characters or fewer.');
    if (intent === 'register-context') {
      try {
        const context = await registerExecutionContext({ id: `context-${crypto.randomUUID()}`, name });
        return { redirectTo: `/settings?context=${encodeURIComponent(context.id)}` };
      } catch (error) {
        if (registrationNameConflict(error)) throw new Error('An execution context with this name is already registered. Choose it in the context filter or use a distinct name.');
        throw error;
      }
    }
    const executionContextId = String(form.get('executionContextId') ?? '').trim();
    const contexts = await senderos.commands.executionContexts.list();
    if (!contexts.some(context => context.id === executionContextId)) throw new Error('Choose an existing execution context before adding a project.');
    const scoped = createSenderos({ executionContextId });
    if ((await scoped.commands.projects.list()).some(project => project.name === name)) {
      throw new Error('A project with this name already exists in this context. Choose it in the project filter or use a distinct name.');
    }
    try {
      const project = await scoped.commands.projects.create({ name, integrationMode: 'none' });
      return { redirectTo: `/settings?context=${encodeURIComponent(executionContextId)}&project=${encodeURIComponent(project.id)}` };
    } catch (error) {
      if (registrationNameConflict(error)) throw new Error('A project with this name already exists in this context. Choose it in the project filter or use a distinct name.');
      throw error;
    }
  }
  if (intent === 'update-project') {
    if (!String(form.get('name') ?? '').trim()) throw new Error('Project name is required.');
    if (!['github_pr', 'local_merge', 'none'].includes(String(form.get('integrationMode')))) {
      throw new Error('Choose a supported integration mode.');
    }
    if (form.get('integrationMode') !== 'none' && !String(form.get('targetBranch') ?? '').trim()) {
      throw new Error('A target branch is required for repository integration.');
    }
  }
  if (intent === 'evidence') {
    if (!String(form.get('label') ?? '').trim()) throw new Error('An evidence label is required.');
    const value = String(form.get('url') ?? '').trim();
    if (value) {
      let valid = false;
      try { valid = ['https:', 'http:'].includes(new URL(value).protocol); } catch { /* Invalid URL. */ }
      if (!valid) throw new Error('Evidence links must use a valid HTTP or HTTPS URL.');
    }
  }
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
  if (intent === 'update-goal') {
    const id = String(form.get('goalId') ?? '').trim();
    const api = requestScope?.executionContextId ? createSenderos({ executionContextId: requestScope.executionContextId }) : senderos;
    const goal = await api.commands.goals.get(id);
    if (!goal || (requestScope?.projectId && goal.projectId !== requestScope.projectId)) throw new Error('Goal not found in the selected scope.');
    let expected: unknown;
    try { expected = JSON.parse(String(form.get('expectedDraft'))); } catch { /* Require the reviewed snapshot below. */ }
    if (!expected || typeof expected !== 'object' || !('title' in expected) || typeof expected.title !== 'string' || !('kind' in expected) || typeof expected.kind !== 'string' || !('specText' in expected) || typeof expected.specText !== 'string' || !('senderoVersionId' in expected) || (expected.senderoVersionId !== null && typeof expected.senderoVersionId !== 'string')) throw new Error('The reviewed goal draft is missing. Refresh before saving.');
    const title = String(form.get('title') ?? '').trim();
    const kind = String(form.get('kind') ?? '').trim();
    if (!title || title.length > 200) throw new Error('Enter a goal title of 1 to 200 characters.');
    if (!kind || kind.length > 100) throw new Error('Enter a goal category of 1 to 100 characters.');
    return api.commands.goals.update({ id, title, kind, specText: String(form.get('specText') ?? ''), senderoVersionId: String(form.get('senderoVersionId') ?? '').trim() || null,
      expectedDraft: { title: expected.title, kind: expected.kind, specText: expected.specText, senderoVersionId: expected.senderoVersionId } });
  }
  if (intent === "set-activation-budget" || intent === "set-retry-budget") {
    const goalId = String(form.get("goalId") ?? "").trim();
    const raw = String(form.get("limit") ?? "").trim();
    if (!goalId) throw new Error("Choose a goal before changing its budget.");
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw new Error("Enter a whole-number execution limit.");
    if (intent === "set-activation-budget") await senderos.commands.goals.setActivationBudget(goalId, Number(raw));
    else await senderos.commands.goals.setRetryBudget(goalId, Number(raw));
  }
  if (intent === "start")
    await senderos.commands.goals.activate(String(form.get("goalId")));
  if (intent === "cancel-goal") {
    const goalId = String(form.get("goalId") ?? "").trim();
    if (!goalId) throw new Error("Choose a goal before requesting cancellation.");
    await senderos.commands.goals.cancel(goalId);
  }
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
      kind: String(form.get("kind") ?? "manual") as EvidenceKind,
      summary: String(form.get("summary") ?? "") || undefined,
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
      name: String(form.get("name") ?? "").trim(),
      targetBranch: String(form.get("targetBranch") ?? "").trim(),
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

/** Translate only the expected name uniqueness conflict; other database errors retain their failure. */
function registrationNameConflict(error: unknown): boolean {
  let cause = error;
  while (cause instanceof Error) {
    const code = (cause as Error & { code?: string }).code;
    if (code === 'SQLITE_CONSTRAINT_UNIQUE' || (code === 'SQLITE_CONSTRAINT' && /UNIQUE constraint failed: (execution_contexts\.name|projects\.execution_context_id, projects\.name)/.test(cause.message))) return true;
    cause = cause.cause;
  }
  return false;
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
