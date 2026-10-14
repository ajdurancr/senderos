import { Form, useNavigation, useLocation } from "react-router";

import { DurableLink as Link } from "../../../components/durable-link";

import type { MissionControlData } from "../server";
import { Icon } from "./icons";
import { reviewDispatch, type DispatchScope } from "../dispatch-review";

export function DispatchTray({ data, scope = {} }: { data: MissionControlData; scope?: DispatchScope }) {
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  search.delete("plan");
  const closePath = `${location.pathname}${search.size ? `?${search}` : ""}`;
  const pending = useNavigation().state !== "idle";
  return <section className="dispatch-tray">
    <header><div><Icon name="activity"/><span><strong>Dispatch plan</strong><small>{data.queue.dispatchable.length} proposed {data.queue.dispatchable.length === 1 ? "action" : "actions"}</small></span></div><Link className="button button-secondary" to={closePath} aria-label="Close dispatch plan"><Icon name="x" /> Close</Link></header>
    {!data.queue.dispatchable.length && <div className="empty-state"><h2>No activations ready</h2><p>There is nothing to reserve in the selected scope. Close this plan to continue.</p></div>}
    <div className="dispatch-items">{data.queue.dispatchable.map((item) => {
      const goal = data.goals.find((value) => value.id === item.goalId);
      const agent = data.agents.find((value) => value.id === item.agentId);
      return <article key={item.activationId}><span className="dispatch-goal">{goal?.title ?? item.goalId}</span><Icon name="arrow"/><strong>{agent?.name ?? item.agentId}</strong><small>{item.previousRunId ? "retry" : "new run"}</small><small className="mono">{item.activationId} · revision {item.revision}</small></article>;
    })}</div>
    <footer><p>This plan includes all ready activations in the selected scope. Senderos will reserve one validated run per item; external hosts start sessions separately.</p><Form method="post"><input type="hidden" name="intent" value="dispatch-plan"/><input type="hidden" name="scope" value={JSON.stringify(scope)}/><input type="hidden" name="reviewedItems" value={JSON.stringify(data.queue.dispatchable.map(reviewDispatch))}/><button className="button button-primary" disabled={pending || !data.queue.dispatchable.length}>{pending ? "Reserving…" : "Dispatch all"} <Icon name="arrow"/></button></Form></footer>
  </section>;
}
