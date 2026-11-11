import { useEffect, useRef, useState, type FormEvent } from "react";
import { Form, useActionData, useNavigation } from "react-router";
import { useInspectorDraft } from "./inspector-draft-boundary";
import type { MissionControlData } from "../server";

export function GoalBudgets({ data, goal }: { data: MissionControlData; goal: MissionControlData["goals"][number] }) {
  const execution = data.executions?.find(item => item.goalId === goal.id);
  const activations = data.activations.filter(item => item.goalId === goal.id);
  const editable = ["active", "blocked", "failed"].includes(goal.status) && !execution?.cancellationRequestedAt;
  return <section className="inspector-section" aria-label="Execution budgets">
    <h3>Execution budgets</h3>
    {!execution ? <p>{goal.status === "draft" ? "Start this goal to initialize its execution budgets." : "Execution budget records are unavailable. Refresh before changing limits."}</p> : <>
      <dl className="property-list">
        <div><dt>Activations used</dt><dd>{execution.activationsUsed} / {execution.maxActivations}</dd></div>
        <div><dt>Attempts per activation</dt><dd>{execution.maxAttempts}</dd></div>
      </dl>
      <p>Activations count workflow steps. The attempt limit applies separately to each activation, including its first attempt.</p>
      {activations.length > 0 && <ul>{activations.map(item => <li key={item.id}>{data.historyGraphs.flatMap(graph => graph.nodes).find(node => node.id === item.nodeId)?.label ?? item.nodeId}: {item.attemptsUsed} / {item.maxAttempts} attempts · {item.status}</li>)}</ul>}
      {editable ? <>
        <p>Changing a limit does not start a worker or reserve a run. Review ready activations before dispatching. Completed activations retain their recorded limits.</p>
        <BudgetDraft key={`activations-${goal.id}`} goalId={goal.id} kind="activation" limit={execution.maxActivations} minimum={Math.max(1, execution.activationsUsed)} />
        <BudgetDraft key={`attempts-${goal.id}`} goalId={goal.id} kind="attempt" limit={execution.maxAttempts} minimum={1} />
      </> : <p>{execution.cancellationRequestedAt ? "Budget changes are unavailable while cancellation awaits host acknowledgement." : "This goal’s execution budgets are read-only."}</p>}
    </>}
  </section>;
}

function BudgetDraft({ goalId, kind, limit, minimum }: { goalId: string; kind: 'activation' | 'attempt'; limit: number; minimum: number }) {
  const pending = useNavigation().state !== 'idle';
  const action = useActionData<{ ok?: boolean; intent?: string }>();
  const submitted = useRef<{ previous: unknown } | null>(null);
  const [value, setValue] = useState(String(limit));
  const [baseline, setBaseline] = useState(String(limit));
  const dirty = value !== baseline;
  const intent = kind === 'activation' ? 'set-activation-budget' : 'set-retry-budget';
  useInspectorDraft('budget', dirty || (pending && submitted.current !== null), pending);
  useEffect(() => {
    if (pending) return;
    if (submitted.current && action !== submitted.current.previous) {
      submitted.current = null;
      if (action?.ok && action.intent === intent) {
        setValue(String(limit)); setBaseline(String(limit));
        return;
      }
    }
    // Refresh clean values, but never overwrite an independent unsaved limit.
    if (!dirty) { setValue(String(limit)); setBaseline(String(limit)); }
  }, [action, pending, limit, intent, dirty]);
  function submit(event: FormEvent<HTMLFormElement>) {
    if (pending || submitted.current) { event.preventDefault(); return; }
    submitted.current = { previous: action };
  }
  const label = kind === 'activation' ? 'Activation limit' : 'Attempt limit per activation';
  return <Form method="post" className="compact-form" aria-label={`Change ${kind} limit`} onSubmit={submit}>
    <input type="hidden" name="intent" value={intent} /><input type="hidden" name="goalId" value={goalId} />
    <fieldset disabled={pending} className="authoring-fields"><legend>{kind === 'activation' ? 'Activation' : 'Attempt'} budget draft</legend>
      <label>{label}<input name="limit" type="number" required min={minimum} max={kind === 'activation' ? 10000 : 100} step={1} value={value} onChange={event => setValue(event.target.value)} /></label>
    </fieldset>
    <button className="button button-secondary" disabled={pending}>{pending ? 'Saving…' : `Save ${kind} limit`}</button>
    <button type="button" className="button button-secondary" disabled={pending || !dirty} onClick={() => { setValue(String(limit)); setBaseline(String(limit)); }}>Discard {kind} limit draft</button>
  </Form>;
}
