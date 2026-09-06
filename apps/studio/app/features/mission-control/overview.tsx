import { AttemptInspector } from "./components/attempt-inspector";
import { GoalList } from "./components/goal-list";
import { QueueMetrics } from "./components/queue-metrics";
import type { MissionControlData } from "./server";

export function MissionControlOverview({ data }: { data: MissionControlData }) {
  return (
    <>
      <section className="min-w-0 space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-cyan-300">
            Decision queue
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            What needs attention now.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Human attention is reserved for exceptions, proof, and consequential
            decisions.
          </p>
        </header>

        <QueueMetrics queue={data.queue} />
        <GoalList goals={data.goals} runs={data.runs} />
      </section>

      <AttemptInspector
        attempts={data.attempts}
        goals={data.goals}
        runs={data.runs}
      />
    </>
  );
}
