import { useRef, useState } from "react";
import { Form } from "react-router";
import { useExecutionSubmission } from "../../../hooks/use-execution-submission";
import { useClientReady } from "../../../hooks/use-client-ready";
import type { MissionControlData } from "../server";

export function GoalCancellation({ goal, requested }: {
  goal: MissionControlData["goals"][number];
  requested: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const { pending, uncertain, submit } = useExecutionSubmission("cancel-goal");
  const clientReady = useClientReady();
  if (!["active", "blocked", "failed"].includes(goal.status)) return null;

  return <section aria-label="Goal cancellation">
    <p>Requests cancellation for this goal and all active branches. External hosts must report when owned sessions stop.</p>
    <button ref={trigger} className="button button-danger" type="button" disabled={!clientReady || pending || uncertain || requested} aria-expanded={confirming && !requested} onClick={() => setConfirming(true)}>
      {requested ? "Stop requested" : "Request stop"}
    </button>
    {uncertain && <p><a href="">Reload cancellation and host acknowledgements</a> before taking another action.</p>}
    {requested && <p role="status">Waiting for every owning host to acknowledge stopping. Senderos does not terminate external processes.</p>}
    {confirming && !requested && <Form className="compact-form" method="post" aria-label="Confirm goal cancellation" onSubmit={submit}>
      <input type="hidden" name="intent" value="cancel-goal" />
      <input type="hidden" name="goalId" value={goal.id} />
      <p>Cancel “{goal.title}” and all its branches? Ready activations and unclaimed runs stop immediately. Owned sessions await their hosts.</p>
      <button className="button button-danger" disabled={pending || uncertain}>{pending ? "Requesting…" : "Confirm stop"}</button>
      <button className="button button-secondary" type="button" disabled={pending || uncertain} onClick={() => { setConfirming(false); trigger.current?.focus(); }}>Keep goal</button>
    </Form>}
  </section>;
}
