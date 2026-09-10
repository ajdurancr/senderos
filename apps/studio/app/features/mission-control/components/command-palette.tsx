import { useEffect, useMemo, useRef, useState } from "react";
import { DurableLink as Link } from "../../../components/durable-link";

import type { MissionControlData } from "../server";
import { attemptPath, goalPath, projectPath } from "../navigation";
import { Icon } from "./icons";

export function CommandPalette({ data, projectId }: { data: MissionControlData; projectId?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => { if (open) requestAnimationFrame(() => input.current?.focus()); }, [open]);

  const items = useMemo(() => [
    { label: "Open orchestration canvas", detail: "Workspace", href: projectPath(projectId), icon: "nodes" },
    { label: "Show work needing attention", detail: "Decision queue", href: projectPath(projectId, "now"), icon: "inbox" },
    { label: "Review dispatch plan", detail: `${data.queue.dispatchable.length} ready`, href: `${projectPath(projectId)}?plan=true`, icon: "activity" },
    { label: "Create a new goal", detail: "Action", href: `${projectPath(projectId, "goals")}/new`, icon: "plus" },
    { label: "Open database settings", detail: "Configuration", href: projectPath(projectId, "settings"), icon: "settings" },
    ...data.goals.map((goal) => ({ label: goal.title, detail: `Goal · ${goal.status}`, href: goalPath(goal.projectId, goal.id), icon: "target" })),
    ...data.attempts.map((attempt) => { const run=data.runs.find((item)=>item.id===attempt.runId); const goal=data.goals.find((item)=>item.id===run?.goalId); return { label: `Attempt ${attempt.id}`, detail: `${attempt.harness} · ${attempt.status}`, href: attemptPath(goal?.projectId ?? projectId, attempt.id), icon: "activity" }; }),
  ], [projectId, data]);
  const matches = items.filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(query.toLowerCase())).slice(0, 9);

  return <>
    <button className="command-trigger" type="button" onClick={() => setOpen(true)}><Icon name="search" /><span>Search or run a command</span><kbd>⌘ K</kbd></button>
    {open && <div className="command-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="command-dialog" role="dialog" aria-modal="true" aria-label="Command palette">
        <header><Icon name="search" /><input ref={input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a goal, attempt, or action…" /><button onClick={() => setOpen(false)}>Esc</button></header>
        <div className="command-results">
          <p>Commands and entities</p>
          {matches.map((item) => <Link key={`${item.href}-${item.label}`} to={item.href} onClick={() => setOpen(false)}><Icon name={item.icon} /><span><strong>{item.label}</strong><small>{item.detail}</small></span><Icon name="arrow" /></Link>)}
          {matches.length === 0 && <div className="empty-command">Nothing matches that query.</div>}
        </div>
        <footer><span>Select a result to open it</span><span>Searches persisted Studio entities</span></footer>
      </section>
    </div>}
  </>;
}
