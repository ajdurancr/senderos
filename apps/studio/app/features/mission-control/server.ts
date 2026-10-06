import {
  databaseConnectionFromEnvironment,
  listEvents,
  type GoalKind,
  listSenderoVersions,
  getSenderoGraph,
} from "@senderos/core";

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
  return { ...overview, executionContexts, agents, transitions, senderoGraphs, events, runtime,
    draftGraphs: allGraphs.filter(g => g.version.status === 'draft'),
    historyGraphs: allGraphs.filter(g => g.version.status === 'published') };
}

export type MissionControlData = Awaited<ReturnType<typeof missionControlData>>;

export async function applyMissionControlAction(form: FormData) {
  await prepareStudioDatabase();
  const senderos = senderosForStudio();
  const intent = String(form.get("intent"));
  if (intent === 'draft-sendero') return senderos.commands.senderos.draft(String(form.get('senderoId')));
  if (intent === 'publish-sendero') return senderos.commands.senderos.publish(String(form.get('senderoId')));

  if (intent === "create-goal") {
    await senderos.commands.goals.create({
      projectId: String(form.get("projectId")),
      title: String(form.get("title")),
      kind: String(form.get("kind")) as GoalKind,
      specText: String(form.get("specText")),
      senderoVersionId: String(form.get("senderoVersionId")) || undefined,
    });
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
    const plan = await senderos.commands.plan();
    for (const item of plan) {
      await senderos.commands.runs.dispatch({
        ...item,
        previousRunId: item.previousRunId ?? undefined,
        expectedRevision: item.revision,
        requestId: `studio:${item.goalId}:${item.revision}`,
      });
    }
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
        "github_pr" | "local_merge",
    });
  if (intent === "update-sendero-node-position")
    await senderos.missionControl.senderos.updateNodePosition({
      id: String(form.get("nodeId")),
      positionX: Number(form.get("positionX")),
      positionY: Number(form.get("positionY")),
    });
  if (intent === "update-sendero-layout") {
    const positions = JSON.parse(String(form.get("positions"))) as Record<
      string,
      { x: number; y: number }
    >;
    for (const [id, point] of Object.entries(positions))
      await senderos.missionControl.senderos.updateNodePosition({
        id,
        positionX: point.x,
        positionY: point.y,
      });
  }
  if (intent === "update-sendero-node")
    await senderos.missionControl.senderos.updateNode({
      id: String(form.get("nodeId")),
      label: String(form.get("label")),
    });
  if (intent === "update-sendero-edge")
    await senderos.missionControl.senderos.updateEdge({
      id: String(form.get("edgeId")),
      name: String(form.get("name")),
      description: String(form.get("description")),
      transitionObjective: String(form.get("transitionObjective")),
      completion: { requireReview: form.get('requireReview') === 'on', evidenceKinds: String(form.get('evidenceKinds') ?? '').split(',').map(s => s.trim()).filter(Boolean) },
      status: String(form.get("status")) as
        "draft" | "active" | "disabled" | "archived",
    });
}
