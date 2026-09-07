import { senderosForStudio } from "../../server/senderos.server";

export async function missionControlData() {
  return await senderosForStudio().missionControl.overview();
}

export type MissionControlData = Awaited<ReturnType<typeof missionControlData>>;

export async function applyMissionControlAction(form: FormData) {
  const senderos = senderosForStudio();
  const intent = String(form.get("intent"));
  if (intent === "start")
    await senderos.missionControl.startGoal({ goalId: String(form.get("goalId")) });
  if (intent === "retry")
    await senderos.missionControl.retryExecution({
      goalId: String(form.get("goalId")),
    });
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
        "approved" | "changes_requested" | "rejected",
      reviewer: "Studio operator",
      rationale: String(form.get("rationale")) || undefined,
    });
}
