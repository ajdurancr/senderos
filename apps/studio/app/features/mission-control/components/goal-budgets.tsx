import { Form, useNavigation } from "react-router";
import type { MissionControlData } from "../server";

export function GoalBudgets({ data, goal }: { data: MissionControlData; goal: MissionControlData["goals"][number] }) {
  const pending = useNavigation().state !== "idle";
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
        <Form key={`activations-${goal.id}-${execution.maxActivations}`} method="post" className="compact-form" aria-label="Change activation limit">
          <input type="hidden" name="intent" value="set-activation-budget" /><input type="hidden" name="goalId" value={goal.id} />
          <label>Activation limit<input name="limit" type="number" required min={Math.max(1, execution.activationsUsed)} max={10000} step={1} defaultValue={execution.maxActivations} /></label>
          <button className="button button-secondary" disabled={pending}>{pending ? "Saving…" : "Save activation limit"}</button>
        </Form>
        <Form key={`attempts-${goal.id}-${execution.maxAttempts}`} method="post" className="compact-form" aria-label="Change attempt limit">
          <input type="hidden" name="intent" value="set-retry-budget" /><input type="hidden" name="goalId" value={goal.id} />
          <label>Attempt limit per activation<input name="limit" type="number" required min={1} max={100} step={1} defaultValue={execution.maxAttempts} /></label>
          <button className="button button-secondary" disabled={pending}>{pending ? "Saving…" : "Save attempt limit"}</button>
        </Form>
      </> : <p>{execution.cancellationRequestedAt ? "Budget changes are unavailable while cancellation awaits host acknowledgement." : "This goal’s execution budgets are read-only."}</p>}
    </>}
  </section>;
}
