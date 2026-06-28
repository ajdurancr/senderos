export function parseArgs(argv: string[]) {
  const positionals: string[] = [];
  const options: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) options[key] = true;
      else { options[key] = next; i++; }
    } else positionals.push(arg);
  }
  return { positionals, options };
}
