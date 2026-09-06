export function StudioLayout({
  children,
  pending,
}: {
  children: React.ReactNode;
  pending: boolean;
}) {
  return (
    <main className="min-h-screen bg-[#07111f] text-slate-100">
      <div className="mx-auto max-w-[1600px] px-5 py-5 lg:px-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-300 to-cyan-300 font-black text-slate-950">
              S
            </div>
            <div>
              <p className="font-semibold text-white">Senderos Studio</p>
              <p className="text-xs text-slate-400">Mission Control</p>
            </div>
          </div>
          <div className="text-xs text-slate-400">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-300" />
            Runtime connected {pending ? "· Updating" : ""}
          </div>
        </header>
        <div className="grid gap-6 py-7 xl:grid-cols-[210px_minmax(0,1fr)_310px]">
          <aside className="hidden xl:block">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-[.16em] text-slate-500">
              Workspace
            </p>
            <nav className="mt-3 space-y-1">
              {[
                "Now",
                "Goals",
                "Runs",
                "Reviews",
                "Agents",
                "Projects",
                "Operations",
              ].map((item, index) => (
                <span
                  className={`block rounded-lg px-3 py-2 text-sm ${index === 0 ? "bg-cyan-300/10 font-medium text-cyan-100" : "text-slate-400"}`}
                  key={item}
                >
                  {item}
                </span>
              ))}
            </nav>
          </aside>
          {children}
        </div>
      </div>
    </main>
  );
}
