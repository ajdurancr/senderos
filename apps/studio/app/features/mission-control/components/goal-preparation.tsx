import { useEffect, useId, useRef, useState } from 'react';
import { Form, useActionData, useNavigation } from 'react-router';
import { DraftNavigationGuard } from '../../../components/draft-navigation-guard';
import { useClientReady } from '../../../hooks/use-client-ready';
import type { MissionControlData } from '../server';

type Goal = MissionControlData['goals'][number];
const snapshot = (goal: Goal) => ({ title: goal.title, kind: goal.kind, specText: goal.specText, senderoVersionId: goal.senderoVersionId });

export function GoalPreparation({ goal, graphs, onEditingChange }: { goal: Goal; graphs: MissionControlData['senderoGraphs']; onEditingChange: (editing: boolean) => void }) {
  const formId = useId();
  const [editing, setEditing] = useState(false);
  const [original, setOriginal] = useState(() => snapshot(goal));
  const [draft, setDraft] = useState(original);
  const submitted = useRef(false);
  const priorAction = useRef<unknown>(null);
  const action = useActionData<{ ok?: boolean; intent?: string }>();
  const pending = useNavigation().state !== 'idle';
  const ready = useClientReady();
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);
  useEffect(() => { onEditingChange(editing); return () => onEditingChange(false); }, [editing, onEditingChange]);
  useEffect(() => {
    if (pending) return;
    if (submitted.current && action !== priorAction.current && action?.intent === 'update-goal') {
      submitted.current = false;
      if (!action.ok) return;
      const saved = snapshot(goal); setOriginal(saved); setDraft(saved); setEditing(false);
    } else if (!dirty && !submitted.current && JSON.stringify(snapshot(goal)) !== JSON.stringify(original)) {
      const fresh = snapshot(goal); setOriginal(fresh); setDraft(fresh);
    }
  }, [pending, action, goal, dirty, original]);
  const published = graphs.filter(graph => graph.version.status === 'published');
  if (!editing) return <div className="goal-preparation">
    <button type="button" className="button button-secondary" disabled={pending || !ready} onClick={() => { const fresh = snapshot(goal); setOriginal(fresh); setDraft(fresh); setEditing(true); }}>Edit goal</button>
    {!goal.senderoVersionId && <p>Choose a published Sendero in Edit goal before starting.</p>}
    <Form method="post"><input type="hidden" name="intent" value="start" /><input type="hidden" name="goalId" value={goal.id} /><button className="button button-primary" disabled={pending || !ready || !goal.senderoVersionId}>{pending ? 'Starting…' : 'Start goal'}</button></Form>
  </div>;
  return <Form method="post" className="compact-form goal-preparation" aria-label="Goal preparation" onSubmit={() => { submitted.current = true; priorAction.current = action; }}>
    <DraftNavigationGuard dirty={dirty} saving={pending} subject="goal" />
    <input type="hidden" name="intent" value="update-goal" />
    <input type="hidden" name="goalId" value={goal.id} />
    <input type="hidden" name="expectedDraft" value={JSON.stringify(original)} />
    <h3>Prepare this goal</h3><p>Revise the outcome and choose its workflow before starting. Saving does not activate or dispatch work.</p>
    <fieldset disabled={pending || !ready} className="authoring-fields"><legend>Goal details</legend>
      <div className="goal-preparation-field"><label htmlFor={`${formId}-title`}>Goal title</label><input id={`${formId}-title`} name="title" required maxLength={200} value={draft.title} onChange={event => setDraft(value => ({ ...value, title: event.target.value }))} /></div>
      <div className="goal-preparation-field"><label htmlFor={`${formId}-kind`}>Goal category</label><input id={`${formId}-kind`} name="kind" required maxLength={100} value={draft.kind} onChange={event => setDraft(value => ({ ...value, kind: event.target.value }))} /></div>
      <div className="goal-preparation-field"><label htmlFor={`${formId}-specText`}>Goal specification</label><textarea id={`${formId}-specText`} name="specText" rows={5} value={draft.specText} onChange={event => setDraft(value => ({ ...value, specText: event.target.value }))} /></div>
      <div className="goal-preparation-field"><label htmlFor={`${formId}-senderoVersionId`}>Goal workflow</label><select id={`${formId}-senderoVersionId`} name="senderoVersionId" value={draft.senderoVersionId ?? ''} onChange={event => setDraft(value => ({ ...value, senderoVersionId: event.target.value || null }))}>
        <option value="">Choose a published Sendero later</option>
        {goal.senderoVersionId && !published.some(graph => graph.version.id === goal.senderoVersionId) && <option value={goal.senderoVersionId}>Current assigned version · {goal.senderoVersionId}</option>}
        {published.map(graph => <option key={graph.version.id} value={graph.version.id}>{graph.sendero.name} · v{graph.version.version}</option>)}
      </select></div>
      {!published.length && <p>No current published Senderos are available. Publish a workflow in Settings, then return to assign it.</p>}
    </fieldset>
    {dirty && JSON.stringify(snapshot(goal)) !== JSON.stringify(original) && <p role="alert">This goal draft changed elsewhere. Your edits are kept here. Cancel preparation to load the latest values.</p>}
    <p>Save or cancel preparation before starting or canceling this goal.</p>
    <div className="goal-preparation-actions"><button className="button button-primary" disabled={pending || !ready || !dirty}>{pending ? 'Saving…' : 'Save goal draft'}</button><button type="button" className="button button-secondary" disabled={pending} onClick={() => { submitted.current = false; const fresh = snapshot(goal); setOriginal(fresh); setDraft(fresh); setEditing(false); }}>Cancel preparation</button></div>
  </Form>;
}
