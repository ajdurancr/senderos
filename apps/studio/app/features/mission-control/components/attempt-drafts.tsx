import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Form, useActionData, useNavigation } from 'react-router';
import { DraftNavigationGuard } from '../../../components/draft-navigation-guard';
import type { MissionControlData } from '../server';
import { parseAttemptSnapshot } from '../model';

type Draft = 'evidence' | 'review';
export function AttemptDrafts({ attempt, disabled }: { attempt: MissionControlData['attempts'][number]; disabled: boolean }) {
  const evidenceForm = useRef<HTMLFormElement>(null);
  const reviewForm = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState({ evidence: false, review: false });
  const pending = useNavigation().state !== 'idle';
  const action = useActionData<{ ok?: boolean; intent?: string }>();
  const submitted = useRef<{ kind: Draft; previous: unknown } | null>(null);
  const snapshot = parseAttemptSnapshot(attempt.statusSnapshotJson ?? '{}');
  const formFor = (kind: Draft) => kind === 'evidence' ? evidenceForm.current : reviewForm.current;
  function updateDirty(kind: Draft) {
    const form = formFor(kind);
    const changed = Array.from(form?.elements ?? []).some(element => {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return element.value !== element.defaultValue;
      if (element instanceof HTMLSelectElement) return Array.from(element.options).some(option => option.selected !== option.defaultSelected);
      return false;
    });
    setDirty(value => ({ ...value, [kind]: changed }));
  }
  function discard(kind: Draft) {
    formFor(kind)?.reset();
    setDirty(value => ({ ...value, [kind]: false }));
  }
  function submit(event: FormEvent<HTMLFormElement>, kind: Draft) {
    if (pending || submitted.current || disabled) { event.preventDefault(); return; }
    submitted.current = { kind, previous: action };
  }
  useEffect(() => {
    const submission = submitted.current;
    if (pending || !submission || action === submission.previous) return;
    submitted.current = null;
    if (!action?.ok || action.intent !== submission.kind) return;
    if (submission.kind === 'evidence') discard('evidence');
    else {
      // Keep the confirmed decision as the baseline. Resetting a rejection to
      // the initial Approve option would turn a repeated click into approval.
      for (const element of Array.from(reviewForm.current?.elements ?? [])) {
        if (element instanceof HTMLInputElement) element.defaultValue = element.value;
        if (element instanceof HTMLSelectElement) {
          const selected = element.value;
          for (const option of element.options) option.defaultSelected = option.value === selected;
        }
      }
      setDirty(value => ({ ...value, review: false }));
    }
  }, [pending, action]);
  return <>
    {!disabled && <DraftNavigationGuard dirty={dirty.evidence || dirty.review || (pending && submitted.current !== null)} saving={pending} subject="evidence and review" />}
    <Form ref={evidenceForm} className="compact-form" method="post" onChange={() => updateDirty("evidence")} onSubmit={event => submit(event, "evidence")}>
      <input type="hidden" name="intent" value="evidence" />
      <input type="hidden" name="attemptId" value={attempt.id} />
      <fieldset disabled={pending || disabled} className="authoring-fields"><legend>Evidence draft</legend>
        <label>Evidence kind<select name="kind" defaultValue="manual">
          <option value="manual">Manual observation</option>
          <option value="test">Test report</option>
          <option value="ci">CI result</option>
          <option value="pull_request">Pull request</option>
          <option value="artifact">Artifact</option>
        </select></label>
        <p>Choose the kind that matches your proof. Recording evidence does not run tests or verify its contents.</p>
        <label>Evidence label<input name="label" placeholder="Evidence label" required /></label>
        <label>Evidence URL (optional)<input type="url" name="url" placeholder="https://example.com/report" /></label>
        <label>Evidence summary (optional)<textarea name="summary" rows={3} placeholder="What was checked and what the result showed" /></label>
      </fieldset>
      <button className="button button-primary" disabled={pending || disabled}>{pending ? "Recording…" : "Record evidence"}</button>
      <button type="button" className="button button-secondary" disabled={pending || !dirty.evidence} onClick={() => discard("evidence")}>Discard evidence draft</button>
    </Form>
    <Form ref={reviewForm} className="review-form" method="post" onChange={() => updateDirty("review")} onSubmit={event => submit(event, "review")}>
      <input type="hidden" name="intent" value="review" />
      <input type="hidden" name="attemptId" value={attempt.id} />
      <fieldset disabled={pending || disabled} className="authoring-fields"><legend>Review draft</legend>
        <label>Review decision<select name="status" defaultValue="approved">
          <option value="approved">Approve</option>
          <option value="changes_requested">Request changes</option>
          <option value="rejected">Reject</option>
        </select></label>
        <label>Decision rationale<input name="rationale" placeholder="Decision rationale" /></label>
      </fieldset>
      <button className="button button-primary" disabled={pending || disabled}>{pending ? "Recording…" : "Record decision"}</button>
      <button type="button" className="button button-secondary" disabled={pending || !dirty.review} onClick={() => discard("review")}>Discard review draft</button>
      {snapshot.review && (
        <p>
          Current review:{" "}
          <strong>{snapshot.review.status.replaceAll("_", " ")}</strong>
        </p>
      )}
    </Form>
  </>;
}
