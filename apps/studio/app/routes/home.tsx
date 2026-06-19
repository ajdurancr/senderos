const pillars = [
  {
    title: "Objectives over tasks",
    body: "Work starts from outcomes, not disconnected tickets.",
  },
  {
    title: "Validation over generation",
    body: "Generated output only matters when it can be verified.",
  },
  {
    title: "Context over prompts",
    body: "Execution quality depends on delivering the right context at the right time.",
  },
  {
    title: "Humans remain accountable",
    body: "Automation accelerates work, but ownership stays human.",
  },
];

export function meta() {
  return [
    { title: "Senderos Studio" },
    {
      name: "description",
      content:
        "Senderos Studio is the cockpit for objectives, execution, validation, and orchestration.",
    },
  ];
}

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-16">
        <div className="space-y-6">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">Senderos Studio</p>
          <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-6xl">
            Orchestrate the path from intent to verified software outcomes.
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-slate-300">
            Senderos Studio is the product workspace for defining objectives, inspecting execution,
            reviewing validation, and coordinating humans, AI systems, and engineering tools.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {pillars.map((pillar) => (
            <article key={pillar.title} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-black/20">
              <h2 className="text-xl font-medium text-white">{pillar.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{pillar.body}</p>
            </article>
          ))}
        </div>

        <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-8">
          <p className="text-sm uppercase tracking-[0.25em] text-emerald-300">Operating model</p>
          <p className="mt-4 text-2xl font-medium text-white">
            Intent → Planning → Context → Execution → Validation → Feedback → Continuous Improvement
          </p>
        </div>
      </section>
    </main>
  );
}
