import { existsSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { randomId } from '../../shared/ids';

function packageNameForPath(canonicalPath: string) {
  const path = join(resolve(canonicalPath), 'package.json');
  if (!existsSync(path)) return null;
  try {
    return (
      (JSON.parse(readFileSync(path, 'utf8')) as { name?: string }).name ?? null
    );
    /* c8 ignore next 2 -- exercised branch is not attributed by Bun's coverage output. */
  } catch {
    return null;
  }
}
function safeProjectPrefix(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/^@/, '')
      .replace(/[\\/]/g, '-')
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'project'
  );
}
export function defaultProjectIdForPath(canonicalPath: string) {
  return `${safeProjectPrefix(packageNameForPath(canonicalPath) ?? basename(resolve(canonicalPath)))}-${randomId('tmp').slice(4)}`;
}
