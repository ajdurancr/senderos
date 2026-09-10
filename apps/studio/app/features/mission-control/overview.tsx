import { AttentionRail } from "./components/attention-rail";
import { ContextualInspector } from "./components/contextual-inspector";
import { DispatchTray } from "./components/dispatch-tray";
import { Icon } from "./components/icons";
import { OrchestrationCanvas } from "./components/orchestration-canvas";
import { SenderoInspector } from "./components/sendero-inspector";
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
import { type StudioLocation } from "./navigation";

export function MissionControlOverview({ data, route, search }: { data: MissionControlData; route: StudioLocation; search: URLSearchParams }) {
  const { view, goalId, agentId, attemptId, transitionId } = route;
  const projectId = route.projectId ?? data.projects[0]?.id;

  if (view === "senderos") {
    const graph = data.senderoGraphs.find((item) => item.sendero.id === route.senderoId) ?? data.senderoGraphs[0];
    if (!graph) return <div className="standard-view"><div className="empty-state"><Icon name="nodes"/><h2>No Senderos available</h2><p>Create or seed a trail definition in the shared database.</p></div></div>;
    return <div className="canvas-workspace with-inspector"><section className="canvas-column"><header className="canvas-page-header"><div><span>Sendero definition</span><h1>{graph.sendero.name}</h1><p>{graph.sendero.description}</p></div><button className="view-mode"><Icon name="nodes"/> Version {graph.version.version} <Icon name="arrow"/></button></header><OrchestrationCanvas data={data} senderoId={graph.sendero.id}/></section><SenderoInspector data={data} senderoId={graph.sendero.id} nodeId={route.senderoNodeId} edgeId={route.senderoEdgeId}/></div>;
  }

  if (view === "now") return <AttentionView data={data} filter={search.get("filter") ?? undefined} projectId={projectId}/>;
  if (view === "goals") return <GoalsView data={data} projectId={projectId} create={route.create}/>;
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
      {search.get("plan") === "true" && <DispatchTray data={data}/>}
    </section>
    <ContextualInspector data={data} goalId={selectedGoal} agentId={agentId} attemptId={attemptId} transitionId={transitionId}/>
  </div>;
}
