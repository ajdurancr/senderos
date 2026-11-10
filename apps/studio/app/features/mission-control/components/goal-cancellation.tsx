import { useRef, useState } from "react";
import { Form, useNavigation } from "react-router";
import { useClientReady } from "../../../hooks/use-client-ready";
import type { MissionControlData } from "../server";

export function GoalCancellation({ goal, requested }: {
  goal: MissionControlData["goals"][number];
  requested: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const pending = useNavigation().state !== "idle";
  const clientReady = useClientReady();
  if (!["active", "blocked", "failed"].includes(goal.status)) return null;

  return <section aria-label="Goal cancellation">
    <p>Requests cancellation for this goal and all active branches. External hosts must report when owned sessions stop.</p>
    <button ref={trigger} className="button button-danger" type="button" disabled={!clientReady || pending || requested} aria-expanded={confirming && !requested} onClick={() => setConfirming(true)}>
      {requested ? "Stop requested" : "Request stop"}
    </button>
    {requested && <p role="status">Waiting for every owning host to acknowledge stopping. Senderos does not terminate external processes.</p>}
    {confirming && !requested && <Form className="compact-form" method="post" aria-label="Confirm goal cancellation">
      <input type="hidden" name="intent" value="cancel-goal" />
      <input type="hidden" name="goalId" value={goal.id} />
      <p>Cancel “{goal.title}” and all its branches? Ready activations and unclaimed runs stop immediately. Owned sessions await their hosts.</p>
      <button className="button button-danger" disabled={pending}>{pending ? "Requesting…" : "Confirm stop"}</button>
      <button className="button button-secondary" type="button" disabled={pending} onClick={() => { setConfirming(false); trigger.current?.focus(); }}>Keep goal</button>
    </Form>}
  </section>;
}
