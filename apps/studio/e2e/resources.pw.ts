import { capture, expect, test, visit } from './fixtures';

test('browser icons are image resources and retain scoped desktop and mobile navigation', async ({ page, request, scenario }, testInfo) => {
  const legacy = await request.get('/favicon.ico', { maxRedirects: 0 });
  expect(legacy.status()).toBe(302);
  expect(legacy.headers().location).toBe('/favicon.svg');
  const icon = await request.get('/favicon.svg');
  expect(icon.status()).toBe(200);
  expect(icon.headers()['content-type']).toContain('image/svg+xml');
  expect(await icon.text()).toContain('<svg');
  const path = `/now?context=${scenario.productContext}&project=${scenario.launchProject}`;
  await visit(page, path);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg');
  await capture(page, testInfo, 'icon-resource-desktop-1440x1000');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator('.studio-shell')).toHaveAttribute('data-client-ready', 'true');
  expect(new URL(page.url()).searchParams.get('project')).toBe(scenario.launchProject);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture(page, testInfo, 'icon-resource-mobile-390x844');
});
