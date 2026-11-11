import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { capture, expect, goalAttempts, goalRuns, reload, runtime, scenarioScope, state, test, visit } from './fixtures';

test('recorded host recovery guides operators without mutating claims or launching replacement work', async ({ page, scenario }, testInfo) => {
  const scope = scenarioScope(scenario);
  const title = `Recovery inspection ${scenario.id.slice(0, 8)}`;
  await visit(page, `/projects/${scenario.launchProject}/goals/new${scope}`);
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
  await page.getByRole('combobox', { name: 'Sendero', exact: true }).selectOption(scenario.prerequisiteVersionId);
  await page.getByRole('button', { name: 'Create goal', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start goal', exact: true })).toBeVisible();
  const goal = state().goals.find(item => item.title === title)!;
  await page.getByRole('button', { name: 'Start goal', exact: true }).click();
  await page.getByRole('link', { name: 'Review ready activations' }).click();
  await page.getByRole('button', { name: 'Dispatch all' }).click();
  await expect.poll(() => goalAttempts(goal.id).length).toBe(1);
  const attempt = goalAttempts(goal.id)[0]!;
  runtime('host-claim', attempt.id); runtime('host-start', attempt.id);
  const path = `/projects/${scenario.launchProject}/runs/attempts/${attempt.id}${scope}`;
  for (const [outcome, heading] of [
    ['unknown', 'Keep recovery blocked'],
    ['missing', 'Independently confirm the process stopped'],
    ['active', 'Continue the existing session'],
  ]) {
    runtime(`host-reconcile-${outcome}`, attempt.id);
    const before = state();
    await visit(page, path);
    const guidance = page.getByRole('region', { name: 'Recovery next step' });
    await expect(guidance.getByRole('heading', { name: heading })).toBeVisible();
    await expect(guidance.getByRole('button')).toHaveCount(0);
    await page.getByText('Host and session records', { exact: true }).click();
    await expect(page.getByText(`Recovery observation: Deterministic fixture inspection: ${outcome}`, { exact: true })).toBeVisible();
    await reload(page);
    await expect(guidance.getByRole('heading', { name: heading })).toBeVisible();
    expect(state().claims).toEqual(before.claims);
    expect(state().attempts).toEqual(before.attempts);
    expect(goalRuns(goal.id)).toHaveLength(1);
  }
  const guidance = page.getByRole('region', { name: 'Recovery next step' });
  await guidance.scrollIntoViewIfNeeded();
  await capture(page, testInfo, 'recovery-active-desktop-1440x1000');
  await page.setViewportSize({ width: 390, height: 844 });
  await guidance.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture(page, testInfo, 'recovery-active-mobile-390x844');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await visit(page, `/projects/${scenario.launchProject}/canvas/goals/${goal.id}${scope}`);
  await page.getByRole('button', { name: 'Request stop', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm stop', exact: true }).click();
  await expect.poll(() => state().claims.find(item => item.attemptId === attempt.id)?.cancellationRequestedAt).toBeTruthy();
  await visit(page, path);
  await expect(guidance.getByRole('heading', { name: 'Wait for host acknowledgement' })).toBeVisible();
  expect(goalAttempts(goal.id)[0]!.status).toBe('running');
  runtime('host-cancel', attempt.id);
  await reload(page);
  await expect(guidance.getByRole('heading', { name: 'Attempt settled' })).toBeVisible();
  await expect(guidance).toContainText('retained history');
  expect(goalAttempts(goal.id)[0]!.status).toBe('canceled');
  expect(state().claims.find(item => item.attemptId === attempt.id)?.recoveryOutcome).toBe('active');
  expect(goalRuns(goal.id)).toHaveLength(1);
});

test('an old snapshot is identified and explicit refresh updates recovery without changing persisted work', async ({ page, scenario }, testInfo) => {
  await page.clock.install();
  const scope = scenarioScope(scenario);
  const title = `Snapshot freshness ${scenario.id.slice(0, 8)}`;
  await visit(page, `/projects/${scenario.launchProject}/goals/new${scope}`);
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
  await page.getByRole('combobox', { name: 'Sendero', exact: true }).selectOption(scenario.prerequisiteVersionId);
  await page.getByRole('button', { name: 'Create goal', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start goal', exact: true })).toBeVisible();
  const goal = state().goals.find(item => item.title === title)!;
  await page.getByRole('button', { name: 'Start goal', exact: true }).click();
  await page.getByRole('link', { name: 'Review ready activations' }).click();
  await page.getByRole('button', { name: 'Dispatch all' }).click();
  await expect.poll(() => goalAttempts(goal.id).length).toBe(1);
  const attempt = goalAttempts(goal.id)[0]!;
  runtime('host-claim', attempt.id); runtime('host-start', attempt.id); runtime('host-reconcile-active', attempt.id);
  await visit(page, `/projects/${scenario.launchProject}/runs/attempts/${attempt.id}${scope}`);
  const guidance = page.getByRole('region', { name: 'Recovery next step' });
  await expect(guidance.getByRole('heading', { name: 'Continue the existing session', exact: true })).toBeVisible();
  runtime('expire-fixture-lease', attempt.id);
  const beforeRefresh = state();
  await page.clock.fastForward(75_000);
  const freshness = page.getByRole('region', { name: 'Snapshot freshness' });
  await expect(freshness).toContainText('Status may have changed.');
  await expect(guidance.getByRole('heading', { name: 'Continue the existing session', exact: true })).toBeVisible();
  await capture(page, testInfo, 'snapshot-stale-desktop-1440x1000');
  await page.setViewportSize({ width: 390, height: 844 });
  await freshness.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture(page, testInfo, 'snapshot-stale-mobile-390x844');
  await page.clock.resume();
  // Restore the browser clock to wall time before comparing a fresh server snapshot.
  await page.clock.setFixedTime(new Date());
  const refresh = page.getByRole('button', { name: 'Refresh status', exact: true });
  await refresh.focus(); await page.keyboard.press('Enter');
  await expect(guidance.getByRole('heading', { name: 'Reclaim ownership and continue the existing session', exact: true })).toBeVisible();
  await expect(freshness).not.toContainText('Status may have changed.');
  await expect(refresh).toBeFocused();
  await guidance.scrollIntoViewIfNeeded();
  await capture(page, testInfo, 'snapshot-refreshed-mobile-390x844');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await guidance.scrollIntoViewIfNeeded();
  await capture(page, testInfo, 'snapshot-refreshed-desktop-1440x1000');
  await expect(page.getByRole('button', { name: /reclaim|restart|launch/i })).toHaveCount(0);
  const afterRefresh = state();
  expect(afterRefresh.claims).toEqual(beforeRefresh.claims);
  expect(afterRefresh.attempts).toEqual(beforeRefresh.attempts);
  expect(afterRefresh.runs).toEqual(beforeRefresh.runs);
  expect(afterRefresh.eventCount).toEqual(beforeRefresh.eventCount);
  // Refreshing the route must also preserve inputs in a real mounted editor.
  await visit(page, `/agents/new${scope}`);
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Retained unsaved host notes');
  const previousTime = await freshness.locator('time').getAttribute('datetime');
  await page.route('**/resources/snapshot?**', route => route.abort('failed'));
  await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
  await expect(freshness.getByRole('alert')).toContainText('previous snapshot and your edits are kept');
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Retained unsaved host notes');
  expect(await freshness.locator('time').getAttribute('datetime')).toBe(previousTime);
  await capture(page, testInfo, 'snapshot-refresh-error-desktop-1440x1000');
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, testInfo, 'snapshot-refresh-error-mobile-390x844');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.unroute('**/resources/snapshot?**');
  await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
  await expect(freshness.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Retained unsaved host notes');
  expect(state().agents).toEqual(afterRefresh.agents);
});


test('production snapshots survive brief isolated SQLite contention on desktop and mobile', async ({ page, scenario }, testInfo) => {
  const scope = scenarioScope(scenario);
  await visit(page, `/agents${scope}`);
  const before = state();
  for (const [width, height, label] of [[1440, 1000, 'desktop'], [390, 844, 'mobile']] as const) {
    await page.setViewportSize({ width, height });
    const worker = spawn(process.env.BUN_EXECUTABLE ?? 'bun', [fileURLToPath(new URL('./runtime.ts', import.meta.url)), 'hold-read-lock'], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    worker.stdout.on('data', chunk => { stdout += String(chunk); });
    worker.stderr.on('data', chunk => { stderr += String(chunk); });
    const exited = new Promise<void>((resolve, reject) => {
      worker.once('error', reject);
      worker.once('close', code => code === 0 ? resolve() : reject(new Error(`Fixture lock worker exited ${code}: ${stderr}`)));
    });
    // Observe early rejection while readiness is pending; still await and fail below.
    void exited.catch(() => {});
    try {
      await new Promise<void>((resolve, reject) => {
        worker.stdout.on('data', () => { if (stdout.includes('isolated-read-lock-acquired')) resolve(); });
        worker.once('error', reject);
        worker.once('close', code => reject(new Error(`Fixture lock failed before readiness (exit ${code}): ${stderr}`)));
      });
      // Exercise the mounted UI's real fetch while another process owns the DB.
      const responseReady = page.waitForResponse(response => new URL(response.url()).pathname === '/resources/snapshot');
      await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
      const response = await responseReady;
      expect(response.status()).toBe(200);
      expect((await response.json()).ok).toBe(true);
      await expect(page.getByRole('button', { name: 'Refresh status', exact: true })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Snapshot freshness' })).not.toContainText('Status could not be refreshed');
    } finally {
      try { await exited; }
      finally {
        await testInfo.attach(`snapshot-lock-worker-${label}`, {
          body: JSON.stringify({ stdout, stderr, exitCode: worker.exitCode, signalCode: worker.signalCode }),
          contentType: 'application/json',
        });
      }
    }
    await reload(page);
    const freshness = page.getByRole('region', { name: 'Snapshot freshness' });
    await expect(freshness).toContainText('Snapshot loaded');
    await freshness.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await capture(page, testInfo, `snapshot-contention-${label}-${width}x${height}`);
  }
  const after = state();
  expect(after).toEqual(before);
});
