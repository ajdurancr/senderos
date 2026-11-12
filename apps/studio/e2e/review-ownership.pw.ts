import { capture, expect, ready, reload, runtime, state, test, visit } from './fixtures';

for (const width of [1440, 390]) test(`identifies review ownership across contexts at ${width}px`, async ({ page, scenario }, testInfo) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  const secondId = crypto.randomUUID();
  runtime('prepare-test', secondId);
  runtime('prepare-review-history', scenario.id);
  runtime('prepare-review-history', secondId);
  const before = state();
  await visit(page, '/reviews');
  const card = page.locator(`article[data-attempt-id="attempt-history-${secondId}-124"]`);
  await expect(card).toBeVisible();
  await expect(card.getByRole('heading')).toHaveText('Archived fixture 124');
  await expect(card.getByRole('link', { name: 'Inspect evidence' })).toHaveAttribute('href', `/projects/launch-${secondId}/runs/attempts/attempt-history-${secondId}-124`);
  const inspect = card.getByRole('link', { name: 'Inspect evidence' });
  await inspect.focus(); await inspect.press('Enter'); await ready(page);
  await expect(page.getByText('Archived proof 124', { exact: true })).toBeVisible();
  await page.goBack(); await ready(page);
  await capture(page, testInfo, `review-ownership-${width}`);
  expect(state()).toEqual(before);
  // All-context cards need attribution before opening a similarly named attempt.
  await expect(card).toContainText(`Product team ${secondId.slice(0, 8)}`);
  await expect(card).toContainText('Website launch');
  await expect(card.locator('.review-ownership')).toContainText(`Goal: Archived executions ${secondId}`);
  await reload(page);
  await expect(card.locator('.review-ownership')).toContainText(`Product team ${secondId.slice(0, 8)}`);
  await visit(page, `/reviews?context=product-${secondId}&project=launch-${secondId}`);
  await expect(card.locator('.review-ownership')).toContainText(`Product team ${secondId.slice(0, 8)}`);
  await card.scrollIntoViewIfNeeded();
  await capture(page, testInfo, `review-ownership-scoped-${width}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await card.getByRole('link', { name: 'Inspect evidence' }).click(); await ready(page);
  await expect(page.getByText('Archived proof 124', { exact: true })).toBeVisible();
  expect(state()).toEqual(before);
});
