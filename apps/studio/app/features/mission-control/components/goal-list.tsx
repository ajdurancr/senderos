import { Form } from "react-router";
import { StatusBadge } from "../../../components/status-badge";
import type { MissionControlData } from "../server";

type Props = Pick<MissionControlData, "goals" | "runs">;

export function GoalList({ goals, runs }: Props) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <h2 className="font-medium text-white">Goals</h2>
          <p className="mt-1 text-xs text-slate-500">
            Outcomes, not disconnected tickets.
          </p>
        </div>
        <span className="text-xs text-slate-500">{goals.length} total</span>
      </header>
      <div className="divide-y divide-white/5">
        {goals.map((goal) => {
          const run = runs.find((item) => item.goal_id === goal.id);
          const intent =
            goal.status === "draft"
              ? "start"
              : goal.status === "failed"
                ? "retry"
                : null;
          return (
            <div
              className="flex flex-wrap items-center gap-3 px-5 py-4"
              key={goal.id}
            >
              <div className="min-w-[220px] flex-1">
                <p className="font-medium text-slate-100">{goal.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {goal.kind} · {goal.baseTargetBranch}
                </p>
              </div>
              <StatusBadge value={goal.status} />
              {run && (
                <span className="text-xs text-slate-400">
                  Run: {run.status}
                </span>
              )}
              {intent && (
                <Form method="post">
                  <input name="intent" type="hidden" value={intent} />
                  <input name="goalId" type="hidden" value={goal.id} />
                  <button className="rounded-lg bg-cyan-300 px-3 py-1.5 text-xs font-semibold text-slate-950">
                    {intent === "start" ? "Start goal" : "Retry"}
                  </button>
                </Form>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
