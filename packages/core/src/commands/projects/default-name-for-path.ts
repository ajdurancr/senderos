import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

export function defaultProjectNameForPath(canonicalPath: string) {
  const path = join(resolve(canonicalPath), "package.json");
  if (existsSync(path))
    try {
      const name = (JSON.parse(readFileSync(path, "utf8")) as { name?: string })
        .name;
      if (name) return name;
    } catch {
      /* use directory name */
    }
  return basename(resolve(canonicalPath));
}
