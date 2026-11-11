import { capture, expect, ready, scenarioScope, state, test, visit } from './fixtures';

test('repeated concurrent snapshots retain complete scoped results and remain usable on desktop and mobile', async ({ page, scenario }, testInfo) => {
  await visit(page, `/goals${scenarioScope(scenario)}`);
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
