import { activationRecords } from "./execution-records";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { flushSync } from "react-dom";

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
import { canvasNodePath, canvasEntityPath, senderoPath } from "../navigation";
import type { MissionControlData } from "../server";
import { Icon } from "./icons";

export function OrchestrationCanvas({
  data,
  projectId,
  goalId,
  senderoId,
  readOnlyLayout = false,
}: {
  data: MissionControlData;
  projectId?: string;
  goalId?: string;
  senderoId?: string;
  readOnlyLayout?: boolean;
}) {
  const fetcher = useFetcher();
  const projectGoals = data.goals.filter(
    (goal) => !projectId || goal.projectId === projectId,
  );
  const goal = senderoId ? undefined : (
    projectGoals.find((item) => item.id === goalId) ??
    projectGoals.find((item) =>
      ["active", "failed", "blocked"].includes(item.status),
    ) ??
    projectGoals[0]);
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
    (data.historyGraphs ?? data.senderoGraphs).find(
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
  const dragCleanup = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => dragCleanup.current?.(), [graph?.version.id]);
  useEffect(() => setPositions(defaults), [defaults]);
  // A cloned version can introduce new node IDs before the reset effect runs.
  // Every geometry read must already use coordinates for the current graph.
  const graphPositions = useMemo<CanvasPositions>(() => Object.fromEntries(
    Object.entries(defaults).map(([id, point]) => [id, positions[id] ?? point]),
  ), [defaults, positions]);

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
        intent: "update-sendero-layout",
        senderoId: graph.sendero.id,
        expectedVersionId: graph.version.id,
        expectedRevision: graph.revision ?? '',
        positions: JSON.stringify({ [id]: point }),
      },
      { method: "post" },
    );
  const drag = (id: string, event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || fetcher.state !== 'idle' || readOnlyLayout) return;
    dragCleanup.current?.();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const origin = graphPositions[id];
    const start = { x: event.clientX, y: event.clientY };
    const target = event.currentTarget;
    let last = origin;
    moved.current = false;
    const cleanup = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', end);
      target.removeEventListener('pointercancel', cancel);
      target.removeEventListener('lostpointercapture', cancel);
      window.removeEventListener('keydown', escape);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('pagehide', leave);
      dragCleanup.current = undefined;
    };
    const move = (next: PointerEvent) => {
      const dx = next.clientX - start.x, dy = next.clientY - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true;
      last = { x: Math.max(12, origin.x + dx), y: Math.max(48, origin.y + dy) };
      setPositions(current => ({ ...current, [id]: last }));
    };
    const end = () => { cleanup(); if (moved.current) persist(id, last); };
    const cancel = () => { cleanup(); moved.current = true; setPositions(current => ({ ...current, [id]: origin })); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    // Restore the persisted preview before the browser freezes this document
    // into its back/forward cache; an interrupted gesture is never a save.
    const leave = () => flushSync(cancel);
    dragCleanup.current = cleanup;
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', cancel);
    target.addEventListener('lostpointercapture', cancel);
    window.addEventListener('keydown', escape);
    window.addEventListener('blur', cancel);
    window.addEventListener('pagehide', leave);
  };
  const reset = () => {
    const next = automaticCanvasLayout(graph.nodes.map((node) => node.id));
    setPositions(next);
    fetcher.submit(
      { intent: "update-sendero-layout", senderoId: graph.sendero.id, expectedVersionId: graph.version.id, expectedRevision: graph.revision ?? "", positions: JSON.stringify(next) },
      { method: "post" },
    );
  };
  const latestAttempt = execution.latestAttempt;
  const activeAttempts = execution.attempts.filter(attempt => !["succeeded", "failed", "canceled"].includes(attempt.status));
  const activations = activationRecords(data).filter(activation => activation.goalId === goal?.id);
  const { width, height } = canvasBounds(graphPositions);
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
          <button type="button" onClick={reset} disabled={fetcher.state !== "idle" || readOnlyLayout}>
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
            <defs><marker id={`arrow-${graph.version.id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#81a69e" /></marker></defs>
            {graph.edges.map((edge) => {
              const from = graphPositions[edge.sourceNodeId],
                to = graphPositions[edge.targetNodeId];
              if (!from || !to) return null;
              const activeAttempt = activeAttempts.find(attempt => edge.id === attempt.transitionId);
              const active = Boolean(activeAttempt);
              const href = goal
                ? canvasEntityPath({
                    projectId: goal.projectId,
                    goalId: goal.id,
                    transitionId: edge.id,
                    attemptId: activeAttempt?.id,
                  })
                : graphPath({ edgeId: edge.id });
              const coordinates = {
                x1: from.x + canvasNodeSize.width,
                y1: from.y + canvasNodeSize.height / 2,
                x2: to.x,
                y2: to.y + canvasNodeSize.height / 2,
              };
              const backedge = coordinates.x2 <= coordinates.x1;
              const arc = backedge
                ? `M ${coordinates.x1} ${coordinates.y1} C ${coordinates.x1 + 60} ${coordinates.y1 - 110}, ${coordinates.x2 - 60} ${coordinates.y2 - 110}, ${coordinates.x2} ${coordinates.y2}`
                : `M ${coordinates.x1} ${coordinates.y1} C ${coordinates.x1 + 50} ${coordinates.y1}, ${coordinates.x2 - 50} ${coordinates.y2}, ${coordinates.x2} ${coordinates.y2}`;
              return (
                <Link
                  key={edge.id}
                  to={href}
                  title={`${edge.name}: ${edge.description || edge.transitionObjective}`}
                  aria-label={`Inspect transition ${edge.name}`}
                >
                  <path className="edge-hit-target" d={arc} />
                  <path className={`edge-line ${active ? "active" : ""}`} d={arc} markerEnd={`url(#arrow-${graph.version.id})`} />
                  <text
                    x={(from.x + canvasNodeSize.width + to.x) / 2}
                    y={(coordinates.y1 + coordinates.y2) / 2 - (backedge ? 82.5 : 0) - 8}
                  >
                    {active
                      ? `active · ${activeAttempt?.attemptNumber}`
                      : edge.name}
                  </text>
                </Link>
              );
            })}
          </svg>
          {graph.nodes.map((node) => {
            const agent = data.agents.find((item) => item.id === node.agentId);
            const nodeActivations = activations.filter(activation => activation.nodeId === node.id);
            const nodeRuns = new Set(nodeActivations.map(activation => activation.latestRunId));
            const attempts = execution.attempts.filter(attempt => activations.length ? nodeRuns.has(attempt.runId) : agent && attempt.agentId === agent.id);
            const currentAttempts = attempts.filter(attempt => !['succeeded', 'failed', 'canceled'].includes(attempt.status));
            const current = currentAttempts.length > 0;
            const nodeAttempt = currentAttempts.at(-1) ?? attempts.at(-1);
            const className =
              node.kind === "start"
                ? "intent-node complete"
                : node.kind === "end"
                  ? `review-node ${goal?.status === "completed" ? "complete" : "waiting"}`
                  : `agent-node ${current ? "active" : nodeAttempt?.status === "failed" ? "failed" : nodeAttempt?.status === "succeeded" ? "complete" : "waiting"}`;
            const href =
              goal
                ? canvasNodePath(goal.projectId, goal.id, node.id, nodeAttempt?.id)
                : graphPath({ nodeId: node.id });
            const point = graphPositions[node.id];
            const nodeKind =
              node.kind === "agent"
                ? "Agent"
                : node.kind === "start"
                  ? "Start"
                  : "End";
            const nodeTitle = [
              `${nodeKind}: ${node.label}${agent ? ` · ${agent.name}` : ""}`,
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
                aria-label={`Inspect ${node.kind} ${node.label}`}
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
                <h3>{node.label}</h3>
                {agent && <span className="node-role" title={agent.name}>{agent.name}</span>}
                {agent && (
                  <footer>
                    <span>{nodeActivations.length || attempts.length} visits</span>
                    <span>
                      {current ? `${currentAttempts.length} active` : nodeAttempt?.status ?? "Ready"}
                    </span>
                  </footer>
                )}
              </Link>
            );
          })}
        </div>
      </div>
      {fetcher.data && typeof fetcher.data === 'object' && 'ok' in fetcher.data && !fetcher.data.ok && 'message' in fetcher.data && <p className="action-feedback error" role="alert">{String(fetcher.data.message)}</p>}
      <footer className="canvas-legend">
        <span>
          <i className="complete" /> Complete
        </span>
        <span>
          <i className="active" /> Active visits
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
