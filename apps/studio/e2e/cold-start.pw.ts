import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer, type AddressInfo } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { capture, expect, ready, scenarioScope, state, test } from './fixtures';

async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  const timeout = setTimeout(() => child.kill('SIGKILL'), 5000);
  child.kill('SIGTERM');
  try { await exited; } finally { clearTimeout(timeout); }
}

// A TCP-ready server has not handled an HTTP request: preparation is still cold.
// Each viewport gets its own production Node process, with the fixture database
// shared only for this test's before/after persistence assertions.
test('cold production preparation survives a brief database lock on desktop and mobile', async ({ page, scenario }, testInfo) => {
  const before = state();
  const servePackage = fileURLToPath(import.meta.resolve('@react-router/serve/package.json'));
  for (const [width, height, label] of [[1440, 1000, 'desktop'], [390, 844, 'mobile']] as const) {
    await page.setViewportSize({ width, height });
    const probe = createServer();
    probe.listen(0, '127.0.0.1');
    await once(probe, 'listening');
    const port = (probe.address() as AddressInfo).port;
    await new Promise<void>((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port), SENDEROS_DATABASE_URL: `file:${join(process.env.STUDIO_E2E_RUNTIME!, 'senderos.db')}` };
    delete env.SENDEROS_DATABASE_AUTH_TOKEN;
    delete env.NODE_PATH;
    const server = spawn('node', [join(dirname(servePackage), 'bin.cjs'), './build/server/index.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    server.stdout.on('data', chunk => { output += chunk; });
    server.stderr.on('data', chunk => { output += chunk; });
    let worker: ChildProcess | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        server.stdout.on('data', chunk => { if (String(chunk).includes('[react-router-serve]')) resolve(); });
        server.once('error', reject);
        server.once('exit', code => reject(new Error(`Cold fixture server exited ${code}: ${output}`)));
      });
      worker = spawn(process.env.BUN_EXECUTABLE ?? 'bun', [fileURLToPath(new URL('./runtime.ts', import.meta.url)), 'hold-read-lock'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
      const lockWorker = worker;
      const exited = new Promise<number | null>((resolve, reject) => { lockWorker.once('exit', resolve); lockWorker.once('error', reject); });
      await new Promise<void>((resolve, reject) => {
        lockWorker.stdout!.once('data', chunk => String(chunk).includes('isolated-read-lock-acquired') ? resolve() : reject(new Error('Cold lock readiness missing')));
        lockWorker.once('error', reject);
        lockWorker.once('exit', code => { if (code !== 0) reject(new Error(`Cold lock worker exited ${code}`)); });
      });
      const response = await page.goto(`http://127.0.0.1:${port}/agents${scenarioScope(scenario)}`);
      expect(response?.status()).toBe(200);
      await ready(page);
      expect(await exited).toBe(0);
      await expect(page.getByRole('region', { name: 'Snapshot freshness' })).toContainText('Snapshot loaded');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await capture(page, testInfo, `cold-preparation-${label}-${width}x${height}`);
      await page.reload();
      await ready(page);
    } finally {
      if (worker) await stop(worker);
      await stop(server);
      await testInfo.attach(`cold-server-${label}`, { body: output, contentType: 'text/plain' });
    }
    expect(state()).toEqual(before);
  }
});
