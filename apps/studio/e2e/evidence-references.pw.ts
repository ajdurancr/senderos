import { capture, expect, ready, runtime, scenarioScope, state, test, visit } from './fixtures';

test('retains inert artifact references in inspection and run history after reload', async ({ page, scenario }, testInfo) => {
  const fixture = runtime('prepare-evidence-references', scenario.id) as { goalId: string; attemptId: string; references: string[] };
  const before = state(), scope = scenarioScope(scenario);
  await visit(page, `/projects/${scenario.launchProject}/canvas/goals/${fixture.goalId}/attempts/${fixture.attemptId}${scope}`);
  const inspector = page.locator('.context-inspector');
  for (const reference of fixture.references) await expect(inspector.getByText(reference, { exact: true })).toBeVisible();
  await expect(inspector.locator('.evidence-list a')).toHaveCount(0);
  await page.reload(); await ready(page);
  for (const reference of fixture.references) await expect(inspector.getByText(reference, { exact: true })).toBeVisible();
  await inspector.getByText(fixture.references[0]!, { exact: true }).scrollIntoViewIfNeeded();
  await capture(page, testInfo, 'retained-evidence-desktop-1440x1000');
  await page.setViewportSize({ width: 390, height: 844 });
  await inspector.getByText(fixture.references[0]!, { exact: true }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture(page, testInfo, 'retained-evidence-mobile-390x844');
  await visit(page, `/runs${scope}`);
  for (const reference of fixture.references) await expect(page.getByText(reference, { exact: true })).toBeVisible();
  await page.reload(); await ready(page);
  for (const reference of fixture.references) await expect(page.getByText(reference, { exact: true })).toBeVisible();
  expect(state()).toEqual(before);
});
