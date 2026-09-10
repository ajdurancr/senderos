import { AttentionRail } from "./components/attention-rail";
import { ContextualInspector } from "./components/contextual-inspector";
import { DispatchTray } from "./components/dispatch-tray";
import { Icon } from "./components/icons";
import { OrchestrationCanvas } from "./components/orchestration-canvas";
import {
  AgentsView,
  AttentionView,
  EventsView,
  GoalsView,
  ReviewsView,
  RunsView,
  SettingsView,
} from "./components/workspace-views";
import type { MissionControlData } from "./server";

export function MissionControlOverview({ data, params }: { data: MissionControlData; params: URLSearchParams }) {
  const view = params.get("view") ?? "canvas";
  const projectId = params.get("project") ?? data.projects[0]?.id;
  const goalId = params.get("goal") ?? undefined;
  const attemptId = params.get("attempt") ?? undefined;
  const transitionId = params.get("transition") ?? undefined;

  if (view === "now") return <AttentionView data={data} filter={params.get("filter") ?? undefined} projectId={projectId}/>;
  if (view === "goals") return <GoalsView data={data} projectId={projectId} create={params.get("create") === "true"}/>;
  if (view === "runs") return <RunsView data={data} attemptId={attemptId}/>;
  if (view === "reviews") return <ReviewsView data={data}/>;
  if (view === "agents") return <AgentsView data={data}/>;
  if (view === "events") return <EventsView data={data}/>;
  if (view === "settings") return <SettingsView data={data} projectId={projectId}/>;

  const selectedGoal = goalId ?? data.goals.find((goal) => goal.projectId === projectId)?.id;
  return <div className={`canvas-workspace ${selectedGoal ? "with-inspector" : ""}`}>
    <section className="canvas-column">
      <header className="canvas-page-header"><div><span>Project canvas</span><h1>Orchestration topology</h1><p>Follow durable intent through each planned handoff, execution, and review.</p></div><button className="view-mode"><Icon name="nodes"/> Goal flow <Icon name="arrow"/></button></header>
      <AttentionRail data={data} projectId={projectId}/>
      <OrchestrationCanvas data={data} projectId={projectId} goalId={selectedGoal}/>
      {params.get("plan") === "true" && <DispatchTray data={data}/>}
    </section>
    <ContextualInspector data={data} goalId={selectedGoal} attemptId={attemptId} transitionId={transitionId}/>
  </div>;
}
