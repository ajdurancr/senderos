import { Form, useNavigation } from 'react-router';
import { DurableLink as Link } from '../../../components/durable-link';
import type { MissionControlData } from '../server';

export function AgentAuthoring({ data, agentId, create = false }: {
  data: MissionControlData; agentId?: string; create?: boolean;
}) {
  const pending = useNavigation().state !== 'idle';
  const agent = data.agents.find(item => item.id === agentId);
  if (!create && !agentId) return null;
  if (!create && !agent) return <section className="create-panel"><p role="alert">This agent is no longer available.</p><Link to="/agents">Back to agents</Link></section>;
  return <Form key={agent?.id ?? 'new'} className="create-panel authoring-panel" method="post">
    <input type="hidden" name="intent" value={create ? 'create-agent' : 'update-agent'} />
    {agent && <input type="hidden" name="agentId" value={agent.id} />}
    <header><div><span>{create ? 'New agent' : 'Edit agent'}</span><h2>{create ? 'Define a custom agent' : agent?.name}</h2></div><Link to="/agents" aria-label="Close agent editor" onClick={event => event.currentTarget.closest("form")?.reset()}>Cancel</Link></header>
    <fieldset disabled={pending} className="authoring-fields"><div className="form-row"><label>Name<input name="name" required defaultValue={agent?.name} maxLength={200} /></label><label>Slug<input name="slug" aria-label="Slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" defaultValue={agent?.slug} placeholder="research-assistant" /><small>Lowercase words separated by hyphens.</small></label></div>
    <label>Description<textarea name="description" rows={2} defaultValue={agent?.description} /></label>
    <label>Instructions<textarea name="instructions" required rows={10} defaultValue={agent?.definitionBody} placeholder="Describe the role, expected result, and constraints." /></label>
    <label>Status<select name="status" defaultValue={agent?.status ?? 'active'}><option value="active">Active</option><option value="disabled">Disabled</option><option value="archived">Archived</option></select></label>
    </fieldset><footer><span>Published Senderos keep their pinned agent instructions. Publish a new draft to use changes.</span><button disabled={pending}>{pending ? 'Saving…' : create ? 'Create agent' : 'Save agent'}</button></footer>
  </Form>;
}
