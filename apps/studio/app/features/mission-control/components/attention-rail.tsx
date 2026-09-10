import { Link } from "react-router";

import type { MissionControlData } from "../server";
import { projectPath } from "../navigation";
import { Icon } from "./icons";

export function AttentionRail({ data, projectId }: { data: MissionControlData; projectId?: string }) {
  const items = [
    { label: "Reviews waiting", count: data.queue.reviews.length, filter: "reviews", tone: "violet" },
    { label: "Failed attempts", count: data.queue.failedAttempts.length, filter: "failed", tone: "rose" },
    { label: "Stale heartbeats", count: data.queue.staleAttempts.length, filter: "stale", tone: "amber" },
    { label: "Ready to dispatch", count: data.queue.dispatchable.length, filter: "dispatchable", tone: "mint" },
  ];
  return <aside className="attention-rail">
    <header><span>Needs attention</span><Icon name="inbox" /></header>
    <div>{items.map((item) => <Link key={item.filter} to={`${projectPath(projectId, "now")}?filter=${item.filter}`}><i className={item.tone} /><span>{item.label}</span><strong>{item.count}</strong><Icon name="arrow" /></Link>)}</div>
    <footer><span className="health-dot" /> Runtime signals are current</footer>
  </aside>;
}
