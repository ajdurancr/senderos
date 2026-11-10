import { defineConfig, devices } from '@playwright/test';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';

// Never attach to a developer's live server or reuse an operator database.
const base = resolve(import.meta.dirname, '../../.tmp/test-runtime');
mkdirSync(base, { recursive: true });
const runtime = process.env.STUDIO_E2E_RUNTIME ?? mkdtempSync(join(base, 'studio-e2e-'));
process.env.STUDIO_E2E_RUNTIME = runtime;
const port = process.env.STUDIO_E2E_PORT ?? '4179';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.pw.ts',
  fullyParallel: false,
  workers: 1,
  // A rerun gets a new database; never hide a failure by retrying mutated state.
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  outputDir: './.tmp/studio-e2e/results',
  reporter: [['list'], ['html', { outputFolder: './.tmp/studio-e2e/report', open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 1000 },
    launchOptions: executablePath ? { executablePath } : {},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'bun e2e/serve.ts',
    url: `http://127.0.0.1:${port}/now`,
    timeout: 60_000,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { STUDIO_E2E_RUNTIME: runtime, STUDIO_E2E_PORT: port },
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
  },
});
