import { DurableLink as Link } from "../../../components/durable-link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { DocumentReloadButton } from "../../../components/document-reload-button";
import { useClientReady } from "../../../hooks/use-client-ready";
import { useExecutionSubmission } from "../../../hooks/use-execution-submission";
import { Form, useActionData, useNavigation } from "react-router";
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
  onDraftChange,
}: {
  data: MissionControlData;
  senderoId: string;
  nodeId?: string;
  edgeId?: string;
  hasUnsavedGraph?: boolean;
  onDraftChange?: (dirty: boolean) => void;
}) {
  const pending = useNavigation().state !== "idle";
  const [compactDirty, setCompactDirty] = useState(false);
  const draftChanged = (dirty: boolean) => { setCompactDirty(dirty); onDraftChange?.(dirty); };
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
          <button className="button button-primary" disabled={pending || hasUnsavedGraph || compactDirty}>{graph.version.status === 'draft' ? 'Validate & publish draft' : 'Create editable draft'}</button>
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
          <CompactInspectorForm revision={graph.revision} intent="update-sendero-node" disabled={hasUnsavedGraph} onDraftChange={draftChanged}>
            <input type="hidden" name="intent" value="update-sendero-node" />
            <input type="hidden" name="nodeId" value={node.id} />
            <h3>Edit node</h3>
            <label>Node label<input name="label" required defaultValue={node.label} /></label>
            <button className="button button-primary">Save node</button>
          </CompactInspectorForm>
        )}
        {edge && graph.version.status === 'draft' && (
          <CompactInspectorForm revision={graph.revision} intent="update-sendero-edge" disabled={hasUnsavedGraph} onDraftChange={draftChanged}>
            <input type="hidden" name="intent" value="update-sendero-edge" />
            <input type="hidden" name="edgeId" value={edge.id} />
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
            <button className="button button-primary">Save arc</button>
          </CompactInspectorForm>
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
          <h3>Recent related events</h3>
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
        {!events.length && <p>No related events in the recent history.</p>}
      </section>
    </aside>
  );
}


/** Keep reviewed inputs and revision together until a confirmed save or explicit discard. */
function CompactInspectorForm({ revision, intent, disabled, onDraftChange, children }: {
  revision?: string; intent: 'update-sendero-node' | 'update-sendero-edge'; disabled: boolean;
  onDraftChange: (dirty: boolean) => void; children: ReactNode;
}) {
  const [reviewedRevision, setReviewedRevision] = useState(revision);
  const [generation, setGeneration] = useState(0);
  const [reviewedFields, setReviewedFields] = useState(children);
  const [dirty, setDirty] = useState(false);
  const submitted = useRef(false);
  const callback = useRef(onDraftChange); callback.current = onDraftChange;
  const feedback = useActionData<{ ok?: boolean; intent?: string }>();
  const { pending, uncertain, submit } = useExecutionSubmission(intent);
  const ready = useClientReady();
  const locked = pending || uncertain || disabled || !ready;
  const stale = reviewedRevision !== revision;
  const publishDirty = (value: boolean) => { setDirty(value); callback.current(value || uncertain); };
  function readPersisted() {
    setReviewedRevision(revision); setReviewedFields(children); setGeneration(value => value + 1); publishDirty(false);
  }
  useEffect(() => () => callback.current(false), []);
  useEffect(() => { callback.current(dirty || uncertain); }, [dirty, uncertain]);
  useEffect(() => {
    if (pending || uncertain) return;
    if (submitted.current && feedback?.intent === intent) {
      submitted.current = false;
      if (feedback.ok) readPersisted();
    } else if (!dirty && stale) readPersisted();
  }, [pending, uncertain, feedback, intent, dirty, stale, revision]);
  return <Form className="compact-form" method="post" onChange={event => {
    const fields = [...event.currentTarget.elements].filter((field): field is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement =>
      field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement);
    publishDirty(fields.some(field => field instanceof HTMLSelectElement
      ? [...field.options].some(option => option.selected !== option.defaultSelected)
      : field instanceof HTMLInputElement && field.type === 'checkbox'
      ? field.checked !== field.defaultChecked : field.value !== field.defaultValue));
  }} onReset={event => { event.preventDefault(); if (!locked) readPersisted(); }} onSubmit={event => {
    if (locked || stale) { event.preventDefault(); return; }
    submit(event); if (!event.defaultPrevented) submitted.current = true;
  }}>
    <input type="hidden" name="expectedRevision" value={reviewedRevision ?? ''} />
    <fieldset key={generation} disabled={locked || stale} className="authoring-fields">{reviewedFields}</fieldset>
    {stale && dirty && <p role="alert">This draft changed elsewhere. Your inspector inputs are kept here. Discard them to load the latest reviewed version before saving.</p>}
    {uncertain && <div className="snapshot-status" role="status"><p>Studio could not confirm the inspector save. Your inputs are kept here; the save may have reached the server. Reload and inspect the persisted workflow before submitting again. Reload never repeats the save.</p><DocumentReloadButton>Reload persisted workflow</DocumentReloadButton></div>}
    <button type="button" className="button button-secondary" disabled={!dirty || pending || uncertain || !ready} onClick={readPersisted}>Discard inspector changes</button>
  </Form>;
}
