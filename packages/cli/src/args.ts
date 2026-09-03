export type CliOptionValue = string | boolean | string[];

export function parseArgs(argv: string[]) {
  const positionals: string[] = [];
  const options: Record<string, CliOptionValue> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      const value: CliOptionValue = !next || next.startsWith('--') ? true : next;
      if (value !== true) {
        i++;
      }

      const current = options[key];
      if (current === undefined) {
        options[key] = value;
      } else if (Array.isArray(current)) {
        options[key] = [...current, String(value)];
      } else {
        options[key] = [String(current), String(value)];
      }
    } else {
      positionals.push(arg);
    }
  }

  return { positionals, options };
}
