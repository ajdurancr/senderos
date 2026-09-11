import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";

import { DurableLink as Link } from "../../../components/durable-link";
import { StatusBadge } from "../../../components/status-badge";
import {
  automaticCanvasLayout,
  canvasBounds,
  canvasNodeSize,
  canvasNodeStyle,
  type CanvasPoint,
  type CanvasPositions,
} from "../canvas-layout";
import { goalExecution, relativeTime } from "../model";
import { canvasAgentPath, canvasEntityPath, senderoPath } from "../navigation";
import type { MissionControlData } from "../server";
import { Icon } from "./icons";

export function OrchestrationCanvas({
  data,
  projectId,
  goalId,
  senderoId,
}: {
  data: MissionControlData;
  projectId?: string;
  goalId?: string;
  senderoId?: string;
}) {
  const fetcher = useFetcher();
  const projectGoals = data.goals.filter(
    (goal) => !projectId || goal.projectId === projectId,
  );
  const goal =
    projectGoals.find((item) => item.id === goalId) ??
    projectGoals.find((item) =>
      ["active", "failed", "blocked"].includes(item.status),
    ) ??
    projectGoals[0];
  const execution = goal
    ? goalExecution(data, goal.id)
    : {
        runs: [],
        attempts: [],
        latestRun: undefined,
        latestAttempt: undefined,
      };
  const graph =
    data.senderoGraphs.find((item) => item.sendero.id === senderoId) ??
    data.senderoGraphs.find(
      (item) => item.version.id === goal?.senderoVersionId,
    ) ??
    data.senderoGraphs[0];
  const defaults = useMemo(
    () =>
      Object.fromEntries(
        (graph?.nodes ?? []).map((node) => [
          node.id,
          { x: node.positionX, y: node.positionY },
        ]),
      ),
    [graph],
  );
  const [positions, setPositions] = useState<CanvasPositions>(defaults);
  const moved = useRef(false);
  useEffect(() => setPositions(defaults), [defaults]);

  if (!graph)
    return (
      <section className="canvas-empty">
        <Icon name="nodes" />
        <h2>No Senderos available</h2>
        <p>The shared database has no published Sendero definition.</p>
      </section>
    );

  const persist = (id: string, point: CanvasPoint) =>
    fetcher.submit(
      {
        intent: "update-sendero-node-position",
        nodeId: id,
        positionX: String(point.x),
        positionY: String(point.y),
      },
      { method: "post" },
    );
  const drag = (id: string, event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const origin = positions[id];
    const start = { x: event.clientX, y: event.clientY };
    const target = event.currentTarget;
    moved.current = false;
    const move = (next: PointerEvent) => {
      const dx = next.clientX - start.x,
        dy = next.clientY - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true;
      setPositions((current) => ({
        ...current,
        [id]: {
          x: Math.max(12, origin.x + dx),
          y: Math.max(48, origin.y + dy),
        },
      }));
    };
    const end = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      setPositions((current) => {
        persist(id, current[id]);
        return current;
      });
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
  };
  const reset = () => {
    const next = automaticCanvasLayout(graph.nodes.map((node) => node.id));
    setPositions(next);
    fetcher.submit(
      { intent: "update-sendero-layout", positions: JSON.stringify(next) },
      { method: "post" },
    );
  };
  const latestAttempt = execution.latestAttempt;
  const { width, height } = canvasBounds(positions);
  const graphPath = (selection?: { nodeId?: string; edgeId?: string }) =>
    senderoPath(graph.sendero.id, selection);

  return (
    <section className="canvas-panel">
      <header className="canvas-toolbar">
        <div>
          <span className="canvas-label">
            Sendero · v{graph.version.version}
          </span>
          <strong>{graph.sendero.name}</strong>
          <StatusBadge value={graph.sendero.status} />
        </div>
        <div className="canvas-controls">
          <span>Drag nodes · select nodes and arcs</span>
          <button type="button" onClick={reset}>
            Auto layout
          </button>
        </div>
      </header>
      <div
        className="canvas-grid interactive"
        style={{ height: Math.min(700, height) }}
      >
        <div className="canvas-stage" style={{ width, height }}>
          <div className="canvas-watermark">
            SENDERO · {goal ? "LIVE EXECUTION OVERLAY" : "DEFINITION"}
          </div>
          <svg className="canvas-edges" width={width} height={height}>
            {graph.edges.map((edge) => {
              const from = positions[edge.sourceNodeId],
                to = positions[edge.targetNodeId];
              if (!from || !to) return null;
              const active = edge.id === latestAttempt?.transitionId;
              const href = goal
                ? canvasEntityPath({
                    projectId: goal.projectId,
                    goalId: goal.id,
                    transitionId: edge.id,
                    attemptId: active ? latestAttempt?.id : undefined,
                  })
                : graphPath({ edgeId: edge.id });
              const coordinates = {
                x1: from.x + canvasNodeSize.width,
                y1: from.y + canvasNodeSize.height / 2,
                x2: to.x,
                y2: to.y + canvasNodeSize.height / 2,
              };
              return (
                <Link
                  key={edge.id}
                  to={href}
                  title={`${edge.name}: ${edge.description || edge.transitionObjective}`}
                  aria-label={`Inspect transition ${edge.name}`}
                >
                  <line className="edge-hit-target" {...coordinates} />
                  <line
                    className={`edge-line ${active ? "active" : ""}`}
                    {...coordinates}
                  />
                  <text
                    x={(from.x + canvasNodeSize.width + to.x) / 2}
                    y={(from.y + to.y + canvasNodeSize.height) / 2 - 8}
                  >
                    {active
                      ? `running · ${latestAttempt?.attemptNumber}`
                      : edge.name}
                  </text>
                </Link>
              );
            })}
          </svg>
          {graph.nodes.map((node) => {
            const agent = data.agents.find((item) => item.id === node.agentId);
            const current = Boolean(
              agent && latestAttempt?.agentId === agent.id,
            );
            const attempts = agent
              ? execution.attempts.filter(
                  (attempt) => attempt.agentId === agent.id,
                )
              : [];
            const className =
              node.kind === "start"
                ? "intent-node complete"
                : node.kind === "end"
                  ? `review-node ${goal?.status === "completed" ? "complete" : "waiting"}`
                  : `agent-node ${current ? (latestAttempt?.status === "failed" ? "failed" : "active") : "waiting"}`;
            const href =
              goal && agent
                ? canvasAgentPath(goal.projectId, goal.id, agent.id)
                : graphPath({ nodeId: node.id });
            const point = positions[node.id];
            const nodeKind =
              node.kind === "agent"
                ? "Agent"
                : node.kind === "start"
                  ? "Start"
                  : "End";
            const nodeTitle = [
              `${nodeKind}: ${agent?.name ?? node.label}`,
              agent?.description ??
                (node.kind === "start"
                  ? graph.sendero.description
                  : node.kind === "end"
                    ? "The verified endpoint for this Sendero."
                    : undefined),
            ]
              .filter(Boolean)
              .join(" — ");
            return (
              <Link
                draggable={false}
                key={node.id}
                className={`${className} draggable-node`}
                style={canvasNodeStyle(point)}
                title={nodeTitle}
                aria-label={`Inspect ${node.kind} ${agent?.name ?? node.label}`}
                onPointerDown={(event) => drag(node.id, event)}
                onDragStart={(event) => event.preventDefault()}
                onClick={(event) => {
                  if (moved.current) {
                    event.preventDefault();
                    moved.current = false;
                  }
                }}
                to={href}
              >
                <div className="node-top">
                  <span>{node.kind.toUpperCase()}</span>
                  <i />
                </div>
                {node.kind === "agent" ? (
                  <div className="agent-avatar">
                    <Icon name="spark" />
                  </div>
                ) : (
                  <Icon name={node.kind === "start" ? "target" : "check"} />
                )}
                <h3>{agent?.name ?? node.label}</h3>
                {agent && (
                  <footer>
                    <span>{attempts.length} attempts</span>
                    <span>
                      {current ? relativeTime(latestAttempt?.updatedAt) : "Ready"}
                    </span>
                  </footer>
                )}
              </Link>
            );
          })}
        </div>
      </div>
      <footer className="canvas-legend">
        <span>
          <i className="complete" /> Complete
        </span>
        <span>
          <i className="active" /> Current location
        </span>
        <span>
          <i className="failed" /> Failed
        </span>
        <span>
          <i /> Available
        </span>
        <em>Layout is shared through the Senderos database</em>
      </footer>
    </section>
  );
}
