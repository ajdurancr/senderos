import { useEffect, useMemo, useRef, useState } from "react";
import { DurableLink as Link } from "../../../components/durable-link";

import { StatusBadge } from "../../../components/status-badge";
import { goalExecution, relativeTime } from "../model";
import { canvasAgentPath, canvasEntityPath, projectPath } from "../navigation";
import type { MissionControlData } from "../server";
import { Icon } from "./icons";

type Point = { x: number; y: number };
type Positions = Record<string, Point>;
const size = { width: 190, height: 168 };

function layout(ids: string[]): Positions {
  const agentIds = ids.filter((id) => id.startsWith("agent:"));
  const rows = Math.max(1, Math.ceil(agentIds.length / 3));
  return {
    start: { x: 42, y: 115 + (rows - 1) * 72 },
    ...Object.fromEntries(agentIds.map((id,index)=>[id,{x:310+(index%3)*270,y:55+Math.floor(index/3)*225}])),
    end: { x: 310 + Math.min(3, Math.max(1, agentIds.length)) * 270, y: 115 + (rows - 1) * 72 },
  };
}

export function OrchestrationCanvas({ data, projectId, goalId }: { data: MissionControlData; projectId?: string; goalId?: string }) {
  const projectGoals=data.goals.filter(goal=>!projectId||goal.projectId===projectId);
  const goal=projectGoals.find(item=>item.id===goalId)??projectGoals.find(item=>["active","failed","blocked"].includes(item.status))??projectGoals[0];
  if(!goal)return <section className="canvas-empty"><Icon name="nodes"/><h2>No goals on this canvas</h2><p>Create a goal to give this project its first durable execution path.</p><Link to={`${projectPath(projectId,"goals")}/new`}>Create goal</Link></section>;

  const execution=goalExecution(data,goal.id);
  const transitions=useMemo(()=>data.transitions.filter(item=>item.status==="active"),[data.transitions]);
  const connectedIds=useMemo(()=>new Set(transitions.flatMap(item=>[item.sourceAgentId,item.targetAgentId].filter(Boolean) as string[])),[transitions]);
  const agents=useMemo(()=>data.agents.filter(agent=>connectedIds.has(agent.id)),[data.agents,connectedIds]);
  const nodeIds=useMemo(()=>["start",...agents.map(agent=>`agent:${agent.id}`),"end"],[agents]);
  const defaults=useMemo(()=>layout(nodeIds),[nodeIds]);
  const [positions,setPositions]=useState<Positions>(defaults);
  const moved=useRef(false);
  const storageKey=`senderos:trail:${goal.projectId}:${goal.id}`;

  useEffect(()=>{try{const saved=localStorage.getItem(storageKey);setPositions(saved?{...defaults,...JSON.parse(saved)}:defaults)}catch{setPositions(defaults)}},[storageKey,defaults]);

  const drag=(id:string,event:React.PointerEvent<HTMLElement>)=>{
    if(event.button!==0)return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const origin=positions[id];const start={x:event.clientX,y:event.clientY};const target=event.currentTarget;moved.current=false;
    const move=(next:PointerEvent)=>{const dx=next.clientX-start.x,dy=next.clientY-start.y;if(Math.abs(dx)+Math.abs(dy)>3)moved.current=true;setPositions(current=>({...current,[id]:{x:Math.max(12,origin.x+dx),y:Math.max(48,origin.y+dy)}}))};
    const end=()=>{target.removeEventListener("pointermove",move);target.removeEventListener("pointerup",end);setPositions(current=>{localStorage.setItem(storageKey,JSON.stringify(current));return current})};
    target.addEventListener("pointermove",move);target.addEventListener("pointerup",end);
  };
  const reset=()=>{setPositions(defaults);localStorage.removeItem(storageKey)};
  const incoming=new Set(transitions.map(item=>item.targetAgentId).filter(Boolean));
  const starts=agents.filter(agent=>!incoming.has(agent.id));
  const graphEdges=[
    ...starts.map(agent=>({id:`start:${agent.id}`,from:"start",to:`agent:${agent.id}`,label:"begin",transition:undefined})),
    ...transitions.map(item=>({id:item.id,from:`agent:${item.sourceAgentId}`,to:item.targetAgentId?`agent:${item.targetAgentId}`:"end",label:item.name,transition:item})),
  ];
  const latestAttempt=execution.latestAttempt;
  const width=Math.max(960,...Object.values(positions).map(point=>point.x+size.width+60));
  const height=Math.max(510,...Object.values(positions).map(point=>point.y+size.height+60));

  return <section className="canvas-panel"><header className="canvas-toolbar"><div><span className="canvas-label">Sendero</span><strong>{goal.title}</strong><StatusBadge value={goal.status}/></div><div className="canvas-controls"><span>Drag agents · select nodes and arcs</span><button type="button" onClick={reset}>Auto layout</button></div></header>
    <div className="canvas-grid interactive" style={{height:Math.min(700,height)}}><div className="canvas-stage" style={{width,height}}><div className="canvas-watermark">AGENT TRAIL · LIVE EXECUTION OVERLAY</div>
      <svg className="canvas-edges" width={width} height={height}>{graphEdges.map(edge=>{const from=positions[edge.from],to=positions[edge.to];if(!from||!to)return null;const active=edge.transition?.id===latestAttempt?.transitionId;const href=edge.transition?canvasEntityPath({projectId:goal.projectId,goalId:goal.id,transitionId:edge.transition.id,attemptId:active?latestAttempt?.id:undefined}):undefined;const line=<><line className={`edge-hit ${active?"active":""}`} x1={from.x+size.width} y1={from.y+size.height/2} x2={to.x} y2={to.y+size.height/2}/><text x={(from.x+size.width+to.x)/2} y={(from.y+to.y+size.height)/2-8}>{active?`running · ${latestAttempt?.attemptNumber}`:edge.label}</text></>;return href?<Link key={edge.id} to={href}>{line}</Link>:<g key={edge.id}>{line}</g>})}</svg>
      <article className="intent-node complete draggable-node" style={positions.start} onPointerDown={event=>drag("start",event)}><div className="node-top"><span>START · GOAL</span><i/></div><Icon name="target"/><h3>{goal.title}</h3><p>{goal.specText||goal.intakeText||"Durable intent captured."}</p><footer><span>{goal.id}</span><span>{goal.status}</span></footer></article>
      {agents.map(agent=>{const current=latestAttempt?.agentId===agent.id;const attempts=execution.attempts.filter(attempt=>attempt.agentId===agent.id);return <Link draggable={false} key={agent.id} className={`agent-node draggable-node ${current?latestAttempt?.status==="failed"?"failed":"active":"waiting"}`} style={positions[`agent:${agent.id}`]} onPointerDown={event=>drag(`agent:${agent.id}`,event)} onDragStart={event=>event.preventDefault()} onClick={event=>{if(moved.current){event.preventDefault();moved.current=false}}} to={canvasAgentPath(goal.projectId,goal.id,agent.id)}><div className="node-top"><span>AGENT · {agent.id}</span><i/></div><div className="agent-avatar"><Icon name="spark"/></div><h3>{agent.name}</h3><p>{agent.description||agent.defaultGoal}</p><footer><span>{attempts.length} attempts</span><span>{current?relativeTime(latestAttempt?.updatedAt):agent.kind}</span></footer></Link>})}
      <article className={`review-node draggable-node ${goal.status==="completed"?"complete":"waiting"}`} style={positions.end} onPointerDown={event=>drag("end",event)}><div className="node-top"><span>END · VERIFIED</span><i/></div><Icon name="check"/><h3>Trail outcome</h3><p>Every terminal arc converges on evidence and review.</p><footer><span>{execution.runs.length} runs</span><span>{execution.attempts.length} attempts</span></footer></article>
    </div></div><footer className="canvas-legend"><span><i className="complete"/> Complete</span><span><i className="active"/> Current location</span><span><i className="failed"/> Failed</span><span><i/> Available</span><em>Click an arc for transition and run context</em></footer></section>;
}
