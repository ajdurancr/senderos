import { Form } from "react-router";
import { StatusBadge } from "../../../components/status-badge";
import type { MissionControlData } from "../server";

type Props = Pick<MissionControlData, "attempts" | "goals" | "runs">;
const terminalStatuses = new Set(["succeeded", "failed", "canceled"]);

export function AttemptInspector({ attempts, goals, runs }: Props) {
  const attempt = attempts.find((item) =>
    ["running", "queued", "paused"].includes(item.status),
  );
  const goal = attempt
    ? goals.find(
        (item) =>
          item.id === runs.find((run) => run.id === attempt.runId)?.goal_id,
      )
    : undefined;
  if (!attempt)
    return (
      <aside>
        <section className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[.06] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-cyan-200">
            Current execution
          </p>
          <p className="mt-3 text-sm text-slate-400">No active execution.</p>
        </section>
      </aside>
    );
  const snapshot = JSON.parse(attempt.statusSnapshotJson) as {
    evidence?: Array<{ id: string; label: string; kind: string }>;
    review?: { status: string };
  };
  return (
    <aside className="space-y-4">
      <section className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[.06] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-cyan-200">
          Current execution
        </p>
        <h2 className="mt-3 text-lg font-semibold text-white">
          {goal?.title ?? "Active attempt"}
        </h2>
        <div className="mt-4">
          <StatusBadge value={attempt.status} />
        </div>
        <dl className="mt-5 space-y-3 text-sm">
          <div>
            <dt className="text-slate-500">Harness</dt>
            <dd className="mt-1 text-slate-200">{attempt.harness}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Checkpoint</dt>
            <dd className="mt-1 text-slate-200">
              {attempt.checkpoint ?? "Waiting for host signal"}
            </dd>
          </div>
        </dl>
        {!terminalStatuses.has(attempt.status) && (
          <Form className="mt-5" method="post">
            <input name="intent" type="hidden" value="stop" />
            <input name="runId" type="hidden" value={attempt.runId} />
            <button className="w-full rounded-lg border border-rose-300/30 px-3 py-2 text-xs font-semibold text-rose-200">
              Stop execution
            </button>
          </Form>
        )}
      </section>
      <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-slate-400">
          Evidence & review
        </p>
        {snapshot.evidence?.map((item) => (
          <div
            className="mt-3 rounded-lg bg-slate-900/70 p-3 text-xs"
            key={item.id}
          >
            <p className="font-medium text-slate-200">{item.label}</p>
            <p className="mt-1 capitalize text-slate-500">{item.kind}</p>
          </div>
        ))}
        <Form className="mt-4 space-y-2" method="post">
          <input name="intent" type="hidden" value="evidence" />
          <input name="attemptId" type="hidden" value={attempt.id} />
          <input
            className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs"
            name="label"
            placeholder="Evidence label"
            required
          />
          <input
            className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs"
            name="url"
            placeholder="Optional URL"
          />
          <button className="text-xs font-semibold text-cyan-200">
            Record evidence
          </button>
        </Form>
        <Form
          className="mt-5 border-t border-white/10 pt-4 space-y-2"
          method="post"
        >
          <p className="text-xs text-slate-400">
            {snapshot.review
              ? `Review: ${snapshot.review.status}`
              : "No review decision recorded."}
          </p>
          <input name="intent" type="hidden" value="review" />
          <input name="attemptId" type="hidden" value={attempt.id} />
          <select
            className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs"
            name="status"
          >
            <option value="approved">Approve evidence</option>
            <option value="changes_requested">Request changes</option>
            <option value="rejected">Reject</option>
          </select>
          <input
            className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs"
            name="rationale"
            placeholder="Decision rationale"
          />
          <button className="text-xs font-semibold text-cyan-200">
            Record decision
          </button>
        </Form>
      </section>
    </aside>
  );
}
