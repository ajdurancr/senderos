import { databaseConnectionFromEnvironment, listEvents, type GoalKind } from "@senderos/core";

import { prepareStudioDatabase, senderosForStudio } from "../../server/senderos.server";

export async function missionControlData() {
  await prepareStudioDatabase();
  const senderos = senderosForStudio();
  const [overview, agents, transitions, events] = await Promise.all([
    senderos.missionControl.overview(),
    senderos.commands.agents.list(),
    senderos.commands.agents.transitions(),
    listEvents({}),
  ]);
  const database = databaseConnectionFromEnvironment();
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
  return { ...overview, agents, transitions, events, runtime };
}

export type MissionControlData = Awaited<ReturnType<typeof missionControlData>>;

export async function applyMissionControlAction(form: FormData) {
  await prepareStudioDatabase();
  const senderos = senderosForStudio();
  const intent = String(form.get("intent"));

  if (intent === "create-goal") {
    await senderos.commands.goals.create({
      projectId: String(form.get("projectId")),
      title: String(form.get("title")),
      kind: String(form.get("kind")) as GoalKind,
      specText: String(form.get("specText")),
    });
  }
  if (intent === "start")
    await senderos.missionControl.startGoal({ goalId: String(form.get("goalId")) });
  if (intent === "retry")
    await senderos.missionControl.retryExecution({ goalId: String(form.get("goalId")) });
  if (intent === "dispatch-plan") {
    const plan = await senderos.commands.plan();
    for (const item of plan) {
      await senderos.commands.runs.dispatch({
        ...item,
        previousRunId: item.previousRunId ?? undefined,
      });
    }
  }
  if (intent === "stop")
    await senderos.missionControl.stopExecution({ runId: String(form.get("runId")) });
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
        | "approved"
        | "changes_requested"
        | "rejected",
      reviewer: "Studio operator",
      rationale: String(form.get("rationale")) || undefined,
    });
  if (intent === "update-project")
    await senderos.commands.projects.update({
      id: String(form.get("projectId")),
      name: String(form.get("name")),
      targetBranch: String(form.get("targetBranch")),
      integrationMode: String(form.get("integrationMode")) as
        | "github_pr"
        | "local_merge",
    });
}
