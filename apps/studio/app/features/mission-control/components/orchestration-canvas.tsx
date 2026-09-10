import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";

import { DurableLink as Link } from "../../../components/durable-link";
import { StatusBadge } from "../../../components/status-badge";
import { goalExecution, relativeTime } from "../model";
import { canvasAgentPath, canvasEntityPath, senderoPath } from "../navigation";
import type { MissionControlData } from "../server";
import { Icon } from "./icons";

type Point = { x: number; y: number };
type Positions = Record<string, Point>;
const size = { width: 190, height: 168 };

function automaticLayout(nodeIds: string[]): Positions {
  return Object.fromEntries(nodeIds.map((id, index) => [id, { x: 50 + index * 270, y: index > 0 && index < nodeIds.length - 1 && index % 2 === 0 ? 80 : 220 }]));
}

export function OrchestrationCanvas({ data, projectId, goalId, senderoId }: { data: MissionControlData; projectId?: string; goalId?: string; senderoId?: string }) {
  const fetcher = useFetcher();
  const projectGoals = data.goals.filter((goal) => !projectId || goal.projectId === projectId);
  const goal = projectGoals.find((item) => item.id === goalId) ?? projectGoals.find((item) => ["active", "failed", "blocked"].includes(item.status)) ?? projectGoals[0];
  const execution = goal ? goalExecution(data, goal.id) : { runs: [], attempts: [], latestRun: undefined, latestAttempt: undefined };
  const graph = data.senderoGraphs.find((item) => item.sendero.id === senderoId)
    ?? data.senderoGraphs.find((item) => item.version.id === goal?.senderoVersionId)
    ?? data.senderoGraphs[0];
  const defaults = useMemo(() => Object.fromEntries((graph?.nodes ?? []).map((node) => [node.id, { x: node.positionX, y: node.positionY }])), [graph]);
  const [positions, setPositions] = useState<Positions>(defaults);
  const moved = useRef(false);
  useEffect(() => setPositions(defaults), [defaults]);

  if (!graph) return <section className="canvas-empty"><Icon name="nodes"/><h2>No Senderos available</h2><p>The shared database has no published trail definition.</p></section>;

  const persist = (id: string, point: Point) => fetcher.submit({ intent: "update-sendero-node-position", nodeId: id, positionX: String(point.x), positionY: String(point.y) }, { method: "post" });
  const drag = (id: string, event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const origin = positions[id];
    const start = { x: event.clientX, y: event.clientY };
    const target = event.currentTarget;
    moved.current = false;
    const move = (next: PointerEvent) => {
      const dx = next.clientX - start.x, dy = next.clientY - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true;
      setPositions((current) => ({ ...current, [id]: { x: Math.max(12, origin.x + dx), y: Math.max(48, origin.y + dy) } }));
    };
    const end = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      setPositions((current) => { persist(id, current[id]); return current; });
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
  };
  const reset = () => {
    const next = automaticLayout(graph.nodes.map((node) => node.id));
    setPositions(next);
    fetcher.submit({ intent: "update-sendero-layout", positions: JSON.stringify(next) }, { method: "post" });
  };
  const latestAttempt = execution.latestAttempt;
  const width = Math.max(960, ...Object.values(positions).map((point) => point.x + size.width + 60));
  const height = Math.max(510, ...Object.values(positions).map((point) => point.y + size.height + 60));
  const graphPath = (selection?: { nodeId?: string; edgeId?: string }) => senderoPath(graph.sendero.id, selection);

  return <section className="canvas-panel"><header className="canvas-toolbar"><div><span className="canvas-label">Sendero · v{graph.version.version}</span><strong>{graph.sendero.name}</strong><StatusBadge value={graph.sendero.status}/></div><div className="canvas-controls"><span>Drag nodes · select nodes and arcs</span><button type="button" onClick={reset}>Auto layout</button></div></header>
    <div className="canvas-grid interactive" style={{ height: Math.min(700, height) }}><div className="canvas-stage" style={{ width, height }}><div className="canvas-watermark">DURABLE TRAIL · {goal ? "LIVE EXECUTION OVERLAY" : "DEFINITION"}</div>
      <svg className="canvas-edges" width={width} height={height}>{graph.edges.map((edge) => { const from = positions[edge.sourceNodeId], to = positions[edge.targetNodeId]; if (!from || !to) return null; const active = edge.transitionId === latestAttempt?.transitionId; const href = goal && edge.transitionId ? canvasEntityPath({ projectId: goal.projectId, goalId: goal.id, transitionId: edge.transitionId, attemptId: active ? latestAttempt?.id : undefined }) : graphPath({ edgeId: edge.id }); return <Link key={edge.id} to={href}><line className={`edge-hit ${active ? "active" : ""}`} x1={from.x + size.width} y1={from.y + size.height / 2} x2={to.x} y2={to.y + size.height / 2}/><text x={(from.x + size.width + to.x) / 2} y={(from.y + to.y + size.height) / 2 - 8}>{active ? `running · ${latestAttempt?.attemptNumber}` : edge.name}</text></Link>; })}</svg>
      {graph.nodes.map((node) => { const agent = data.agents.find((item) => item.id === node.agentId); const current = Boolean(agent && latestAttempt?.agentId === agent.id); const attempts = agent ? execution.attempts.filter((attempt) => attempt.agentId === agent.id) : []; const className = node.kind === "start" ? "intent-node complete" : node.kind === "end" ? `review-node ${goal?.status === "completed" ? "complete" : "waiting"}` : `agent-node ${current ? latestAttempt?.status === "failed" ? "failed" : "active" : "waiting"}`; const href = goal && agent ? canvasAgentPath(goal.projectId, goal.id, agent.id) : graphPath({ nodeId: node.id }); return <Link draggable={false} key={node.id} className={`${className} draggable-node`} style={positions[node.id]} onPointerDown={(event) => drag(node.id, event)} onDragStart={(event) => event.preventDefault()} onClick={(event) => { if (moved.current) { event.preventDefault(); moved.current = false; } }} to={href}><div className="node-top"><span>{node.kind.toUpperCase()} · {node.id}</span><i/></div>{node.kind === "agent" ? <div className="agent-avatar"><Icon name="spark"/></div> : <Icon name={node.kind === "start" ? "target" : "check"}/>}<h3>{agent?.name ?? node.label}</h3><p>{agent?.description ?? (node.kind === "start" ? graph.sendero.description : "Every terminal arc converges on a verified outcome.")}</p><footer><span>{agent ? `${attempts.length} attempts` : node.label}</span><span>{current ? relativeTime(latestAttempt?.updatedAt) : node.kind}</span></footer></Link>; })}
    </div></div><footer className="canvas-legend"><span><i className="complete"/> Complete</span><span><i className="active"/> Current location</span><span><i className="failed"/> Failed</span><span><i/> Available</span><em>Layout is shared through the Senderos database</em></footer></section>;
}
