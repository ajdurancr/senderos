import { Link } from "react-router";

import type { MissionControlData } from "../server";
import { Icon } from "./icons";

export function AttentionRail({ data, projectId }: { data: MissionControlData; projectId?: string }) {
  const base = projectId ? `&project=${encodeURIComponent(projectId)}` : "";
  const items = [
    { label: "Reviews waiting", count: data.queue.reviews.length, filter: "reviews", tone: "violet" },
    { label: "Failed attempts", count: data.queue.failedAttempts.length, filter: "failed", tone: "rose" },
    { label: "Stale heartbeats", count: data.queue.staleAttempts.length, filter: "stale", tone: "amber" },
    { label: "Ready to dispatch", count: data.queue.dispatchable.length, filter: "dispatchable", tone: "mint" },
  ];
  return <aside className="attention-rail">
    <header><span>Needs attention</span><Icon name="inbox" /></header>
    <div>{items.map((item) => <Link key={item.filter} to={`/?view=now&filter=${item.filter}${base}`}><i className={item.tone} /><span>{item.label}</span><strong>{item.count}</strong><Icon name="arrow" /></Link>)}</div>
    <footer><span className="health-dot" /> Runtime signals are current</footer>
  </aside>;
}
