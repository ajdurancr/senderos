import { useClientReady } from "../../../hooks/use-client-ready";
import { useEffect, useRef, useState } from 'react';
import { Form, useActionData, useNavigation } from 'react-router';
import { DurableLink as Link } from '../../../components/durable-link';
import { graphDraft, graphDraftErrors, graphDefinition, removeDraftNode, type DraftNode, type DraftEdge, type GraphDraft } from '../graph-authoring';
import type { MissionControlData } from '../server';

type Graph = MissionControlData['senderoGraphs'][number];

export function SenderoCreation() {
  const clientReady = useClientReady();
  const pending = useNavigation().state !== 'idle';
  const [mode, setMode] = useState<'create' | 'import'>('create');
  return <div className="standard-view"><Form className="create-panel authoring-panel" method="post">
    <input type="hidden" name="intent" value={mode === 'create' ? 'create-sendero' : 'import-sendero'} />
    <header><div><span>New Sendero</span><h2>Create a directed workflow</h2></div><Link className="button button-secondary" to="/senderos" onClick={event => { event.currentTarget.closest("form")?.reset(); setMode("create"); }}>Cancel</Link></header>
    <fieldset disabled={pending || !clientReady} className="authoring-fields"><legend>Workflow details</legend><label>Method<select aria-label="Authoring method" value={mode} onChange={event => setMode(event.target.value as typeof mode)}><option value="create">Create a new draft</option><option value="import">Import a JSON definition</option></select></label>
    {mode === 'create' ? <><div className="form-row"><label>Name<input name="name" required maxLength={200} /></label><label>Slug<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="research-workflow" /></label></div><label>Description<textarea name="description" rows={3} /></label><p>The draft begins with start and end nodes. Add agents, directed transitions, outcomes, and a cycle budget before publishing.</p></> : <label>Sendero JSON<textarea name="definition" aria-label="Sendero JSON" rows={16} required spellCheck={false} placeholder={'{"slug":"research","name":"Research","nodes":[{"key":"start","kind":"start","label":"Start"},{"key":"end","kind":"end","label":"End"}],"edges":[{"key":"finish","source":"start","target":"end","name":"Finish"}]}'} /><small>Include slug, name, nodes, and edges. Node keys identify transition sources, targets, and explicit fork/join pairs. Import always creates an unpublished draft.</small></label>}
    </fieldset><footer><span>Publishing remains a separate validation step.</span><button className="button button-primary" disabled={pending || !clientReady}>{pending ? 'Saving…' : mode === 'create' ? 'Create draft' : 'Import draft'}</button></footer>
  </Form></div>;
}

export function SenderoGraphEditor({ graph, agents, onDirtyChange }: { graph: Graph; agents: MissionControlData['agents']; onDirtyChange?: (dirty: boolean) => void }) {
  if (graph.version.status !== 'draft') return null;
  return <GraphEditor key={graph.version.id} graph={graph} agents={agents} onDirtyChange={onDirtyChange} />;
}

function GraphEditor({ graph, agents, onDirtyChange }: { graph: Graph; agents: MissionControlData['agents']; onDirtyChange?: (dirty: boolean) => void }) {
  const [original, setOriginal] = useState(() => graphDraft(graph));
  const [draft, setDraft] = useState<GraphDraft>(original);
  const [expectedRevision, setExpectedRevision] = useState(graph.revision);
  const submitted = useRef(false);
  const actionData = useActionData<{ ok?: boolean; intent?: string }>();
  const [notice, setNotice] = useState('');
  const nextId = useRef(0);
  const clientReady = useClientReady();
  const pending = useNavigation().state !== 'idle';
  const dirty = JSON.stringify(original) !== JSON.stringify(draft);
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (pending) return;
    if (submitted.current && actionData?.intent === 'replace-sendero-draft') {
      submitted.current = false;
      if (!actionData.ok) return;
      const saved = graphDraft(graph);
      setOriginal(saved); setDraft(saved); setExpectedRevision(graph.revision); setNotice('Graph draft saved.');
    } else if (!dirty && !submitted.current && expectedRevision !== graph.revision) {
      const refreshed = graphDraft(graph);
      setOriginal(refreshed); setDraft(refreshed); setExpectedRevision(graph.revision);
    }
  }, [pending, actionData, graph, dirty, expectedRevision]);
  const errors = graphDraftErrors(draft);
  const newKey = (kind: string) => `new-${kind}-${++nextId.current}`;
  const updateNode = (key: string, patch: Partial<DraftNode>) => setDraft(value => ({ ...value, nodes: value.nodes.map(node => node.key === key ? { ...node, ...patch } : node) }));
  const updateEdge = (key: string, patch: Partial<DraftEdge>) => setDraft(value => ({ ...value, edges: value.edges.map(edge => edge.key === key ? { ...edge, ...patch } : edge) }));
  const addNode = () => setDraft(value => ({ ...value, nodes: [...value.nodes, { key: newKey('node'), kind: 'agent', label: 'New agent', agentId: agents.find(agent => agent.status === 'active')?.id, positionX: 180 + value.nodes.length * 40, positionY: 240, executionObjective: 'Describe the expected result.', completionJson: '{}', requirementsJson: '[]', joinForkNodeId: '' }] }));
  const addEdge = () => setDraft(value => ({ ...value, edges: [...value.edges, { key: newKey('edge'), source: value.nodes[0]?.key ?? '', target: value.nodes.at(-1)?.key ?? '', name: 'New transition', description: '', transitionObjective: '', conditionJson: '{}', status: 'active' }] }));
  return <Form className="create-panel authoring-panel graph-editor" method="post" onSubmit={event => { if (errors.length || pending) event.preventDefault(); else submitted.current = true; }}>
    <input type="hidden" name="intent" value="replace-sendero-draft" />
    <input type="hidden" name="senderoId" value={graph.sendero.id} />
    <input type="hidden" name="expectedVersionId" value={graph.version.id} />
    <input type="hidden" name="expectedRevision" value={expectedRevision ?? ""} />
    <input type="hidden" name="definition" value={JSON.stringify(graphDefinition(draft))} />
    <header><div><span>Draft graph editor</span><h2>Nodes, transitions, and routing</h2></div><button className="button button-secondary" type="button" disabled={!dirty || pending || !clientReady} onClick={() => { const current = graphDraft(graph); submitted.current = false; setOriginal(current); setDraft(current); setExpectedRevision(graph.revision); setNotice('Unsaved graph changes discarded.'); }}>Cancel changes</button></header>
    <p>Multiple matching outgoing transitions activate multiple paths. Backedges create new visits. Ordinary convergence keeps each arrival separate; an explicit fork/join pair waits for its activated branches.</p>
    <fieldset disabled={pending || !clientReady} className="authoring-fields"><legend>Execution and routing</legend><label>Maximum activations per goal<input type="number" min="1" max="10000" value={draft.maxActivations} onChange={event => setDraft(value => ({ ...value, maxActivations: Number(event.target.value) }))} /></label>
    <section className="graph-editor-section"><header><h3>Nodes</h3><button className="button button-secondary" type="button" onClick={addNode} disabled={pending || !clientReady}>Add node</button></header>
      {draft.nodes.map((node, index) => <fieldset key={node.key} className="graph-edit-row"><legend>{node.label || `Node ${index + 1}`}</legend>
        <div className="form-row"><label>Node label<input value={node.label} onChange={event => updateNode(node.key, { label: event.target.value })} required /></label><label>Node kind<select value={node.kind} onChange={event => updateNode(node.key, { kind: event.target.value as DraftNode['kind'] })}><option value="agent">Agent</option><option value="start">Start</option><option value="end">End</option></select></label></div>
        {node.kind === 'agent' && <><label>Agent<select required value={node.agentId ?? ''} onChange={event => updateNode(node.key, { agentId: event.target.value })}><option value="">Select an agent</option>{agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name} · {agent.status}</option>)}</select></label><label>Execution objective<textarea rows={2} value={node.executionObjective} onChange={event => updateNode(node.key, { executionObjective: event.target.value })} /></label><details><summary>Completion, host requirements, and joins</summary><label>Completion policy JSON<textarea rows={3} spellCheck={false} value={node.completionJson} onChange={event => updateNode(node.key, { completionJson: event.target.value })} /><small>Example: {'{"requireReview":true,"evidenceKinds":["test"]}'}. Empty {'{}'} adds no review or evidence gate.</small></label><label>Required capabilities JSON<textarea rows={2} spellCheck={false} value={node.requirementsJson} onChange={event => updateNode(node.key, { requirementsJson: event.target.value })} /><small>Example: ["browser", "independent_session"]. The host declares and verifies availability.</small></label><label>Wait for branches from fork<select value={node.joinForkNodeId ?? ''} onChange={event => updateNode(node.key, { joinForkNodeId: event.target.value })}><option value="">No join; activate on each arrival</option>{draft.nodes.filter(item => item.key !== node.key && draft.edges.filter(edge => edge.source === item.key && edge.status === 'active').length > 1).map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label></details></>}
        <small className="mono">{node.key}</small><button className="button button-danger" type="button" disabled={pending || !clientReady} onClick={() => { setDraft(value => removeDraftNode(value, node.key)); setNotice('Node and incident transitions removed from this draft. Other node policies are unchanged. Save to apply.'); }}>Remove node</button>
      </fieldset>)}
    </section>
    <section className="graph-editor-section"><header><h3>Directed transitions</h3><button className="button button-secondary" type="button" disabled={pending || !clientReady || !draft.nodes.length} onClick={addEdge}>Add transition</button></header>
      {draft.edges.map((edge, index) => <fieldset key={edge.key} className="graph-edit-row"><legend>{edge.name || `Transition ${index + 1}`}</legend>
        <label>Transition name<input required value={edge.name} onChange={event => updateEdge(edge.key, { name: event.target.value })} /></label>
        <div className="form-row"><label>From node<select value={edge.source} onChange={event => updateEdge(edge.key, { source: event.target.value })}>{draft.nodes.map(node => <option key={node.key} value={node.key}>{node.label}</option>)}</select></label><label>To node<select value={edge.target} onChange={event => updateEdge(edge.key, { target: event.target.value })}>{draft.nodes.map(node => <option key={node.key} value={node.key}>{node.label}</option>)}</select></label></div>
        <label>Routing condition JSON<textarea aria-label="Routing condition JSON" rows={2} spellCheck={false} value={edge.conditionJson} onChange={event => updateEdge(edge.key, { conditionJson: event.target.value })} /><small>{'{}'} always matches. {'{"outcome":"accepted"}'} matches a reported outcome. Backedges use the same rules.</small></label>
        <details><summary>Description and compatibility policy</summary><label>Description<input value={edge.description} onChange={event => updateEdge(edge.key, { description: event.target.value })} /></label><label>Legacy transition objective<textarea rows={2} value={edge.transitionObjective} onChange={event => updateEdge(edge.key, { transitionObjective: event.target.value })} /><small>Kept for existing definitions. Set an explicit node objective for new workflows.</small></label></details>
        <label>Transition status<select value={edge.status} onChange={event => updateEdge(edge.key, { status: event.target.value as DraftEdge['status'] })}><option value="active">Active</option><option value="draft">Draft</option><option value="disabled">Disabled</option><option value="archived">Archived</option></select></label>
        <button type="button" className="button button-danger" disabled={pending || !clientReady} onClick={() => setDraft(value => ({ ...value, edges: value.edges.filter(item => item.key !== edge.key) }))}>Remove transition</button>
      </fieldset>)}
      {!draft.edges.length && <p>No transitions yet. Connect nodes to define routing.</p>}
    </section>
    </fieldset>{dirty && expectedRevision !== graph.revision && <p role="alert">This draft changed elsewhere. Your edits are kept here. Cancel changes to load the latest draft before saving.</p>}{notice && <p role="status">{notice}</p>}
    {errors.length > 0 && <div className="action-feedback error" role="alert"><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul></div>}
    <footer><span>{dirty ? 'Unsaved changes. Save the draft, then validate and publish.' : 'All graph edits are saved.'}</span><button className="button button-primary" disabled={pending || !clientReady || !dirty || errors.length > 0}>{pending ? 'Saving…' : 'Save graph draft'}</button></footer>
  </Form>;
}
