import { Form } from "react-router";

import type { MissionControlData } from "../server";
import { Icon } from "./icons";

export function DispatchTray({ data }: { data: MissionControlData }) {
  if (!data.queue.dispatchable.length) return null;
  return <section className="dispatch-tray">
    <header><div><Icon name="activity"/><span><strong>Dispatch plan</strong><small>{data.queue.dispatchable.length} proposed {data.queue.dispatchable.length === 1 ? "action" : "actions"}</small></span></div><span>Review before execution</span></header>
    <div className="dispatch-items">{data.queue.dispatchable.map((item) => {
      const goal = data.goals.find((value) => value.id === item.goalId);
      const agent = data.agents.find((value) => value.id === item.agentId);
      return <article key={`${item.goalId}-${item.transitionId}`}><span className="dispatch-goal">{goal?.title ?? item.goalId}</span><Icon name="arrow"/><strong>{agent?.name ?? item.agentId}</strong><small>{item.previousRunId ? "retry" : "new run"}</small></article>;
    })}</div>
    <footer><p>Senderos will persist one validated run per item. Host sessions still start outside Studio.</p><Form method="post"><input type="hidden" name="intent" value="dispatch-plan"/><button>Dispatch all <Icon name="arrow"/></button></Form></footer>
  </section>;
}
