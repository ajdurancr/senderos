import { Link } from "react-router";

import { StatusBadge } from "../../../components/status-badge";
import { goalExecution, relativeTime } from "../model";
import type { MissionControlData } from "../server";
import { Icon } from "./icons";

function nodeState(index: number, current: number, goalStatus: string) {
  if (index < current) return "complete";
  if (index === current) return ["failed", "blocked"].includes(goalStatus) ? "failed" : "active";
  return "waiting";
}

export function OrchestrationCanvas({ data, projectId, goalId }: { data: MissionControlData; projectId?: string; goalId?: string }) {
  const projectGoals = data.goals.filter((goal) => !projectId || goal.projectId === projectId);
  const goal = projectGoals.find((item) => item.id === goalId) ?? projectGoals.find((item) => ["active", "failed", "blocked"].includes(item.status)) ?? projectGoals[0];
  if (!goal) return <section className="canvas-empty"><Icon name="nodes" /><h2>No goals on this canvas</h2><p>Create a goal to give this project its first durable execution path.</p><Link to={`/?view=goals&create=true${projectId ? `&project=${projectId}` : ""}`}>Create goal</Link></section>;
  const execution = goalExecution(data, goal.id);
  const attemptedTransitionIds = execution.attempts.map((attempt) => attempt.transitionId).filter(Boolean);
  const flowTransitions = data.transitions.filter((transition) => transition.status === "active");
  const relevant = flowTransitions.length ? flowTransitions : data.transitions;
  const currentIndex = Math.max(0, Math.min(relevant.length - 1, attemptedTransitionIds.length ? attemptedTransitionIds.length - 1 : 0));
  const base = `/?view=canvas&project=${encodeURIComponent(goal.projectId)}&goal=${encodeURIComponent(goal.id)}`;

  return <section className="canvas-panel">
    <header className="canvas-toolbar">
      <div><span className="canvas-label">Goal flow</span><strong>{goal.title}</strong><StatusBadge value={goal.status} /></div>
      <div className="canvas-controls"><span>Scroll to explore</span></div>
    </header>
    <div className="canvas-grid">
      <div className="canvas-watermark">ORCHESTRATION GRAPH</div>
      <div className="flow-path">
        <article className="intent-node complete"><div className="node-top"><span>INTENT</span><i /></div><Icon name="target" /><h3>{goal.title}</h3><p>{goal.specText || goal.intakeText || "No specification recorded."}</p><footer><span>{goal.kind}</span><span>{goal.baseTargetBranch}</span></footer></article>
        <div className="flow-edge complete"><span>captured</span><i /></div>
        {relevant.map((transition, index) => {
          const agent = data.agents.find((item) => item.id === transition.sourceAgentId);
          const attempt = execution.attempts.find((item) => item.transitionId === transition.id);
          const state = nodeState(index, currentIndex, goal.status);
          return <div className="flow-segment" key={transition.id}>
            <Link className={`agent-node ${state}`} to={`${base}&transition=${transition.id}${attempt ? `&attempt=${attempt.id}` : ""}`}>
              <div className="node-top"><span>AGENT {String(index + 1).padStart(2, "0")}</span><i /></div>
              <div className="agent-avatar"><Icon name="spark" /></div>
              <h3>{agent?.name ?? transition.name}</h3>
              <p>{transition.transitionObjective}</p>
              <footer><span>{attempt?.harness ?? agent?.kind ?? "waiting"}</span><span>{attempt ? relativeTime(attempt.updatedAt) : state}</span></footer>
            </Link>
            {index < relevant.length - 1 && <div className={`flow-edge ${state === "complete" ? "complete" : state === "failed" ? "failed" : ""}`}><span>{state === "failed" ? "retry" : "handoff"}</span><i /></div>}
          </div>;
        })}
        <div className="flow-edge"><span>verify</span><i /></div>
        <article className={`review-node ${goal.status === "completed" ? "complete" : "waiting"}`}><div className="node-top"><span>OUTCOME</span><i /></div><Icon name="check" /><h3>Verified result</h3><p>Evidence and operator decision close the path.</p><footer><span>{execution.attempts.length} attempts</span><span>{execution.runs.length} runs</span></footer></article>
      </div>
    </div>
    <footer className="canvas-legend"><span><i className="complete" /> Completed</span><span><i className="active" /> Executing</span><span><i className="failed" /> Needs attention</span><span><i /> Waiting</span></footer>
  </section>;
}
