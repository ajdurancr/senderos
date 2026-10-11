import { Form, useNavigation } from "react-router";

import type { MissionControlData } from "../server";
import { Icon } from "./icons";
import { reviewDispatch, type DispatchScope } from "../dispatch-review";

export function DispatchTray({ data, scope = {} }: { data: MissionControlData; scope?: DispatchScope }) {
  const pending = useNavigation().state !== "idle";
  if (!data.queue.dispatchable.length) return null;
  return <section className="dispatch-tray">
    <header><div><Icon name="activity"/><span><strong>Dispatch plan</strong><small>{data.queue.dispatchable.length} proposed {data.queue.dispatchable.length === 1 ? "action" : "actions"}</small></span></div><span>Review before execution</span></header>
    <div className="dispatch-items">{data.queue.dispatchable.map((item) => {
      const goal = data.goals.find((value) => value.id === item.goalId);
      const agent = data.agents.find((value) => value.id === item.agentId);
      return <article key={item.activationId}><span className="dispatch-goal">{goal?.title ?? item.goalId}</span><Icon name="arrow"/><strong>{agent?.name ?? item.agentId}</strong><small>{item.previousRunId ? "retry" : "new run"}</small><small className="mono">{item.activationId} · revision {item.revision}</small></article>;
    })}</div>
    <footer><p>Senderos will persist one validated run per item. Host sessions still start outside Studio.</p><Form method="post"><input type="hidden" name="intent" value="dispatch-plan"/><input type="hidden" name="scope" value={JSON.stringify(scope)}/><input type="hidden" name="reviewedItems" value={JSON.stringify(data.queue.dispatchable.map(reviewDispatch))}/><button disabled={pending}>{pending ? "Reserving…" : "Dispatch all"} <Icon name="arrow"/></button></Form></footer>
  </section>;
}
