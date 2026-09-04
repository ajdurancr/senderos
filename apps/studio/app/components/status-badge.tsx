export function StatusBadge({ value }: { value: string }) {
  const tone = ["succeeded", "approved", "healthy"].includes(value)
    ? "bg-emerald-400/10 text-emerald-200 ring-emerald-400/25"
    : ["failed", "rejected", "blocked"].includes(value)
      ? "bg-rose-400/10 text-rose-200 ring-rose-400/25"
      : ["running", "executing", "active"].includes(value)
        ? "bg-cyan-400/10 text-cyan-100 ring-cyan-400/25"
        : "bg-slate-700/50 text-slate-300 ring-slate-600";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ${tone}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}
