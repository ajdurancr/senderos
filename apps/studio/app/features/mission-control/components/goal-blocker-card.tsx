import { DurableLink as Link } from "../../../components/durable-link";
import { StatusBadge } from "../../../components/status-badge";
import { blockerGuidance, goalBlockers } from "../goal-blockers";
import { canvasNodePath, goalPath } from "../navigation";
import type { MissionControlData } from "../server";

export function GoalBlockerCard({ data, entry }: {
  data: MissionControlData;
  entry: ReturnType<typeof goalBlockers>[number];
}) {
  const { goal, blockers } = entry;
  const graph = data.historyGraphs.find(item => item.version.id === goal.senderoVersionId);
  const project = data.projects.find(item => item.id === goal.projectId);
  const context = data.executionContexts.find(item => item.id === project?.executionContextId);
  return <article className="goal-blocker-card" aria-label={`Goal blockers: ${goal.title}`}>
    <header>
      <div><span>Goal blockers · {context?.name ?? "Unknown context"} · {project?.name ?? goal.projectId}</span><h2><Link to={goalPath(goal.projectId, goal.id)}>{goal.title}</Link></h2></div>
      <span>Goal <StatusBadge value={goal.status} /></span>
    </header>
    <p>{blockers.length} {blockers.length === 1 ? "issue needs" : "issues need"} attention. Other branches may still be ready or running.</p>
    <ul className="goal-blocker-list">{blockers.map((blocker, index) => {
      const guidance = blockerGuidance(blocker);
      const node = graph?.nodes.find(item => item.id === blocker.nodeId);
      const target = blocker.nodeId ? canvasNodePath(goal.projectId, goal.id, blocker.nodeId, blocker.attemptId) : goalPath(goal.projectId, goal.id);
      return <li key={blocker.activationId ?? index}>
        <h3>{node?.label ? `${node.label} · ` : ""}{guidance.title}</h3>
        <p><strong>Next:</strong> {guidance.next}</p>
        <div className="goal-blocker-actions">
          <Link className="button button-secondary" to={target}>{blocker.nodeId ? "Inspect activation" : "Inspect goal"}</Link>
          {blocker.reason === "AGENT_UNAVAILABLE" && node?.agentId && <Link className="button button-secondary" to={`/agents/${encodeURIComponent(node.agentId)}`}>Manage agent</Link>}
        </div>
      </li>;
    })}</ul>
  </article>;
}
