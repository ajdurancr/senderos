import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import { StatusBadge } from "../../../components/status-badge";
import { goalExecution, relativeTime } from "../model";
import { canvasEntityPath, projectPath } from "../navigation";
import type { MissionControlData } from "../server";
import { Icon } from "./icons";

type Point = { x: number; y: number };
type Positions = Record<string, Point>;
const nodeWidth = 190;
const nodeHeight = 168;

function nodeState(index: number, current: number, goalStatus: string) {
  if (index < current) return "complete";
  if (index === current) return ["failed", "blocked"].includes(goalStatus) ? "failed" : "active";
  return "waiting";
}

function defaultPositions(ids: string[]): Positions {
  return Object.fromEntries(ids.map((id, index) => [id, { x: 48 + index * 265, y: 125 + (index % 2 ? 46 : 0) }]));
}

export function OrchestrationCanvas({ data, projectId, goalId }: { data: MissionControlData; projectId?: string; goalId?: string }) {
  const projectGoals = data.goals.filter((goal) => !projectId || goal.projectId === projectId);
  const goal = projectGoals.find((item) => item.id === goalId) ?? projectGoals.find((item) => ["active", "failed", "blocked"].includes(item.status)) ?? projectGoals[0];
  if (!goal) return <section className="canvas-empty"><Icon name="nodes"/><h2>No goals on this canvas</h2><p>Create a goal to give this project its first durable execution path.</p><Link to={`${projectPath(projectId,"goals")}/new`}>Create goal</Link></section>;

  const execution = goalExecution(data, goal.id);
  const attemptedTransitionIds = execution.attempts.map((attempt) => attempt.transitionId).filter(Boolean);
  const relevant = useMemo(() => {
    const active = data.transitions.filter((transition) => transition.status === "active");
    return active.length ? active : data.transitions;
  }, [data.transitions]);
  const currentIndex = Math.max(0, Math.min(relevant.length - 1, attemptedTransitionIds.length ? attemptedTransitionIds.length - 1 : 0));
  const nodeIds = useMemo(() => ["intent", ...relevant.map((transition) => transition.id), "outcome"], [relevant]);
  const initialPositions = useMemo(() => defaultPositions(nodeIds), [nodeIds]);
  const [positions, setPositions] = useState<Positions>(initialPositions);
  const dragged = useRef(false);
  const storageKey = `senderos:canvas:${goal.projectId}:${goal.id}`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      setPositions(stored ? { ...initialPositions, ...JSON.parse(stored) } : initialPositions);
    } catch { setPositions(initialPositions); }
  }, [storageKey, initialPositions]);

  const moveNode = (id: string, event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const origin = positions[id];
    const start = { x: event.clientX, y: event.clientY };
    dragged.current = false;
    const target = event.currentTarget;
    const onMove = (move: PointerEvent) => {
      const dx = move.clientX - start.x;
      const dy = move.clientY - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) dragged.current = true;
      setPositions((current) => ({ ...current, [id]: { x: Math.max(16, origin.x + dx), y: Math.max(55, origin.y + dy) } }));
    };
    const onEnd = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onEnd);
      setPositions((current) => { localStorage.setItem(storageKey, JSON.stringify(current)); return current; });
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onEnd);
  };

  const reset = () => { setPositions(initialPositions); localStorage.removeItem(storageKey); };
  const canvasWidth = Math.max(900, ...Object.values(positions).map((point) => point.x + nodeWidth + 60));
  const canvasHeight = Math.max(500, ...Object.values(positions).map((point) => point.y + nodeHeight + 80));

  return <section className="canvas-panel">
    <header className="canvas-toolbar">
      <div><span className="canvas-label">Goal flow</span><strong>{goal.title}</strong><StatusBadge value={goal.status}/></div>
      <div className="canvas-controls"><span>Drag nodes to arrange</span><button type="button" onClick={reset}>Reset layout</button></div>
    </header>
    <div className="canvas-grid interactive" style={{ height: Math.min(680, canvasHeight) }}>
      <div className="canvas-stage" style={{ width: canvasWidth, height: canvasHeight }}>
        <div className="canvas-watermark">INTERACTIVE ORCHESTRATION GRAPH</div>
        <svg className="canvas-edges" width={canvasWidth} height={canvasHeight} aria-hidden="true">
          {nodeIds.slice(0,-1).map((id,index)=>{const from=positions[id];const to=positions[nodeIds[index+1]];return <g key={id}><line x1={from.x+nodeWidth} y1={from.y+nodeHeight/2} x2={to.x} y2={to.y+nodeHeight/2}/><circle cx={to.x} cy={to.y+nodeHeight/2} r="3"/></g>})}
        </svg>
        <article className="intent-node complete draggable-node" style={positions.intent} onPointerDown={(event)=>moveNode("intent",event)}><div className="node-top"><span>INTENT · {goal.id}</span><i/></div><Icon name="target"/><h3>{goal.title}</h3><p>{goal.specText||goal.intakeText||"No specification recorded."}</p><footer><span>{goal.kind}</span><span>{goal.baseTargetBranch}</span></footer></article>
        {relevant.map((transition,index)=>{const agent=data.agents.find((item)=>item.id===transition.sourceAgentId);const attempt=execution.attempts.find((item)=>item.transitionId===transition.id);const state=nodeState(index,currentIndex,goal.status);return <Link className={`agent-node ${state} draggable-node`} style={positions[transition.id]} onPointerDown={(event)=>moveNode(transition.id,event)} onClick={(event)=>{if(dragged.current){event.preventDefault();dragged.current=false;}}} key={transition.id} to={canvasEntityPath({projectId:goal.projectId,goalId:goal.id,transitionId:transition.id,attemptId:attempt?.id})}><div className="node-top"><span>AGENT {String(index+1).padStart(2,"0")} · {transition.id}</span><i/></div><div className="agent-avatar"><Icon name="spark"/></div><h3>{agent?.name??transition.name}</h3><p>{transition.transitionObjective}</p><footer><span>{attempt?.harness??agent?.kind??"waiting"}</span><span>{attempt?relativeTime(attempt.updatedAt):state}</span></footer></Link>})}
        <article className={`review-node ${goal.status==="completed"?"complete":"waiting"} draggable-node`} style={positions.outcome} onPointerDown={(event)=>moveNode("outcome",event)}><div className="node-top"><span>OUTCOME · {goal.id}</span><i/></div><Icon name="check"/><h3>Verified result</h3><p>Evidence and operator decision close the path.</p><footer><span>{execution.attempts.length} attempts</span><span>{execution.runs.length} runs</span></footer></article>
      </div>
    </div>
    <footer className="canvas-legend"><span><i className="complete"/> Completed</span><span><i className="active"/> Executing</span><span><i className="failed"/> Needs attention</span><span><i/> Waiting</span><em>Layouts are saved in this browser</em></footer>
  </section>;
}
