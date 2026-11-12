import { useState } from 'react';
import { Form } from 'react-router';
import { DraftNavigationGuard } from '../../../components/draft-navigation-guard';
import { DocumentReloadButton } from '../../../components/document-reload-button';
import { DurableLink as Link } from '../../../components/durable-link';
import { useClientReady } from '../../../hooks/use-client-ready';
import { useExecutionSubmission } from '../../../hooks/use-execution-submission';
import { projectPath } from '../navigation';
import type { MissionControlData } from '../server';

/** Creation has no revision or idempotency key: uncertain saves need inspection. */
export function GoalCreation({ projectId, graphs }: { projectId: string; graphs: MissionControlData['senderoGraphs'] }) {
  const published = graphs.filter(graph => graph.version.status === 'published');
  const [initial] = useState(() => ({ title: '', kind: 'task', specText: '', senderoVersionId: published[0]?.version.id ?? '' }));
  const [draft, setDraft] = useState(initial);
  const { pending, uncertain, submit } = useExecutionSubmission('create-goal');
  const ready = useClientReady();
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const locked = pending || uncertain || !ready;
  return <Form className="create-panel" method="post" aria-label="New goal" onSubmit={event => {
    if (!ready || !published.length) { event.preventDefault(); return; }
    submit(event);
  }}>
    <DraftNavigationGuard dirty={dirty || uncertain} saving={pending} subject="new goal" />
    <input type="hidden" name="intent" value="create-goal" /><input type="hidden" name="projectId" value={projectId} />
    <header><div><span>New goal</span><h2>Define the outcome before dispatch.</h2></div><Link className="button button-secondary" to={projectPath(projectId, 'goals')}>Cancel</Link></header>
    <fieldset className="authoring-fields" disabled={locked}><legend className="visually-hidden">New goal details</legend>
      <label>Title<input name="title" placeholder="Ship a verifiable outcome" required value={draft.title} onChange={event => setDraft(value => ({ ...value, title: event.target.value }))} /></label>
      <div className="form-row"><label>Category<input name="kind" required list="goal-kinds" value={draft.kind} onChange={event => setDraft(value => ({ ...value, kind: event.target.value }))} /><datalist id="goal-kinds"><option value="task" /><option value="research" /><option value="writing" /><option value="feature" /><option value="bugfix" /><option value="maintenance" /></datalist></label>
        <label>Sendero<select name="senderoVersionId" value={draft.senderoVersionId} onChange={event => setDraft(value => ({ ...value, senderoVersionId: event.target.value }))}>{published.map(graph => <option key={graph.version.id} value={graph.version.id}>{graph.sendero.name} · v{graph.version.version}</option>)}</select></label></div>
      <label>Specification<textarea name="specText" rows={5} placeholder="Expected behavior, constraints, and acceptance criteria" value={draft.specText} onChange={event => setDraft(value => ({ ...value, specText: event.target.value }))} /></label>
    </fieldset>
    {uncertain && <div className="action-feedback error" role="status"><p>Goal creation is unconfirmed. Your input is kept here. The goal may already exist; creating it again can add another goal.</p><DocumentReloadButton>Reload persisted goals</DocumentReloadButton><p>Inspect this project's goals before creating again. Reload discards this local draft and never resubmits it.</p></div>}
    <footer><span>{published.length ? 'Creation is durable. Dispatch remains a separate decision.' : 'Publish a Sendero before creating a goal.'}</span><button type="button" className="button button-secondary" disabled={locked || !dirty} onClick={() => setDraft(initial)}>Discard goal draft</button><button className="button button-primary" disabled={locked || !published.length}>{pending ? 'Creating…' : 'Create goal'}</button></footer>
  </Form>;
}
