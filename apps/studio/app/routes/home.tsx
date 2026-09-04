import { Form, useLoaderData, useNavigation } from "react-router";

import type { Route } from "./+types/home";
import { senderosForStudio } from "../server/senderos.server";

const terminalStatuses = new Set(["succeeded", "failed", "canceled"]);

export function meta() {
  return [{ title: "Mission Control · Senderos Studio" }, { name: "description", content: "Operational control plane for verified software outcomes." }];
}

export async function loader() {
  return senderosForStudio().missionControl.overview();
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const senderos = senderosForStudio();
  const intent = String(form.get("intent"));
  if (intent === "start") senderos.missionControl.startGoal({ goalId: String(form.get("goalId")) });
  if (intent === "retry") senderos.missionControl.retryExecution({ goalId: String(form.get("goalId")) });
  if (intent === "stop") senderos.missionControl.stopExecution({ runId: String(form.get("runId")) });
  if (intent === "evidence") senderos.commands.attempts.recordEvidence({
    attemptId: String(form.get("attemptId")), kind: String(form.get("kind")) as "test" | "ci" | "pull_request" | "artifact" | "manual",
    label: String(form.get("label")), url: String(form.get("url")) || undefined,
  });
  if (intent === "review") senderos.commands.attempts.review({
    attemptId: String(form.get("attemptId")), status: String(form.get("status")) as "approved" | "changes_requested" | "rejected" | "pending",
    reviewer: String(form.get("reviewer")), rationale: String(form.get("rationale")) || undefined,
  });
  return null;
}

function relativeTime(value?: string | null) {
  if (!value) return "No signal";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  return minutes < 1 ? "just now" : minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`;
}

function Badge({ value }: { value: string }) {
  const tone = value === "succeeded" || value === "approved" || value === "healthy" ? "bg-emerald-400/10 text-emerald-200 ring-emerald-400/25" : value === "failed" || value === "rejected" || value === "blocked" ? "bg-rose-400/10 text-rose-200 ring-rose-400/25" : value === "running" || value === "executing" || value === "active" ? "bg-cyan-400/10 text-cyan-100 ring-cyan-400/25" : "bg-slate-700/50 text-slate-300 ring-slate-600";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ${tone}`}>{value.replaceAll("_", " ")}</span>;
}

export default function Home() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const pending = navigation.state !== "idle";
  const activeAttempt = data.attempts.find((attempt) => ["running", "queued", "paused"].includes(attempt.status));
  const activeGoal = activeAttempt ? data.goals.find((goal) => goal.id === data.runs.find((run) => run.id === activeAttempt.runId)?.goal_id) : undefined;
  const snapshot = activeAttempt ? JSON.parse(activeAttempt.statusSnapshotJson) as { evidence?: Array<{ id: string; kind: string; label: string; url?: string }>; review?: { status: string; reviewer?: string; rationale?: string } } : undefined;

  return (
    <main className="min-h-screen bg-[#07111f] text-slate-100">
      <div className="mx-auto max-w-[1600px] px-5 py-5 lg:px-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-300 to-cyan-300 font-black text-slate-950">S</div><div><p className="font-semibold text-white">Senderos Studio</p><p className="text-xs text-slate-400">Mission Control</p></div></div>
          <div className="flex items-center gap-2 text-xs text-slate-400"><span className="h-2 w-2 rounded-full bg-emerald-300" /> Runtime connected {pending && <span className="text-cyan-200">· Updating</span>}</div>
        </header>

        <div className="grid gap-6 py-7 xl:grid-cols-[210px_minmax(0,1fr)_310px]">
          <aside className="hidden xl:block"><p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace</p><nav className="mt-3 space-y-1"><a className="block rounded-lg bg-cyan-300/10 px-3 py-2 text-sm font-medium text-cyan-100">Now</a>{["Goals", "Runs", "Reviews", "Agents", "Projects", "Operations"].map((item) => <span key={item} className="block rounded-lg px-3 py-2 text-sm text-slate-400">{item}</span>)}</nav></aside>

          <section className="min-w-0 space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Decision queue</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">What needs attention now.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Human attention is reserved for exceptions, proof, and consequential decisions.</p></div><div className="flex gap-2"><div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center"><p className="text-lg font-semibold text-white">{data.queue.dispatchable.length}</p><p className="text-[10px] uppercase tracking-wide text-slate-500">Ready</p></div><div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center"><p className="text-lg font-semibold text-white">{data.queue.reviews.length}</p><p className="text-[10px] uppercase tracking-wide text-slate-500">Reviews</p></div></div></div>

            <section className="grid gap-3 sm:grid-cols-3">
              {[{ label: "Needs review", value: data.queue.reviews.length, body: "Evidence awaiting a decision" }, { label: "Dispatchable", value: data.queue.dispatchable.length, body: "Ready to hand to a host" }, { label: "Exceptions", value: data.queue.failedAttempts.length + data.queue.blockedGoals.length, body: "Failures and blocked goals" }].map((card) => <article key={card.label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-slate-400">{card.label}</p><p className="mt-2 text-3xl font-semibold text-white">{card.value}</p><p className="mt-1 text-xs text-slate-500">{card.body}</p></article>)}
            </section>

            <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40"><div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><h2 className="font-medium text-white">Goals</h2><p className="mt-1 text-xs text-slate-500">Outcomes, not disconnected tickets.</p></div><span className="text-xs text-slate-500">{data.goals.length} total</span></div><div className="divide-y divide-white/5">{data.goals.length ? data.goals.map((goal) => { const run = data.runs.find((item) => item.goal_id === goal.id); return <div className="flex flex-wrap items-center gap-3 px-5 py-4" key={goal.id}><div className="min-w-[220px] flex-1"><p className="font-medium text-slate-100">{goal.title}</p><p className="mt-1 text-xs text-slate-500">{goal.kind} · {goal.baseTargetBranch}</p></div><Badge value={goal.status} />{run && <span className="text-xs text-slate-400">Run: {run.status}</span>}{goal.status === "draft" && <Form method="post"><input name="intent" type="hidden" value="start" /><input name="goalId" type="hidden" value={goal.id} /><button className="rounded-lg bg-cyan-300 px-3 py-1.5 text-xs font-semibold text-slate-950">Start goal</button></Form>}{goal.status === "failed" && <Form method="post"><input name="intent" type="hidden" value="retry" /><input name="goalId" type="hidden" value={goal.id} /><button className="rounded-lg border border-cyan-300/30 px-3 py-1.5 text-xs font-semibold text-cyan-100">Retry</button></Form>}</div>; }) : <div className="px-5 py-12 text-center text-sm text-slate-500">No goals yet. Create a project and durable goal through the Senderos CLI to begin.</div>}</div></section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><div className="flex items-center justify-between"><div><h2 className="font-medium text-white">Operational history</h2><p className="mt-1 text-xs text-slate-500">Recent attempts retain their execution context and outcome.</p></div></div><div className="mt-4 space-y-2">{data.attempts.slice(-6).reverse().map((attempt) => <div key={attempt.id} className="flex items-center gap-3 rounded-xl bg-slate-900/60 px-3 py-3"><Badge value={attempt.status} /><div className="min-w-0 flex-1"><p className="truncate text-sm text-slate-200">{attempt.executionObjective}</p><p className="mt-1 text-xs text-slate-500">{attempt.harness} · checkpoint: {attempt.checkpoint ?? "none"}</p></div><span className="text-xs text-slate-500">{relativeTime(attempt.heartbeatAt ?? attempt.updatedAt)}</span></div>)}</div></section>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-5"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Current execution</p>{activeAttempt ? <><h2 className="mt-3 text-lg font-semibold text-white">{activeGoal?.title ?? "Active attempt"}</h2><div className="mt-4 flex items-center justify-between"><Badge value={activeAttempt.status} /><span className="text-xs text-slate-400">{relativeTime(activeAttempt.heartbeatAt)}</span></div><dl className="mt-5 space-y-3 text-sm"><div><dt className="text-slate-500">Harness</dt><dd className="mt-1 text-slate-200">{activeAttempt.harness}</dd></div><div><dt className="text-slate-500">Checkpoint</dt><dd className="mt-1 text-slate-200">{activeAttempt.checkpoint ?? "Waiting for host signal"}</dd></div><div><dt className="text-slate-500">Working path</dt><dd className="mt-1 break-all text-xs text-slate-300">{activeAttempt.workingPath ?? "Not recorded"}</dd></div></dl>{!terminalStatuses.has(activeAttempt.status) && <Form method="post" className="mt-5"><input name="intent" type="hidden" value="stop" /><input name="runId" type="hidden" value={activeAttempt.runId} /><button className="w-full rounded-lg border border-rose-300/30 px-3 py-2 text-xs font-semibold text-rose-200">Stop execution</button></Form>}</> : <p className="mt-3 text-sm leading-6 text-slate-400">No active execution. Dispatchable work appears in the queue.</p>}</section>

            {activeAttempt && <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Evidence & review</p><div className="mt-4 space-y-2">{snapshot?.evidence?.length ? snapshot.evidence.map((item) => <div key={item.id} className="rounded-lg bg-slate-900/70 p-3 text-xs"><p className="font-medium text-slate-200">{item.label}</p><p className="mt-1 capitalize text-slate-500">{item.kind}</p></div>) : <p className="text-sm text-slate-500">No evidence recorded.</p>}</div><Form method="post" className="mt-4 space-y-2"><input name="intent" type="hidden" value="evidence" /><input name="attemptId" type="hidden" value={activeAttempt.id} /><input name="kind" type="hidden" value="manual" /><input required name="label" placeholder="Evidence label" className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600" /><input name="url" placeholder="Optional URL" className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600" /><button className="text-xs font-semibold text-cyan-200">Record evidence</button></Form><div className="mt-5 border-t border-white/10 pt-4"><p className="text-xs text-slate-400">{snapshot?.review ? `Review: ${snapshot.review.status}` : "No review decision recorded."}</p><Form method="post" className="mt-3 space-y-2"><input name="intent" type="hidden" value="review" /><input name="attemptId" type="hidden" value={activeAttempt.id} /><input name="reviewer" type="hidden" value="Studio operator" /><select name="status" className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white"><option value="approved">Approve evidence</option><option value="changes_requested">Request changes</option><option value="rejected">Reject</option></select><input name="rationale" placeholder="Decision rationale (optional)" className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600" /><button className="text-xs font-semibold text-cyan-200">Record decision</button></Form></div></section>}
          </aside>
        </div>
      </div>
    </main>
  );
}
