import { capture, expect, ready, scenarioScope, state, test, visit } from './fixtures';

for (const width of [1440, 390]) {
  test(`keeps historical success consumed after uncertain edit fragment history at ${width}px`, async ({ page, scenario }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const scope = scenarioScope(scenario), slug = `confirmation-${scenario.id}`;
    await visit(page, `/agents/new${scope}`);
    await page.getByRole('textbox', { name: /^Name\b/ }).fill('Confirmation provenance');
    await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(slug);
    const instructions = page.getByRole('textbox', { name: 'Instructions', exact: true });
    await instructions.fill('Persisted original instructions.');
    await page.getByRole('button', { name: 'Create agent', exact: true }).click();
    await expect(page.getByText('Agent created.', { exact: true })).toBeVisible(); await ready(page);
    const path = new URL(page.url()).pathname, persisted = state();
    await instructions.fill('Unconfirmed reviewed instructions.');
    let writes = 0, release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/*.data*', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      writes++; await held; await route.abort('failed');
    });
    const save = page.getByRole('button', { name: 'Save agent', exact: true });
    await save.click(); await expect.poll(() => writes).toBe(1);
    await expect(page.getByText('Agent created.', { exact: true })).toHaveCount(0);
    release(); await expect(page.getByRole('status')).toContainText('could not confirm the agent save');
    let reads = 0;
    page.on('request', request => { if (request.method() === 'GET' && new URL(request.url()).pathname.endsWith('.data')) reads++; });
    await page.evaluate(() => { location.hash = 'inspection'; });
    await expect(page).toHaveURL(/#inspection$/);
    await expect(page.getByText('Agent created.', { exact: true })).toHaveCount(0);
    expect(reads).toBe(0);
    const historyRead = page.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname.endsWith('.data'));
    await page.goBack(); expect((await historyRead).ok()).toBe(true); await ready(page);
    await page.goForward();
    await expect(page).toHaveURL(/#inspection$/);
    await expect(page.getByText('Agent created.', { exact: true })).toHaveCount(0);
    await expect(save).toBeDisabled(); await expect(instructions).toHaveValue('Unconfirmed reviewed instructions.');
    expect(reads).toBeGreaterThan(0); expect(writes).toBe(1); expect(state()).toEqual(persisted);
    await capture(page, testInfo, `save-confirmation-uncertain-${width}`);
    const unload = page.waitForEvent('dialog').then(dialog => dialog.accept());
    const readback = page.waitForResponse(response => response.request().isNavigationRequest() && response.request().method() === 'GET' && new URL(response.url()).pathname === path);
    const loaded = page.waitForEvent('load');
    const reload = page.getByRole('button', { name: 'Reload persisted agents' });
    if (width === 390) await reload.click(); else { await reload.focus(); await reload.press('Enter'); }
    await unload; expect((await readback).ok()).toBe(true); await loaded; await ready(page);
    await expect(instructions).toHaveValue('Persisted original instructions.');
    await expect(page.getByText('Agent created.', { exact: true })).toBeVisible();
    expect(state()).toEqual(persisted); expect(writes).toBe(1);
    await page.unroute('**/*.data*');
    await instructions.fill('New confirmed correction.'); await save.click();
    await expect(page.getByText('Agent changes saved.', { exact: true })).toBeVisible();
    await expect(instructions).toHaveValue('New confirmed correction.');
    expect(state().agents.find(agent => agent.slug === slug)?.definitionBody).toBe('New confirmed correction.');
    await capture(page, testInfo, `save-confirmation-confirmed-${width}`);
  });
}
