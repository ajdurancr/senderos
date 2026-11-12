import { capture, expect, ready, reload, runtime, scenarioScope, state, test, visit } from './fixtures';

for (const width of [1440, 390]) test(`browses complete scoped review history at ${width}px`, async ({ page, scenario }, testInfo) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  runtime('prepare-review-history', scenario.id);
  const before = state(), scope = scenarioScope(scenario);
  await visit(page, `/reviews${scope}`);
  const cards = page.locator('.review-grid article');
  await expect(cards).toHaveCount(30);
  await expect(page.getByText('30 on this page · 125 matching · 125 in this scope · newest attempts first')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pending review (32)' })).toBeVisible();
  await capture(page, testInfo, `review-history-latest-${width}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const firstIds = await cards.evaluateAll(elements => elements.map(element => element.getAttribute('data-attempt-id')));
  const older = page.getByRole('link', { name: 'Older reviews', exact: true });
  await older.focus(); await older.press('Enter'); await ready(page);
  await expect(page.getByRole('heading', { name: 'Review history', exact: true })).toBeFocused();
  const olderUrl = page.url();
  const secondIds = await cards.evaluateAll(elements => elements.map(element => element.getAttribute('data-attempt-id')));
  expect(secondIds.every(id => !firstIds.includes(id))).toBe(true);
  await reload(page); expect(await cards.evaluateAll(elements => elements.map(element => element.getAttribute('data-attempt-id')))).toEqual(secondIds);
  await page.goBack(); await ready(page); expect(await cards.evaluateAll(elements => elements.map(element => element.getAttribute('data-attempt-id')))).toEqual(firstIds);
  await page.goForward(); await ready(page); expect(page.url()).toBe(olderUrl);
  await page.getByRole('link', { name: 'Pending review (32)' }).click(); await ready(page);
  expect(new URL(page.url()).searchParams.has('reviewCursor')).toBe(false);
  await expect(page.getByText('30 on this page · 32 matching · 125 in this scope · newest attempts first')).toBeVisible();
  const selected = page.getByRole('navigation', { name: 'Review status filters' }).locator('a[aria-current="page"]');
  await expect(selected).toHaveText('Pending review (32)');
  await page.getByRole('link', { name: 'Older reviews', exact: true }).click(); await ready(page);
  await expect(cards).toHaveCount(2);
  await capture(page, testInfo, `review-history-pending-${width}`);
  await cards.first().getByRole('link', { name: 'Inspect evidence' }).click(); await ready(page);
  await expect(page.getByText('Archived proof 4', { exact: true })).toBeVisible();
  await visit(page, `/reviews${scope}`);
  const seen = new Set<string>();
  for (;;) {
    for (const id of await cards.evaluateAll(elements => elements.map(element => element.getAttribute('data-attempt-id')!))) { expect(seen.has(id)).toBe(false); seen.add(id); }
    if (!await page.getByRole('link', { name: 'Older reviews', exact: true }).count()) break;
    await page.getByRole('link', { name: 'Older reviews', exact: true }).click(); await ready(page);
  }
  expect(seen.size).toBe(125);
  const mismatch = new URL(olderUrl); mismatch.searchParams.set('project', scenario.campaignProject);
  await visit(page, mismatch.toString());
  await expect(page.getByRole('status')).toContainText('another scope or filter');
  await expect(page.getByRole('heading', { name: 'No evidence to review' })).toBeVisible();
  await visit(page, `/reviews${scope}&reviewStatus=invalid&reviewCursor=bad&reviewHistory=older`);
  await expect(page.getByText('This review filter is invalid. Showing all reviews.')).toBeVisible();
  await expect(cards).toHaveCount(30);
  await visit(page, `/reviews${scope}&reviewStatus=approved`);
  await expect(page.getByText('30 on this page · 31 matching · 125 in this scope · newest attempts first')).toBeVisible();
  await capture(page, testInfo, `review-history-approved-${width}`);
  expect(state()).toEqual(before);
});
