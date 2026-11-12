import { useEffect, useRef, useState } from 'react';
import { DocumentReloadButton } from '../../../components/document-reload-button';
import { useExecutionSubmission } from '../../../hooks/use-execution-submission';
import { useClientReady } from '../../../hooks/use-client-ready';
import { DraftNavigationGuard } from '../../../components/draft-navigation-guard';
import { Form, useActionData, useLocation } from 'react-router';
import { DurableLink as Link } from '../../../components/durable-link';
import type { MissionControlData } from '../server';

export function AgentAuthoring({ data, agentId, create = false }: {
  data: MissionControlData; agentId?: string; create?: boolean;
}) {
  const agent = data.agents.find(item => item.id === agentId);
  if (!create && !agentId) return null;
  if (!create && !agent) return <section className="create-panel"><p role="alert">This agent is no longer available.</p><Link to="/agents">Back to agents</Link></section>;
  return <AgentEditor key={agent?.id ?? 'new'} agent={agent} create={create} />;
}

function AgentEditor({ agent, create }: { agent?: MissionControlData['agents'][number]; create: boolean }) {
  const clientReady = useClientReady();
  const [dirty, setDirty] = useState(false);
  const submitted = useRef(false);
  const feedback = useActionData<{ ok?: boolean }>();
  const location = useLocation();
  const intent = create ? 'create-agent' : 'update-agent';
  const { pending, uncertain, submit } = useExecutionSubmission(intent);
  const locked = pending || uncertain || !clientReady;
  useEffect(() => {
    if (pending || !submitted.current) return;
    if (feedback?.ok === false) { submitted.current = false; return; }
    if (new URLSearchParams(location.search).get('saved') === intent) { submitted.current = false; setDirty(false); }
  }, [pending, feedback, location.search, intent]);
  const original: Record<string, string> = { name: agent?.name ?? '', slug: agent?.slug ?? '', description: agent?.description ?? '', instructions: agent?.definitionBody ?? '', status: agent?.status ?? 'active' };
  return <Form onChange={event => {
    const form = new FormData(event.currentTarget);
    setDirty(Object.entries(original).some(([key, value]) => String(form.get(key) ?? '') !== value));
  }} onReset={event => { if (locked) { event.preventDefault(); return; } setDirty(false); submitted.current = false; }} onSubmit={event => { submit(event); if (!event.defaultPrevented) submitted.current = true; }} className="create-panel authoring-panel" method="post">
    <DraftNavigationGuard subject="agent" dirty={dirty || uncertain} saving={pending} allowNavigation={(pathname, search) => !uncertain && submitted.current && /^\/agents\/[^/]+$/.test(pathname) && new URLSearchParams(search).get('saved') === intent} />
    <input type="hidden" name="intent" value={create ? 'create-agent' : 'update-agent'} />
    {agent && <input type="hidden" name="agentId" value={agent.id} />}
    <header><div><span>{create ? 'New agent' : 'Edit agent'}</span><h2>{create ? 'Define a custom agent' : agent?.name}</h2></div><Link className="button button-secondary" to="/agents" aria-label="Close agent editor" aria-disabled={locked || undefined} onClick={event => { if (locked) { event.preventDefault(); return; } event.currentTarget.closest("form")?.reset(); }}>Cancel</Link></header>
    {uncertain && <div className="snapshot-status" role="status"><p>Studio could not confirm the agent save. Your input is kept here, but the request may have reached the server. Reload and inspect persisted agents before submitting again. Reloading never repeats creation or editing.</p><DocumentReloadButton>Reload persisted agents</DocumentReloadButton></div>}
    <fieldset disabled={locked} className="authoring-fields"><legend>Agent details</legend><div className="form-row"><label>Name<input name="name" required defaultValue={agent?.name} maxLength={200} /></label><label>Slug<input name="slug" aria-label="Slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" defaultValue={agent?.slug} placeholder="research-assistant" /><small>Lowercase words separated by hyphens.</small></label></div>
    <label>Description<textarea name="description" rows={2} defaultValue={agent?.description} /></label>
    <h3>Behavior</h3><label>Instructions<textarea name="instructions" required rows={10} defaultValue={agent?.definitionBody} placeholder="Describe the role, expected result, and constraints." /></label>
    <label>Status<select name="status" defaultValue={agent?.status ?? 'active'}><option value="active">Active</option><option value="disabled">Disabled</option><option value="archived">Archived</option></select></label>
    </fieldset><footer><span>Published Senderos keep their pinned agent instructions. Publish a new draft to use changes.</span><button className="button button-primary" disabled={locked}>{pending ? 'Saving…' : create ? 'Create agent' : 'Save agent'}</button></footer>
  </Form>;
}
