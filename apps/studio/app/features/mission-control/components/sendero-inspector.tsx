import { DurableLink as Link } from "../../../components/durable-link";
import { Form, useNavigation } from "react-router";
import { StatusBadge } from "../../../components/status-badge";
import { eventLabel, relativeTime } from "../model";
import { senderoPath } from "../navigation";
import type { MissionControlData } from "../server";
import { Icon } from "./icons";
import { objectJson } from "../graph-authoring";

export function SenderoInspector({
  data,
  senderoId,
  nodeId,
  edgeId,
  hasUnsavedGraph = false,
}: {
  data: MissionControlData;
  senderoId: string;
  nodeId?: string;
  edgeId?: string;
  hasUnsavedGraph?: boolean;
}) {
  const pending = useNavigation().state !== "idle";
  const graph = data.senderoGraphs.find(
    (item) => item.sendero.id === senderoId,
  );
  if (!graph) return null;
  const node = graph.nodes.find((item) => item.id === nodeId);
  const edge = graph.edges.find((item) => item.id === edgeId);
  const edgeSource = graph.nodes.find(item => item.id === edge?.sourceNodeId);
  const legacyPolicy = edgeSource?.executionObjective === null;
  const routingCondition = objectJson(edge?.conditionJson ?? "{}");
  if (legacyPolicy) delete routingCondition.completion;
  const agent = data.agents.find((item) => item.id === node?.agentId);
  const events = data.events
    .filter((event) =>
      [graph.sendero.id, node?.id, edge?.id, agent?.id].includes(
        event.entityId,
      ),
    )
    .slice(-8)
    .reverse();
  return (
    <aside className="context-inspector">
      <header>
        <div>
          <span>
            {edge
              ? "Sendero transition"
              : node
                ? `${node.kind} node`
                : "Sendero definition"}
          </span>
          <h2>
            {edge?.name ?? agent?.name ?? node?.label ?? graph.sendero.name}
          </h2>
        </div>
        <Link to={senderoPath(graph.sendero.id)} aria-label="Close inspector">
          <Icon name="x" />
        </Link>
      </header>
      <section className="inspector-section">
        {nodeId && !node && <p role="alert">This node is not part of the selected Sendero version.</p>}
        {edgeId && !edge && <p role="alert">This transition is not part of the selected Sendero version.</p>}
        <div className="inspector-status">
          <StatusBadge value={edge?.status ?? graph.sendero.status} />
          <span>
            Version {graph.version.version} · {graph.version.status}
          </span>
        </div>
        {hasUnsavedGraph && <p role="status">Save or cancel graph changes before publishing or editing this inspector.</p>}
        <Form method="post" className="inspector-actions">
          <input type="hidden" name="intent" value={graph.version.status === 'draft' ? 'publish-sendero' : 'draft-sendero'} />
          <input type="hidden" name="senderoId" value={graph.sendero.id} />
          {graph.version.status === "draft" && <><input type="hidden" name="expectedVersionId" value={graph.version.id} /><input type="hidden" name="expectedRevision" value={graph.revision ?? ""} /></>}
          <button className="button button-primary" disabled={pending || hasUnsavedGraph}>{graph.version.status === 'draft' ? 'Validate & publish draft' : 'Create editable draft'}</button>
        </Form>
        <dl className="property-list">
          {agent && <><div><dt>Agent</dt><dd>{agent.name}</dd></div><div><dt>Role</dt><dd>{agent.description}</dd></div></>}
          {edge && <>
            <div><dt>From</dt><dd>{edgeSource?.label ?? edge.sourceNodeId}</dd></div>
            <div><dt>To</dt><dd>{graph.nodes.find(item => item.id === edge.targetNodeId)?.label ?? edge.targetNodeId}</dd></div>
            <div><dt>Objective</dt><dd>{edge.transitionObjective || "Not configured"}</dd></div>
          </>}
        </dl>
        {node && graph.version.status === "draft" && (
          <Form key={`${node?.id ?? edge?.id}:${graph.revision ?? "legacy"}`} className="compact-form" method="post">
            <input type="hidden" name="intent" value="update-sendero-node" />
            <input type="hidden" name="nodeId" value={node.id} />
            <input type="hidden" name="expectedRevision" value={graph.revision ?? ""} />
            <h3>Edit node</h3>
            <label>Node label<input name="label" required defaultValue={node.label} /></label>
            <button className="button button-primary" disabled={pending || hasUnsavedGraph}>Save node</button>
          </Form>
        )}
        {edge && graph.version.status === 'draft' && (
          <Form key={`${node?.id ?? edge?.id}:${graph.revision ?? "legacy"}`} className="compact-form" method="post">
            <input type="hidden" name="intent" value="update-sendero-edge" />
            <input type="hidden" name="edgeId" value={edge.id} />
            <input type="hidden" name="expectedRevision" value={graph.revision ?? ""} />
            <h3>Edit transition</h3>
            <label>Arc name<input name="name" required defaultValue={edge.name} /></label>
            <label>Description<input name="description" defaultValue={edge.description} placeholder="Description" /></label>
            <label>Transition objective<textarea name="transitionObjective" defaultValue={edge.transitionObjective} /></label>
            <label>Transition status<select name="status" defaultValue={edge.status}>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="disabled">Disabled</option>
              <option value="archived">Archived</option>
            </select></label>
            <label>Routing condition JSON<textarea name="conditionJson" defaultValue={JSON.stringify(routingCondition)} /><small>Use an outcome condition here. Completion gates are configured separately.</small></label>
            {legacyPolicy ? <><h3>Legacy completion policy</h3><label><input type="checkbox" name="requireReview" defaultChecked={(objectJson(edge.conditionJson).completion as { requireReview?: boolean } | undefined)?.requireReview ?? false} /> Require approval</label>
            <label>Required evidence kinds (comma separated)<input name="evidenceKinds" defaultValue={((objectJson(edge.conditionJson).completion as { evidenceKinds?: string[] } | undefined)?.evidenceKinds ?? []).join(', ')} /></label></> : <p>Execution objectives and completion gates belong to the source node. Edit them in the graph editor.</p>}
            <button className="button button-primary" disabled={pending || hasUnsavedGraph}>Save arc</button>
          </Form>
        )}
      </section>
      <details className="inspector-section inspector-disclosure">
        <summary>Technical details</summary>
        <dl className="property-list">
          <div><dt>Sendero ID</dt><dd className="mono">{graph.sendero.id}</dd></div>
          {node && <><div><dt>Node ID</dt><dd className="mono">{node.id}</dd></div><div><dt>Position</dt><dd>{node.positionX}, {node.positionY}</dd></div></>}
          {agent && <div><dt>Agent ID</dt><dd className="mono">{agent.id}</dd></div>}
          {edge && <>
            <div><dt>Arc ID</dt><dd className="mono">{edge.id}</dd></div>
            <div><dt>Source node ID</dt><dd className="mono">{edge.sourceNodeId}</dd></div>
            <div><dt>Target node ID</dt><dd className="mono">{edge.targetNodeId}</dd></div>
            <div><dt>Conditions</dt><dd className="mono">{edge.conditionJson}</dd></div>
          </>}
        </dl>
      </details>
      <section className="inspector-section event-preview">
        <header>
          <h3>Related events</h3>
          <span>{events.length}</span>
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
        {!events.length && <p>No related events recorded yet.</p>}
      </section>
    </aside>
  );
}
