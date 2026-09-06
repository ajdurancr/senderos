import type { MissionControlData } from "../server";

export function QueueMetrics({
  queue,
}: {
  queue: MissionControlData["queue"];
}) {
  const cards = [
    {
      label: "Needs review",
      value: queue.reviews.length,
      body: "Evidence awaiting a decision",
    },
    {
      label: "Dispatchable",
      value: queue.dispatchable.length,
      body: "Ready to hand to a host",
    },
    {
      label: "Exceptions",
      value: queue.failedAttempts.length + queue.blockedGoals.length,
      body: "Failures and blocked goals",
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <article
          className="rounded-2xl border border-white/10 bg-white/[.035] p-4"
          key={card.label}
        >
          <p className="text-sm text-slate-400">{card.label}</p>
          <p className="mt-2 text-3xl font-semibold text-white">{card.value}</p>
          <p className="mt-1 text-xs text-slate-500">{card.body}</p>
        </article>
      ))}
    </section>
  );
}
