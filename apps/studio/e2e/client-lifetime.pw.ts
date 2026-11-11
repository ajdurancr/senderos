import { capture, expect, goalAttempts, ready, runtime, scenarioScope, state, test, visit } from './fixtures';

test('repeated concurrent snapshots retain complete scoped results and remain usable on desktop and mobile', async ({ page, scenario }, testInfo) => {
  const scope = scenarioScope(scenario);
  const title = `Snapshot lifetime ${scenario.id.slice(0, 8)}`;
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
  runtime('host-claim', attempt.id);
  runtime('host-start', attempt.id);
  runtime('host-reconcile-active', attempt.id);
  await visit(page, `/goals${scope}`);
  const before = state();
  for (const [width, height, label] of [[1440, 1000, 'desktop'], [390, 844, 'mobile']] as const) {
    await page.setViewportSize({ width, height });
    const snapshots = await Promise.all(Array.from({ length: 6 }, async () => {
      const response = await page.request.get(`/resources/snapshot${scenarioScope(scenario)}&_pathname=/goals`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.asOf).toEqual(expect.any(Number));
      return { ...body.data, asOf: 0 };
    }));
    for (const snapshot of snapshots) expect(snapshot).toEqual(snapshots[0]);
    const refreshed = page.waitForResponse(response => new URL(response.url()).pathname === '/resources/snapshot');
    await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
    expect((await refreshed).status()).toBe(200);
    await expect(page.getByRole('region', { name: 'Snapshot freshness' })).toContainText('Snapshot loaded');
    await page.reload();
    await ready(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await capture(page, testInfo, `snapshot-session-${label}-${width}x${height}`);
    expect(state()).toEqual(before);
  }
});
