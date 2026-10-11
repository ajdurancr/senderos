import { GoalActivations, HostExecutionRecords } from "./execution-records";
import { Form, useNavigation } from "react-router";

import { StatusBadge } from "../../../components/status-badge";
import {
  eventLabel,
  goalExecution,
  parseAttemptSnapshot,
  relativeTime,
} from "../model";
import type { MissionControlData } from "../server";
import { projectPath } from "../navigation";
import { Icon } from "./icons";

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
  const pending = useNavigation().state !== "idle";
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
  const objective = attempt?.executionObjective ?? sourceNode?.executionObjective ?? transition?.transitionObjective;
  const goalDecision = data.decisions?.find(decision => decision.goalId === goal.id);
  const selectedRun = execution.runs.find(run => run.id === attempt?.runId);
  const attemptDecision = attempt && goalDecision?.activations.find(decision => decision.attemptId === attempt.id || Boolean(selectedRun?.activationId && decision.activationId === selectedRun.activationId));
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
        <a href={projectPath(goal.projectId)} aria-label="Close inspector">
          <Icon name="x" />
        </a>
      </header>
      <div className="inspector-tabs">
        <span className="active">Execution context</span>
      </div>
      <section className="inspector-section">
        {attemptId && !attempt && <p role="alert">This attempt does not match the selected goal or node, or is no longer available.</p>}
        {decision && <p role="status"><small>{attemptDecision ? 'Selected activation' : 'Goal summary'}</small><br /><strong>{decision.state}</strong> · {decision.reason.replaceAll('_', ' ')}<br />Next: {decision.nextAction.replaceAll('_', ' ')}</p>}
        <div className="inspector-status">
          <StatusBadge value={attempt?.status ?? goal.status} />
          <span>
            {attempt ? relativeTime(attempt.updatedAt) : "Not dispatched"}
          </span>
        </div>
        <dl className="property-list">
          {agent && (
            <>
              <div>
                <dt>Agent ID</dt>
                <dd className="mono">{agent.id}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{agent.description || agent.defaultGoal || agent.kind}</dd>
              </div>
            </>
          )}
          {transition && (
            <>
              <div>
                <dt>Arc ID</dt>
                <dd className="mono">{transition.id}</dd>
              </div>
              <div>
                <dt>Objective</dt>
                <dd>{objective || "Not configured"}</dd>
              </div>
            </>
          )}
          {!transition && objective && <div><dt>Objective</dt><dd>{objective}</dd></div>}
          <div>
            <dt>Agent</dt>
            <dd>{agent?.name ?? "Not selected"}</dd>
          </div>
          <div>
            <dt>Transition</dt>
            <dd>{transition?.name ?? "Waiting for plan"}</dd>
          </div>
          <div>
            <dt>Harness</dt>
            <dd>{attempt?.harness ?? "—"}</dd>
          </div>
          <div>
            <dt>Checkpoint</dt>
            <dd>{attempt?.checkpoint ?? "Waiting for host signal"}</dd>
          </div>
          <div>
            <dt>Working path</dt>
            <dd className="mono">{attempt?.workingPath ?? "Not recorded"}</dd>
          </div>
          <div>
            <dt>Heartbeat</dt>
            <dd>{relativeTime(attempt?.heartbeatAt)}</dd>
          </div>
        </dl>
        {goal.status === 'draft' && <Form method="post"><input type="hidden" name="intent" value="start" /><input type="hidden" name="goalId" value={goal.id}/><button disabled={pending}>Start goal</button></Form>}
        {data.queue.dispatchable.some(item => item.goalId === goal.id) && <a className="primary-action" href={`${projectPath(goal.projectId)}/goals/${encodeURIComponent(goal.id)}?plan=true`}>Review ready activations</a>}
        {attempt && !terminal && (
          <Form method="post">
            <input type="hidden" name="intent" value="stop" />
            <input type="hidden" name="runId" value={attempt.runId} />
            <button disabled={pending} className="danger-button">Request stop</button>
          </Form>
        )}
      </section>
      <GoalActivations data={data} goalId={goal.id} attemptId={attempt?.id} />
      {attempt && <section className="inspector-section"><HostExecutionRecords data={data} attempt={attempt} /></section>}
      <section className="inspector-section">
        <header>
          <h3>Evidence & review</h3>
          <span>{snapshot.evidence?.length ?? 0} items</span>
        </header>
        {terminal && <p>This attempt is finished. Its evidence and review are read-only.</p>}
        <div className="evidence-list">
          {snapshot.evidence?.map((item) => (
            <article key={item.id}>
              <Icon name="check" />
              <div>
                <strong>{item.label}</strong>
                <span>{item.kind}</span>
              </div>
            </article>
          ))}
          {!snapshot.evidence?.length && (
            <p>No evidence recorded for this attempt.</p>
          )}
        </div>
        {attempt && !terminal && (
          <Form className="compact-form" method="post">
            <input type="hidden" name="intent" value="evidence" />
            <input type="hidden" name="attemptId" value={attempt.id} />
            <input name="label" placeholder="Evidence label" required />
            <input name="url" placeholder="Optional URL" />
            <button disabled={pending}>Record evidence</button>
          </Form>
        )}
        {attempt && !terminal && (
          <Form className="review-form" method="post">
            <input type="hidden" name="intent" value="review" />
            <input type="hidden" name="attemptId" value={attempt.id} />
            <div>
              <select name="status" defaultValue="approved">
                <option value="approved">Approve</option>
                <option value="changes_requested">Request changes</option>
                <option value="rejected">Reject</option>
              </select>
              <input name="rationale" placeholder="Decision rationale" />
            </div>
            <button disabled={pending}>Record decision</button>
            {snapshot.review && (
              <p>
                Current review:{" "}
                <strong>{snapshot.review.status.replaceAll("_", " ")}</strong>
              </p>
            )}
          </Form>
        )}
      </section>
      <section className="inspector-section event-preview">
        <header>
          <h3>Recent activity</h3>
          <a href={projectPath(goal.projectId, "events")}>View all</a>
        </header>
        {events.map((event) => (
          <div key={event.id}>
            <i />
            <span>
              <strong>{eventLabel(event.eventType)}</strong>
              <small>{relativeTime(event.createdAt)}</small>
            </span>
          </div>
        ))}
      </section>
    </aside>
  );
}
