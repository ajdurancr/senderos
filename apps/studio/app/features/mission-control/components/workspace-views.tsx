import { useState } from "react";
import { GoalCreation } from "./goal-creation";
import { SettingsDraftBoundary } from "./settings-draft-boundary";
import { RetryLineage } from "./retry-lineage";
import { GoalActivations, HostExecutionRecords, executionPhase } from "./execution-records";
import { EvidenceRecords } from "./evidence-records";
import { ReviewTimestamp } from "./review-timestamp";
import { LocalRegistration } from "./local-registration";
import { ProjectSettings } from "./project-settings";
import { AgentAuthoring } from "./agent-authoring";
import { useSearchParams, useLocation } from "react-router";

import { DurableLink as Link } from "../../../components/durable-link";
import { StatusBadge } from "../../../components/status-badge";
import { eventLabel, goalExecution, parseAttemptSnapshot, relativeTime } from "../model";
import { attemptPath, canvasEntityPath, goalPath, projectPath, parseStudioPath } from "../navigation";
import type { MissionControlData } from "../server";
import { Icon } from "./icons";
import { goalBlockers } from "../goal-blockers";
import { runHistoryPage } from "../run-history";
import { GoalBlockerCard } from "./goal-blocker-card";

function ViewHeader({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: React.ReactNode }) {
  return <header className="view-header"><div><span>{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div>{action}</header>;
}

export function AttentionView({ data, filter, projectId }: { data: MissionControlData; filter?: string; projectId?: string }) {
  const blocked = goalBlockers(data);
  const filters = [
    { key: "", label: "All attention" },
    { key: "blocked", label: `Goal blockers (${blocked.length})` },
    { key: "review", label: "Reviews" },
    { key: "failed", label: "Failed attempts" },
    { key: "stale", label: "Stale hosts" },
    { key: "dispatchable", label: "Ready to dispatch" },
  ];
  const needsSetup = !data.projects.length && !filter;
  const validFilter = filters.some(item => item.key === (filter ?? ""));
  const goalForAttempt = (attempt: MissionControlData['attempts'][number]) => {
    const run = data.runs.find(run => run.id === attempt.runId);
    return data.goals.find(goal => goal.id === run?.goalId);
  };
  const attemptLink = (attempt: MissionControlData['attempts'][number]) => {
    const goal = goalForAttempt(attempt);
    return goal ? attemptPath(goal.projectId, attempt.id) : undefined;
  };
  const records = [
    ...data.queue.reviews.map(item => ({ type: 'review', title: goalForAttempt(item.attempt)?.title ?? item.attempt.id, status: 'pending review', id: item.attempt.id, href: attemptLink(item.attempt), body: 'Execution evidence requires an operator decision.' })),
    ...data.queue.failedAttempts.map(attempt => ({ type: 'failed', title: goalForAttempt(attempt)?.title ?? attempt.id, status: 'failed', id: attempt.id, href: attemptLink(attempt), body: attempt.failureSummary ?? 'Execution failed without a summary.' })),
    ...data.queue.staleAttempts.map(attempt => ({ type: 'stale', title: attempt.executionObjective, status: 'stale', id: attempt.id, href: attemptLink(attempt), body: 'The recorded lease or heartbeat needs host inspection.' })),
    ...data.queue.dispatchable.map(item => {
      const goal = data.goals.find(goal => goal.id === item.goalId);
      return { type: 'dispatchable', title: goal?.title ?? item.goalId, status: 'ready', id: item.activationId, href: goal ? `${goalPath(goal.projectId, goal.id)}?plan=true` : undefined, body: 'An activation is ready to review and reserve.' };
    }),
  ].filter(item => !filter || item.type === filter);
  return <div className="standard-view"><ViewHeader eyebrow="Decision queue" title="What needs attention now" copy="Exceptions, evidence, and decisions that need an operator." action={<Link className="button button-primary" to={`${projectPath(projectId, "goals")}/new`}><Icon name="plus" />New goal</Link>} />
    <nav className="attention-filters" aria-label="Attention filters">{filters.map(item => <Link key={item.key} to={`${projectPath(projectId, "now")}${item.key ? `?filter=${item.key}` : ""}`} aria-current={(filter ?? "") === item.key ? "page" : undefined}>{item.label}</Link>)}</nav>
    {filter === "failed" && <p className="attention-guidance">Only unresolved failures from current activation runs appear here. Retried and settled attempts remain in <Link to={projectPath(projectId, "runs")}>run history</Link>.</p>}
    {!validFilter && <section className="empty-state"><h2>Unknown attention filter</h2><p>Choose a category above or return to all attention.</p><Link className="button button-secondary" to={projectPath(projectId, "now")}>Show all attention</Link></section>}
    {validFilter && <div className="attention-list">{(!filter || filter === "blocked") && blocked.map(entry => <GoalBlockerCard key={entry.goal.id} data={data} entry={entry} />)}{records.map(item => {
      const body = <><i className={item.type}/><div><span>{item.type}</span><h2>{item.title}</h2><p>{item.body}</p></div><StatusBadge value={item.status}/>{item.href && <Icon name="arrow"/>}</>;
      return item.href ? <Link key={`${item.type}-${item.id}`} to={item.href}>{body}</Link> : <article key={`${item.type}-${item.id}`}>{body}</article>;
    })}{!records.length && ((filter && filter !== "blocked") || !blocked.length) && <div className="empty-state"><Icon name={needsSetup ? "target" : "check"}/><h2>{needsSetup ? "No projects in this scope" : filter === "blocked" ? "No goal blockers" : filter ? "No matching attention" : "Queue clear"}</h2><p>{needsSetup ? "Add a project to organize outcomes, then create a goal and choose its workflow." : filter === "blocked" ? "No blocked activations or unresolved goal errors in this scope." : "Nothing in this category needs intervention."}</p>{needsSetup && <Link className="button button-secondary" to="/settings">Set up a project</Link>}</div>}</div>}
  </div>;
}

export function GoalsView({ data, projectId, create }: { data: MissionControlData; projectId?: string; create: boolean }) {
  const location = useLocation();
  const [search] = useSearchParams();
  const contextId = search.get("context");
  const projects = data.projects.filter((project) => !contextId || project.executionContextId === contextId);
  const goals = data.goals.filter((goal) => !projectId || goal.projectId === projectId);
  return <div className="standard-view">
    <ViewHeader eyebrow="Outcome inventory" title="Goals" copy="Requested outcomes and their execution progress." action={!create && <Link className="button button-primary" to={`${projectPath(projectId, "goals")}/new${contextId ? `?context=${encodeURIComponent(contextId)}` : ""}`}><Icon name="plus" /> New goal</Link>} />
    {create && !projectId && <section className="create-panel" aria-labelledby="choose-goal-project">
      <header><div><span>New goal</span><h2 id="choose-goal-project">Choose a project</h2></div><Link className="button button-secondary" to={`/goals${contextId ? `?context=${encodeURIComponent(contextId)}` : ""}`}>Cancel</Link></header>
      <p>Every goal belongs to a project. Choose where this outcome should live.</p>
      <div className="project-choice-list">{projects.map((project) => <Link className="button button-secondary" key={project.id} to={`${projectPath(project.id, "goals")}/new`}>
        {project.name}{!contextId && <small> · {data.executionContexts.find((context) => context.id === project.executionContextId)?.name}</small>}<Icon name="arrow" />
      </Link>)}</div>
      {!projects.length && <p>{contextId ? "No projects in this execution context. Add one in Settings or choose another context." : "Add a project in Settings before creating a goal."}</p>}
      {!projects.length && <Link className="button button-secondary" to="/settings">Set up a project</Link>}
    </section>}
    {create && projectId && <GoalCreation key={`${projectId}:${location.search}`} projectId={projectId} graphs={data.senderoGraphs} />}
    <div className="entity-table"><header><span>Goal</span><span>State</span><span>Execution</span><span>Updated</span></header>{goals.map((goal) => {
      const execution = goalExecution(data, goal.id);
      const project = data.projects.find((item) => item.id === goal.projectId);
      const context = data.executionContexts.find((item) => item.id === project?.executionContextId);
      const scope = [...(!projectId && !contextId ? [context?.name ?? "Unknown context"] : []), ...(!projectId ? [project?.name ?? goal.projectId] : []), goal.kind];
      return <Link key={goal.id} to={goalPath(goal.projectId, goal.id)}><div><i className={`kind-dot ${goal.kind}`} /><span><strong>{goal.title}</strong><small>{scope.join(" · ")}</small></span></div><StatusBadge value={goal.status} /><span>{execution.latestAttempt ? `${execution.attempts.filter((item) => !["succeeded", "failed", "canceled"].includes(item.status)).length} active · ${execution.attempts.length} attempts` : "Not dispatched"}</span><span>{relativeTime(goal.updatedAt, data.asOf)}</span></Link>;
    })}{!goals.length && <div className="empty-state"><Icon name="target" /><h2>No goals in this scope</h2><p>Change the execution context or project filters, or create a goal inside a project.</p></div>}</div>
  </div>;
}

export function RunsView({ data, attemptId }: { data: MissionControlData; attemptId?: string }) {
  const location = useLocation();
  const url = new URL(`${location.pathname}${location.search}`, 'http://studio.local');
  const page = runHistoryPage(data.attempts, url, attemptId);
  const projectId = url.searchParams.get('project') || parseStudioPath(location.pathname).projectId;
  const searchFor = (cursor?: string | null, direction?: string | null) => {
    const search = new URLSearchParams(location.search);
    search.delete('runCursor'); search.delete('runHistory');
    if (cursor && direction) { search.set('runCursor', cursor); search.set('runHistory', direction); }
    return search.size ? `?${search}` : '';
  };
  const destination = (cursor?: string | null, direction?: string) => `${projectPath(projectId ?? undefined, 'runs')}${searchFor(cursor, direction)}#run-history`;
  const runById = new Map(data.runs.map(run => [run.id, run]));
  const goalById = new Map(data.goals.map(goal => [goal.id, goal]));
  const projectById = new Map(data.projects.map(project => [project.id, project]));
  const contextById = new Map(data.executionContexts.map(context => [context.id, context]));
  return <div className="standard-view"><ViewHeader eyebrow="Execution history" title="Runs & attempts" copy="Every logical execution and concrete host attempt, with retries and results preserved." />
    <div className="activity-page-header"><h2 id="run-history" tabIndex={-1}>{page.historical ? 'Attempt history' : 'Latest attempts'}</h2><p>{page.items.length} attempts on this page · {page.total} in this scope · newest first</p></div>
    {page.notice && <p role="status">{page.notice}</p>}
    <nav className="activity-pagination" aria-label="Run history pagination">
      {page.newer ? <Link className="button button-secondary" to={destination(page.newer, 'newer')}>Newer attempts</Link> : <span>{page.historical ? 'No newer attempts on this page' : 'At latest attempts'}</span>}
      {page.older && <Link className="button button-secondary" to={destination(page.older, 'older')}>Older attempts</Link>}
      {page.historical && <Link to={destination()}>Latest attempts</Link>}
    </nav>
    {attemptId && data.attempts.some(attempt => attempt.id === attemptId) && !page.items.some(attempt => attempt.id === attemptId) && <p role="status">The selected attempt is outside this page. Its complete recorded details remain below. <Link to={`${location.pathname}${searchFor()}#run-history`}>Show selected attempt in history</Link></p>}
    <div className="run-layout"><div className="run-list" role="list" aria-label="Run attempts">{page.items.map(attempt => {
      const run = runById.get(attempt.runId); const goal = run && goalById.get(run.goalId);
      const project = goal && projectById.get(goal.projectId); const context = project && contextById.get(project.executionContextId);
      return <div role="listitem" key={attempt.id}><Link aria-current={attempt.id === (attemptId ?? page.items[0]?.id) ? 'true' : undefined} className={attempt.id === (attemptId ?? page.items[0]?.id) ? 'selected' : ''} to={`${attemptPath(goal?.projectId, attempt.id)}${searchFor(page.current, page.direction)}#run-detail`}><i aria-hidden="true" className={`run-state ${attempt.status}`} /><div><strong>{goal?.title ?? attempt.executionObjective}</strong><span>{context?.name ?? 'Unknown context'} · {project?.name ?? 'Unknown project'} · attempt {attempt.attemptNumber}</span></div><StatusBadge value={executionPhase(attempt)} /><time dateTime={attempt.updatedAt}>{relativeTime(attempt.updatedAt, data.asOf)}</time></Link></div>;
    })}{!page.items.length && <div className="empty-state"><h3>{page.historical ? 'No attempts at this history position' : 'No attempts in this scope'}</h3><p>{page.historical ? 'Return to latest attempts to continue browsing.' : 'Reserved runs and host-reported attempts will appear here.'}</p></div>}</div><RunDetail data={data} attemptId={attemptId ?? page.items[0]?.id} /></div>
  </div>;
}

function RunDetail({ data, attemptId }: { data: MissionControlData; attemptId?: string }) {
  const attempt = data.attempts.find(item => item.id === attemptId);
  if (!attempt) return <div className="empty-state">
    <h2>{attemptId ? "Attempt not found" : "No execution history"}</h2>
    <p>{attemptId ? "This attempt is unavailable in the selected scope. Choose another attempt or change the project filter." : "Reserved runs and host-reported attempts will appear here."}</p>
  </div>;
  const run = data.runs.find(item => item.id === attempt.runId);
  const goal = data.goals.find(item => item.id === run?.goalId);
  const snapshot = parseAttemptSnapshot(attempt.statusSnapshotJson);
  const terminal = ["succeeded", "failed", "canceled"].includes(attempt.status);
  return <aside className="run-detail" id="run-detail" tabIndex={-1} aria-label="Selected attempt details">
    <header><span>Attempt detail</span><StatusBadge value={attempt.status} /></header>
    <h2>{goal?.title}</h2><p>{attempt.executionObjective}</p>
    {goal && <Link className="button button-secondary" to={canvasEntityPath({ projectId: goal.projectId, goalId: goal.id, attemptId: attempt.id })}>
      {terminal ? "Open execution" : "Review this attempt"}<Icon name="arrow" />
    </Link>}
    <RetryLineage data={data} attempt={attempt} surface="runs" />
    <div className="detail-summary"><span>Evidence</span><strong>{snapshot.evidence?.length ?? 0}</strong><span>Review</span><strong>{snapshot.review?.status?.replaceAll("_", " ") ?? "none"}</strong></div>
    <EvidenceRecords asOf={data.asOf} snapshot={snapshot} />
    <details className="inspector-disclosure"><summary>Technical details</summary>
    <dl className="property-list">
      <div><dt>Harness</dt><dd>{attempt.harness}</dd></div>
      <div><dt>Working path</dt><dd className="mono">{attempt.workingPath ?? "—"}</dd></div>
      <div><dt>Checkpoint</dt><dd>{attempt.checkpoint ?? "—"}</dd></div>
      <div><dt>Heartbeat</dt><dd>{relativeTime(attempt.heartbeatAt, data.asOf)}</dd></div>
      <div><dt>Retry from</dt><dd className="mono">{attempt.retryFromAttemptId ?? "—"}</dd></div>
    </dl>
    </details>
    <HostExecutionRecords data={data} attempt={attempt} />
    {goal && <GoalActivations data={data} goalId={goal.id} attemptId={attempt.id} />}
    {attempt.failureSummary && <div className="failure-callout"><strong>Failure summary</strong><p>{attempt.failureSummary}</p></div>}
  </aside>;
}

export function ReviewsView({data}:{data:MissionControlData}){const attempts=data.attempts.filter(a=>{const s=parseAttemptSnapshot(a.statusSnapshotJson);return s.evidence?.length||s.review});return <div className="standard-view"><ViewHeader eyebrow="Quality gate" title="Evidence reviews" copy="Make decisions against concrete proof attached to the exact execution that produced it."/><div className="review-grid">{attempts.map(attempt=>{const s=parseAttemptSnapshot(attempt.statusSnapshotJson);const run=data.runs.find(r=>r.id===attempt.runId);const goal=data.goals.find(g=>g.id===run?.goalId);return <article key={attempt.id}><header><StatusBadge value={s.review?.status??"pending"}/><ReviewTimestamp snapshot={s} updatedAt={attempt.updatedAt} asOf={data.asOf} /></header><h2>{attempt.executionObjective}</h2><p>{s.evidence?.length??0} evidence items · {attempt.harness}</p><Link to={attemptPath(goal?.projectId??"unknown",attempt.id)}>Inspect evidence <Icon name="arrow"/></Link></article>})}{!attempts.length && <div className="empty-state"><Icon name="check"/><h2>No evidence to review</h2><p>Evidence and review decisions will appear here after an attempt reports its results.</p><Link className="button button-secondary" to="/runs">View runs</Link></div>}</div></div>}

export function AgentsView({data, agentId, create = false}:{data:MissionControlData; agentId?: string; create?: boolean}){return <div className="standard-view"><ViewHeader eyebrow="Execution topology" title="Agents & transitions" copy="Custom roles and instructions for any workflow. Published Senderos pin their definitions." action={<Link className="button button-primary" to="/agents/new">New agent</Link>}/><AgentAuthoring data={data} agentId={agentId} create={create}/><div className="agent-grid">{data.agents.map(agent=>{const outgoing=data.transitions.filter(t=>t.sourceAgentId===agent.id);return <article key={agent.id}><header><div className="agent-avatar"><Icon name="spark"/></div><StatusBadge value={agent.status}/></header><h2>{agent.name}</h2><p>{agent.description||agent.defaultGoal||"Persisted Senderos executor."}</p><footer><span>{agent.kind}</span><strong>{outgoing.length} transitions</strong><Link to={`/agents/${encodeURIComponent(agent.id)}`}>Edit agent</Link></footer></article>})}{!data.agents.length && <div className="empty-state"><Icon name="spark"/><h2>No agents yet</h2><p>Create an agent to define its role, instructions, and completion criteria for your Senderos.</p></div>}</div></div>}

export { EventsView } from './activity-history';

export function SettingsView(props:{data:MissionControlData;projectId?:string}) {
  const location = useLocation();
  return <SettingsEditor key={`${props.projectId ?? ""}:${location.search}`} {...props} />;
}
function SettingsEditor({data,projectId}:{data:MissionControlData;projectId?:string}) {
  const [settingsDirty, setSettingsDirty] = useState(false);
  const project=data.projects.find(p=>p.id===projectId)??data.projects[0];
  return <SettingsDraftBoundary settingsDirty={settingsDirty}><div className="settings-content settings-grid">{!project && <section className="settings-section settings-empty"><h2>No project in this scope</h2><p>Add a project below or choose another scope to configure an existing project.</p></section>}{project&&<ProjectSettings key={project.id} project={project} dirty={settingsDirty} onDirtyChange={setSettingsDirty} />}
    <LocalRegistration data={data} projectId={projectId} />
    <section className="settings-section"><header><div><Icon name="database"/><span><h2>Shared database</h2><p>Studio connects directly; no local Senderos home or config file is required.</p></span></div><span className="connected-label"><i/> Connected</span></header><div className="settings-fields"><Setting label="Endpoint" value={data.runtime.database.endpoint}/><Setting label="Connection mode" value={data.runtime.database.remote?"Remote libSQL":"Local libSQL"}/><Setting label="Database URL variable" value={data.runtime.database.urlEnv}/><Setting label="Auth token variable" value={data.runtime.database.authTokenEnv}/></div></section>
  </div></SettingsDraftBoundary>}
function Setting({label,value}:{label:string;value:string}){return <label>{label}<input value={value} disabled/><small>Loaded from the active Senderos runtime.</small></label>}
