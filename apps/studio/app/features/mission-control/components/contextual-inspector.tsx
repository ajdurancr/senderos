import { RetryLineage } from "./retry-lineage";
import { useState } from "react";
import { GoalPreparation } from "./goal-preparation";
import { GoalActivations, HostExecutionRecords, executionPhase } from "./execution-records";
import { AttemptDrafts } from "./attempt-drafts";

import { DurableLink as Link } from "../../../components/durable-link";
import { StatusBadge } from "../../../components/status-badge";
import {
  eventLabel,
  goalExecution,
  parseAttemptSnapshot,
  relativeTime,
} from "../model";
import type { MissionControlData } from "../server";
import { projectPath } from "../navigation";
import { EvidenceRecords } from "./evidence-records";
import { GoalBudgets } from "./goal-budgets";
import { GoalCancellation } from "./goal-cancellation";
import { CompletionPrerequisites } from "./completion-prerequisites";

export function ContextualInspector({
  data,
  goalId,
  agentId,
  nodeId,
  attemptId,
  transitionId,
}: {
  data: MissionControlData;
  goalId?: string;
  agentId?: string;
  nodeId?: string;
  attemptId?: string;
  transitionId?: string;
}) {
  const [preparingGoal, setPreparingGoal] = useState(false);
  const goal = data.goals.find((item) => item.id === goalId);
  if (!goal) return null;
  const execution = goalExecution(data, goal.id);
  const senderoGraph = (data.historyGraphs ?? data.senderoGraphs).find(item => item.version.id === goal.senderoVersionId);
  const selectedNode = senderoGraph?.nodes.find(node => node.id === nodeId);
  const nodeActivationIds = new Set(data.activations?.filter(activation => activation.goalId === goal.id && activation.nodeId === nodeId).map(activation => activation.id));
  const matchesSelection = (item: MissionControlData['attempts'][number]) =>
    (!transitionId || item.transitionId === transitionId) && (!agentId || item.agentId === agentId) &&
    (!nodeId || nodeActivationIds.has(execution.runs.find(run => run.id === item.runId)?.activationId ?? ''));
  const attempt = attemptId
    ? execution.attempts.find(item => item.id === attemptId && matchesSelection(item))
    : execution.attempts.filter(matchesSelection).at(-1);
  const selectedTransitionId = transitionId ?? attempt?.transitionId;
  const senderoEdge = senderoGraph?.edges.find(
    (item) => item.id === selectedTransitionId,
  );
  const legacyTransition = data.transitions.find(
    (item) => item.id === selectedTransitionId,
  );
  const transition = senderoEdge ?? legacyTransition;
  const sourceNode = selectedNode ?? senderoGraph?.nodes.find(
    (item) => item.id === senderoEdge?.sourceNodeId,
  );
  const agent = data.agents.find(
    (item) =>
      item.id ===
      (agentId ??
        attempt?.agentId ??
        sourceNode?.agentId ??
        legacyTransition?.sourceAgentId),
  );
  const objective = attempt?.executionObjective ?? sourceNode?.executionObjective ?? transition?.transitionObjective ?? goal.specText;
  const goalDecision = data.decisions?.find(decision => decision.goalId === goal.id);
  const attemptDecision = attempt && goalDecision?.activations.find(decision => decision.attemptId === attempt.id);
  const decision = attemptDecision || goalDecision;
  const snapshot = parseAttemptSnapshot(attempt?.statusSnapshotJson ?? "{}");
  const events = data.events
    .filter((event) =>
      [
        goal.id,
        attempt?.runId,
        attempt?.id,
        agent?.id,
        transition?.id,
      ].includes(event.entityId),
    )
    .slice(-6)
    .reverse();
  const terminal =
    attempt && ["succeeded", "failed", "canceled"].includes(attempt.status);
  const validSelection = (!nodeId || selectedNode) && (!agentId || agent) && (!transitionId || transition) && (!attemptId || attempt);
  const cancellationRequested = goalDecision?.reason === "cancellation_requested" || execution.attempts.some(item => item.cancellationRequestedAt && !["succeeded", "failed", "canceled"].includes(item.status));

  return (
    <aside className="context-inspector">
      <header>
        <div>
          <span>
            {nodeId ? "Workflow node" : agentId
              ? "Agent inspector"
              : transitionId
                ? "Sendero transition"
                : attemptId
                  ? "Run attempt"
                  : "Goal inspector"}
          </span>
          <h2>
            {nodeId ? selectedNode?.label ?? nodeId : agentId
              ? (agent?.name ?? agentId)
              : transitionId
                ? (transition?.name ?? transitionId)
                : goal.title}
          </h2>
        </div>
        <Link to={projectPath(goal.projectId)} aria-label="Back to project" title="Back to project">
          <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 5-7 7 7 7M5 12h14" /></svg>
        </Link>
      </header>
      <section className="inspector-section">
        {nodeId && !selectedNode && <p role="alert">This workflow node is not part of the goal's pinned definition.</p>}
        {transitionId && !transition && <p role="alert">This transition is not part of the goal's pinned definition.</p>}
        {agentId && !agent && <p role="alert">This agent is unavailable.</p>}
        {attemptId && !attempt && <p role="alert">This attempt does not match the selected goal or node, or is no longer available.</p>}
        {decision && <p role="status"><small>{attemptDecision ? 'Selected activation' : 'Goal summary'}</small><br /><strong>{decision.state}</strong> · {decision.reason.replaceAll('_', ' ')}<br />Next: {decision.nextAction.replaceAll('_', ' ')}</p>}
        <div className="inspector-status">
          <span>Goal <StatusBadge value={goal.status} /></span>
          {attempt && <span>Attempt <StatusBadge value={executionPhase(attempt)} /></span>}
          <span>
            {attempt ? relativeTime(attempt.updatedAt, data.asOf) : "Not dispatched"}
          </span>
        </div>
        {senderoGraph && <p>{senderoGraph.sendero.name} · {goal.status === 'draft' ? 'assigned' : 'pinned'} v{senderoGraph.version.version}</p>}
        <dl className="property-list">
          <div><dt>Objective</dt><dd>{objective || "Not configured"}</dd></div>
          <div><dt>Agent</dt><dd>{agent?.name ?? "Not selected"}</dd></div>
          <div><dt>Transition</dt><dd>{transition?.name ?? "Waiting for plan"}</dd></div>
        </dl>
        {goal.status === 'draft' && validSelection && <GoalPreparation key={`prepare:${goal.id}`} goal={goal} graphs={data.senderoGraphs} onEditingChange={setPreparingGoal} />}
        {data.queue.dispatchable.some(item => item.goalId === goal.id) && <Link className="button button-primary" to={`${projectPath(goal.projectId)}/goals/${encodeURIComponent(goal.id)}?plan=true`}>Review ready activations</Link>}
        {validSelection && !preparingGoal && <GoalCancellation key={goal.id} goal={goal} requested={cancellationRequested} />}
      </section>
      {attempt && <RetryLineage data={data} attempt={attempt} surface="canvas" />}
      <section className="inspector-section">
        <header>
          <h3>Evidence & review</h3>
          <span>{snapshot.evidence?.length ?? 0} items</span>
        </header>
        {terminal && <p>This attempt is finished. Its evidence and review are read-only.</p>}
        {attempt?.status === "paused" && snapshot.completionRequested === true && !cancellationRequested && attemptDecision?.completion && <CompletionPrerequisites completion={attemptDecision.completion} />}
        <EvidenceRecords asOf={data.asOf} snapshot={snapshot} />
        {attempt && !terminal && <AttemptDrafts key={attempt.id} attempt={attempt} disabled={preparingGoal} />}
      </section>
      {validSelection && <GoalBudgets data={data} goal={goal} />}
      <GoalActivations data={data} goalId={goal.id} attemptId={attempt?.id} />
      <details className="inspector-section inspector-disclosure">
        <summary>Technical details</summary>
        <dl className="property-list">
          {agent && <div><dt>Role</dt><dd>{agent.description || agent.defaultGoal || agent.kind}</dd></div>}
          <div><dt>Checkpoint</dt><dd>{attempt?.checkpoint ?? "Waiting for host signal"}</dd></div>
          <div><dt>Heartbeat</dt><dd>{relativeTime(attempt?.heartbeatAt, data.asOf)}</dd></div>
          {agent && <div><dt>Agent ID</dt><dd className="mono">{agent.id}</dd></div>}
          {transition && <div><dt>Arc ID</dt><dd className="mono">{transition.id}</dd></div>}
          <div><dt>Harness</dt><dd>{attempt?.harness ?? "—"}</dd></div>
          <div><dt>Working path</dt><dd className="mono">{attempt?.workingPath ?? "Not recorded"}</dd></div>
        </dl>
      </details>
      {attempt && <section className="inspector-section"><HostExecutionRecords data={data} attempt={attempt} /></section>}
      <section className="inspector-section event-preview">
        <header>
          <h3>Recent activity</h3>
          <Link to={projectPath(goal.projectId, "events")}>View all</Link>
        </header>
        {events.map((event) => (
          <div key={event.id}>
            <i />
            <span>
              <strong>{eventLabel(event.eventType)}</strong>
              <small>{relativeTime(event.createdAt, data.asOf)}</small>
            </span>
          </div>
        ))}
      </section>
    </aside>
  );
}
