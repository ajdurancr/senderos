import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createServer, type AddressInfo } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const studio = fileURLToPath(new URL('../', import.meta.url));
const runtimeBase = resolve(studio, '../../.tmp/test-runtime');
await mkdir(runtimeBase, { recursive: true });
const runtime = await mkdtemp(join(runtimeBase, 'studio-production-'));
const portProbe = createServer();
portProbe.listen(0, '127.0.0.1');
await once(portProbe, 'listening');
const port = (portProbe.address() as AddressInfo).port;
await new Promise<void>((done, reject) => portProbe.close((error) => error ? reject(error) : done()));
const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port), SENDEROS_DATABASE_URL: `file:${join(runtime, 'senderos.db')}` };
// Prove normal Node package resolution; never reuse an operator database/token.
delete env.NODE_PATH;
delete env.SENDEROS_DATABASE_AUTH_TOKEN;
const servePackage = fileURLToPath(import.meta.resolve('@react-router/serve/package.json'));
const child = spawn('node', [join(dirname(servePackage), 'bin.cjs'), './build/server/index.js'], { cwd: studio, env, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
child.stdout.on('data', (chunk) => { output += chunk; });
child.stderr.on('data', (chunk) => { output += chunk; });
let spawnError: Error | undefined;
child.on('error', (error) => { spawnError = error; });
const base = `http://127.0.0.1:${port}`;
let pages = 0;
const checkedAssets = new Set<string>();
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error(`Production server exited ${child.exitCode}.`);
    try { await fetch(`${base}/`, { signal: AbortSignal.timeout(1000) }); ready = true; break; } catch { await delay(100); }
  }
  assert.ok(ready, 'Production server must start within 10 seconds.');
  for (const [path, expected] of [
    ['/', 'Workflow progress'], ['/now', 'What needs attention now'],
    ['/goals', 'Outcome inventory'], ['/runs', 'Execution history'],
    ['/reviews', 'Evidence reviews'], ['/agents', 'Execution topology'],
    ['/agents/new', 'Create agent'], ['/senderos/new', 'Create draft'],
    ['/events', 'Append-only history'], ['/settings', 'Project &amp; database'],
    ['/senderos/sendero-software-delivery', 'Verified software delivery'],
    ['/senderos/sendero-timed-wait-demo', 'Timed wait'],
  ]) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200, `${path} must render successfully.`);
    const html = await response.text();
    assert.ok(html.includes(expected), `${path} must include ${expected}.`);
    for (const asset of new Set([...html.matchAll(/(?:href|src)="(\/assets\/[^"?]+)(?:\?[^\"]*)?"/g)].map((match) => match[1]))) {
      if (checkedAssets.has(asset)) continue;
      const resource = await fetch(`${base}${asset}`);
      assert.equal(resource.status, 200, `${asset} must be shipped.`);
      assert.match(resource.headers.get('content-type') ?? '', asset.endsWith('.css') ? /text\/css/ : /javascript/, `${asset} must be an asset, not an HTML fallback.`);
      assert.ok((await resource.text()).length > 0, `${asset} must not be empty.`);
      checkedAssets.add(asset);
    }
    pages += 1;
  }
  assert.ok(checkedAssets.size >= 2, "SSR must reference emitted styles and scripts.");
  const creations: Array<[string, Record<string, string>, string, string]> = [
    ['/agents/new', { intent: 'create-agent', name: 'Production smoke agent', slug: 'production-smoke-agent', instructions: 'Verify the packaged server.', status: 'active' }, '/agents/', 'Production smoke agent'],
    ['/senderos/new', { intent: 'create-sendero', name: 'Production smoke graph', slug: 'production-smoke-graph', description: 'Fresh database authoring smoke.' }, '/senderos/', 'Production smoke graph'],
  ];
  for (const [path, fields, prefix, content] of creations) {
    const response = await fetch(`${base}${path}`, { method: 'POST', body: new URLSearchParams(fields), redirect: 'manual' });
    assert.equal(response.status, 302, `${path} must create and redirect.`);
    const destination = response.headers.get('location');
    assert.ok(destination?.startsWith(prefix), 'Created entity must have a durable URL.');
    const saved = await fetch(`${base}${destination}`);
    assert.equal(saved.status, 200);
    assert.ok((await saved.text()).includes(content), 'Created entity must survive the redirect.');
  }
  console.log(`Studio production smoke passed: ${pages} SSR routes, ${checkedAssets.size} emitted assets, fresh native database migrations/seeds, agent and Sendero creation. No NODE_PATH override.`);
} catch (error) {
  console.error(output);
  throw error;
} finally {
  child.kill('SIGTERM');
  await Promise.race([once(child, 'exit').catch(() => {}), delay(5000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
  await rm(runtime, { recursive: true, force: true });
}
