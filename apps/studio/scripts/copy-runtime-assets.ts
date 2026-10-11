import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Bundled Core resolves runtime resources beside the server entry point.
const root = new URL('../../../', import.meta.url);
const destination = new URL('../build/server/', import.meta.url);
await mkdir(destination, { recursive: true });
for (const [source, target] of [
  ['packages/core/drizzle/', 'drizzle/'],
  ['packages/core/src/bootstrap/agents/', 'agents/'],
  ['packages/core/src/bootstrap/senderos/', 'senderos/'],
]) {
  await cp(fileURLToPath(new URL(source, root)), fileURLToPath(new URL(target, destination)), { recursive: true });
}
console.log('Packaged Studio migrations and built-in agent/Sendero definitions.');
