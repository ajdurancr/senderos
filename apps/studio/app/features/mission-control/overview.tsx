import { useEffect, useState } from "react";
import { DurableLink as Link } from "../../components/durable-link";
import { SenderoCreation, SenderoGraphEditor } from "./components/sendero-authoring";
import { AttentionRail } from "./components/attention-rail";
import { ContextualInspector } from "./components/contextual-inspector";
import { DispatchTray } from "./components/dispatch-tray";
import { Icon } from "./components/icons";
import { OrchestrationCanvas } from "./components/orchestration-canvas";
import { SenderoInspector } from "./components/sendero-inspector";
import { SenderoSelector } from "./components/sendero-selector";
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

export function MissionControlOverview({
  data,
  route,
  search,
}: {
  data: MissionControlData;
  route: StudioLocation;
  search: URLSearchParams;
}) {
  const { view, goalId, agentId, attemptId, transitionId } = route;
  const [hasUnsavedGraph, setHasUnsavedGraph] = useState(false);
  useEffect(() => setHasUnsavedGraph(false), [view, route.senderoId]);
  const projectId = search.get("project") ?? route.projectId;

  if (view === "senderos" && route.create) return <SenderoCreation />;

  if (view === "senderos") {
    data = { ...data, senderoGraphs: [...data.senderoGraphs.map(g => data.draftGraphs?.find(d => d.sendero.id === g.sendero.id) ?? g), ...(data.draftGraphs ?? []).filter(d => !data.senderoGraphs.some(g => g.sendero.id === d.sendero.id))] };
    const graph = route.senderoId
      ? data.senderoGraphs.find((item) => item.sendero.id === route.senderoId)
      : data.senderoGraphs[0];
    if (!graph)
      return (
        <div className="standard-view">
          <div className="empty-state">
            <Icon name="nodes" />
            <h2>{data.senderoGraphs.length ? "Sendero not found" : "No Senderos available"}</h2>
            <p>Create a custom Sendero or import a definition.</p>
            <Link className="primary-action" to="/senderos/new">New Sendero</Link>
          </div>
        </div>
      );
    return (
      <div className="canvas-workspace with-inspector">
        <section className="canvas-column">
          <header className="canvas-page-header">
            <div>
              <span>Sendero definition</span>
              <h1>{graph.sendero.name}</h1>
              <p>{graph.sendero.description}</p>
            </div>
            <div className="authoring-actions"><SenderoSelector data={data} senderoId={graph.sendero.id} /><Link className="primary-action" to="/senderos/new">New Sendero</Link></div>
          </header>
          <OrchestrationCanvas data={data} senderoId={graph.sendero.id} readOnlyLayout={hasUnsavedGraph} />
          <SenderoGraphEditor graph={graph} agents={data.agents} onDirtyChange={setHasUnsavedGraph} />
        </section>
        <SenderoInspector
          data={data}
          senderoId={graph.sendero.id}
          hasUnsavedGraph={hasUnsavedGraph}
          nodeId={route.senderoNodeId}
          edgeId={route.senderoEdgeId}
        />
      </div>
    );
  }

  if (view === "now")
    return (
      <AttentionView
        data={data}
        filter={search.get("filter") ?? undefined}
        projectId={projectId}
      />
    );
  if (view === "goals")
    return (
      <GoalsView data={data} projectId={projectId} create={route.create} />
    );
  if (view === "runs") return <RunsView data={data} attemptId={attemptId} />;
  if (view === "reviews") return <ReviewsView data={data} />;
  if (view === "agents") return <AgentsView data={data} agentId={route.agentId} create={route.create} />;
  if (view === "events") return <EventsView data={data} />;
  if (view === "settings")
    return <SettingsView data={data} projectId={projectId} />;

  const canvasProjectId = projectId ?? data.projects[0]?.id;
  const selectedGoal =
    goalId ?? data.goals.find((goal) => goal.projectId === canvasProjectId)?.id;
  return (
    <div className={`canvas-workspace ${selectedGoal ? "with-inspector" : ""}`}>
      <section className="canvas-column">
        <header className="canvas-page-header">
          <div>
            <span>Project canvas</span>
            <h1>Orchestration topology</h1>
            <p>
              Follow durable intent through each planned handoff, execution, and
              review.
            </p>
          </div>
          <button className="view-mode">
            <Icon name="nodes" /> Goal flow <Icon name="arrow" />
          </button>
        </header>
        <AttentionRail data={data} projectId={canvasProjectId} />
        <OrchestrationCanvas
          data={data}
          projectId={canvasProjectId}
          goalId={selectedGoal}
        />
        {search.get("plan") === "true" && <DispatchTray data={data} scope={{ executionContextId: search.get("context") ?? undefined, projectId }} />}
      </section>
      <ContextualInspector
        data={data}
        goalId={selectedGoal}
        agentId={agentId}
        nodeId={route.workflowNodeId}
        attemptId={attemptId}
        transitionId={transitionId}
      />
    </div>
  );
}
