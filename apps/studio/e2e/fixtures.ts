import { test as base, expect, type Page, type TestInfo } from '@playwright/test';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type * as schema from '../../../packages/core/src/db/schema';

export type Scenario = { id: string; productContext: string; researchContext: string; launchProject: string; campaignProject: string; researchProject: string; prerequisiteVersionId: string };
export const scenarioScope = (scenario: Scenario) => `?context=${scenario.productContext}&project=${scenario.launchProject}`;
export type State = {
  projects: (typeof schema.projects.$inferSelect)[];
  agents: (typeof schema.agents.$inferSelect)[];
  senderos: (typeof schema.senderos.$inferSelect)[];
  versions: (typeof schema.senderoVersions.$inferSelect)[];
  nodes: (typeof schema.senderoNodes.$inferSelect)[];
  edges: (typeof schema.senderoEdges.$inferSelect)[];
  goals: (typeof schema.goals.$inferSelect)[];
  activations: (typeof schema.activations.$inferSelect)[];
  runs: (typeof schema.runs.$inferSelect)[];
  attempts: (typeof schema.runAttempts.$inferSelect)[];
  claims: Omit<typeof schema.attemptClaims.$inferSelect, 'token'>[];
};
export function runtime(command: string, id?: string): unknown {
  const value = execFileSync(process.env.BUN_EXECUTABLE ?? 'bun', [fileURLToPath(new URL('./runtime.ts', import.meta.url)), command, ...(id ? [id] : [])], { env: process.env, encoding: 'utf8', timeout: 20_000 });
  return JSON.parse(value);
}
export const state = () => runtime('snapshot') as State;
export async function ready(page: Page) {
  await expect(page.locator('.studio-shell')).toHaveAttribute('data-client-ready', 'true');
  await expect(page.getByRole('combobox', { name: 'Execution context', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Search or run a command' })).toBeEnabled();
}
export async function visit(page: Page, path: string) { await page.goto(path); await ready(page); }
export async function reload(page: Page) { await page.reload(); await ready(page); }
export function goalRuns(goalId: string) { return state().runs.filter(run => run.goalId === goalId); }
export function goalAttempts(goalId: string) {
  const data = state(); const ids = new Set(data.runs.filter(run => run.goalId === goalId).map(run => run.id));
  return data.attempts.filter(attempt => ids.has(attempt.runId));
}
export const test = base.extend<{ cleanBrowser: void; scenario: Scenario }>({
  scenario: async ({}, use) => { await use(runtime('prepare-test', crypto.randomUUID()) as Scenario); },
  cleanBrowser: [async ({ context }, use, testInfo) => {
    const errors: string[] = [];
    const failedResponses: string[] = [];
    const consoleErrors: string[] = [];
    context.on('page', page => {
      page.on('response', response => { if (response.status() >= 500) failedResponses.push(`${response.status()} ${response.url()}`); });
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); if (/hydrat|server rendered|did not match/i.test(message.text())) errors.push(message.text()); });
    });
    await use();
    await testInfo.attach('persisted-database-state', { body: JSON.stringify(state(), null, 2), contentType: 'application/json' });
    await testInfo.attach('browser-diagnostics', { body: JSON.stringify({ errors, failedResponses, consoleErrors }, null, 2), contentType: 'application/json' });
    expect(failedResponses, 'No failed production-server responses').toEqual([]);
    expect(errors, 'No uncaught browser exceptions or hydration mismatch').toEqual([]);
  }, { auto: true }],
});
export { expect };

export async function capture(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: false, animations: 'disabled' });
  await testInfo.attach(name, { path, contentType: 'image/png' });
  if (process.env.STUDIO_E2E_SCREENSHOTS) {
    mkdirSync(process.env.STUDIO_E2E_SCREENSHOTS, { recursive: true });
    copyFileSync(path, join(process.env.STUDIO_E2E_SCREENSHOTS, `${name}.png`));
  }
}
