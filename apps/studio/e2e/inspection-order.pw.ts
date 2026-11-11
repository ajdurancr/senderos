import { capture, expect, ready, runtime, scenarioScope, state, test, visit } from './fixtures';

test('inspects tied run history deterministically without losing exact older attempt selection', async ({ page, scenario }, testInfo) => {
  const fixture = runtime('prepare-tied-run-history', scenario.id) as { goalId: string; latestAttemptId: string; olderAttemptId: string };
  const before = state(), scope = scenarioScope(scenario);
  const goalPath = `/projects/${scenario.launchProject}/canvas/goals/${fixture.goalId}${scope}`;
  await visit(page, goalPath);
  const inspector = page.locator('.context-inspector');
  await expect(inspector.getByText('Latest retained objective 2', { exact: true })).toBeVisible();
  await page.reload(); await ready(page);
  await expect(inspector.getByText('Latest retained objective 2', { exact: true })).toBeVisible();
  await capture(page, testInfo, 'tied-inspection-desktop-1440x1000');
  await page.setViewportSize({ width: 390, height: 844 });
  await inspector.getByText('Latest retained objective 2', { exact: true }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture(page, testInfo, 'tied-inspection-mobile-390x844');
  await visit(page, `/projects/${scenario.launchProject}/canvas/goals/${fixture.goalId}/attempts/${fixture.olderAttemptId}${scope}`);
  await expect(inspector.getByText('Earlier retained objective 1', { exact: true })).toBeVisible();
  await page.reload(); await ready(page);
  await expect(inspector.getByText('Earlier retained objective 1', { exact: true })).toBeVisible();
  expect(state()).toEqual(before);
});
