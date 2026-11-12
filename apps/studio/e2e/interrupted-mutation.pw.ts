import { capture, expect, ready, scenarioScope, state, test, visit } from './fixtures';

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`recovers a persisted agent after its action response is lost at ${viewport.width}px`, async ({ page, scenario }, testInfo) => {
    await page.setViewportSize(viewport);
    const scope = scenarioScope(scenario), slug = `lost-response-${scenario.id}`;
    const instructions = 'Retain this persisted instruction after an interrupted response.';
    await visit(page, `/agents/new${scope}`);
    await page.getByRole('textbox', { name: /^Name\b/ }).fill('Interrupted response reviewer');
    await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(slug);
    await page.getByRole('textbox', { name: 'Instructions', exact: true }).fill(instructions);
    let writes = 0;
    await page.route('**/*.data*', async route => {
      if (route.request().method() !== 'POST' || !route.request().postData()?.includes('create-agent')) return route.continue();
      writes++;
      // Let the real server commit, then lose only the response to the browser.
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      await route.abort('failed');
    });
    await page.getByRole('button', { name: 'Create agent', exact: true }).click();
    await expect.poll(() => state().agents.filter(agent => agent.slug === slug).length).toBe(1);
    await expect(page.getByRole('status')).toContainText('could not confirm the agent save');
    await expect(page.getByRole('textbox', { name: 'Instructions', exact: true })).toHaveValue(instructions);
    await expect(page.getByRole('button', { name: 'Create agent', exact: true })).toBeDisabled();
    await capture(page, testInfo, `interrupted-mutation-${viewport.width}x${viewport.height}`);
    expect(writes).toBe(1);
    await expect(page.getByText('Your data was not changed.', { exact: false })).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('may have reached the server');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.unroute('**/*.data*');
    const reloadLink = page.getByRole('button', { name: 'Reload persisted agents' });
    await reloadLink.focus(); await expect(reloadLink).toBeFocused();
    const unload = page.waitForEvent('dialog').then(dialog => dialog.accept());
    const reloading = page.waitForEvent('load');
    await reloadLink.press('Enter'); await unload; await reloading; await ready(page);
    expect(new URL(page.url()).search).toBe(scope);
    expect(writes).toBe(1);
    const agent = state().agents.find(agent => agent.slug === slug)!;
    await page.goto(`/agents/${agent.id}${scope}`); await ready(page);
    await expect(page.getByRole('textbox', { name: 'Instructions', exact: true })).toHaveValue(instructions);
    expect(state().agents.filter(value => value.slug === slug)).toHaveLength(1);
  });
}
