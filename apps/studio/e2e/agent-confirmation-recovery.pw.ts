import { capture, expect, ready, scenarioScope, state, test, visit } from './fixtures';

// Committed creation is covered by interrupted-mutation; retain that control.
for (const width of [1440, 390]) for (const edit of [false, true]) for (const committed of edit ? [false, true] : [false]) {
  test(`retains ${edit ? 'edited' : 'new'} agent after ${committed ? 'committed' : 'unapplied'} response loss at ${width}px`, async ({ page, scenario }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const scope = scenarioScope(scenario), slug = `agent-response-${scenario.id}`;
    await visit(page, `/agents/new${scope}`);
    const name = page.getByRole('textbox', { name: /^Name\b/ });
    const instructions = page.getByRole('textbox', { name: 'Instructions', exact: true });
    await name.fill('Agent response control');
    await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(slug);
    await instructions.fill('Original isolated instructions.');
    if (edit) {
      await page.getByRole('button', { name: 'Create agent', exact: true }).click();
      await expect(page.getByText('Agent created.', { exact: true })).toBeVisible();
      await ready(page);
    }
    const retained = 'Retain this reviewed correction after response loss.';
    await instructions.fill(retained);
    const path = new URL(page.url()).pathname, before = state();
    let writes = 0, posted = false, release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/*.data*', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      writes++;
      if (committed) expect((await route.fetch()).ok()).toBe(true);
      posted = true; await held; await route.abort('failed');
    });
    const submit = page.getByRole('button', { name: edit ? 'Save agent' : 'Create agent', exact: true });
    const form = page.locator('form.authoring-panel');
    await submit.click(); await expect.poll(() => posted).toBe(true);
    await expect(instructions).toBeDisabled();
    await form.evaluate(form => { (form as HTMLFormElement).reset(); (form as HTMLFormElement).requestSubmit(); });
    const cancel = page.getByRole('link', { name: 'Close agent editor' });
    await cancel.focus(); await cancel.press('Enter');
    expect(new URL(page.url()).pathname).toBe(path); expect(writes).toBe(1);
    await page.getByRole('combobox', { name: 'Execution context', exact: true }).selectOption(scenario.researchContext);
    const dialog = page.getByRole('dialog', { name: 'Leave agent editor?' });
    await expect(dialog).toContainText('A save is in progress'); await page.keyboard.press('Escape');
    release();
    await expect(page.getByRole('status')).toContainText('could not confirm the agent save');
    await expect(instructions).toHaveValue(retained); await expect(submit).toBeDisabled();
    const after = state();
    if (!committed) expect(after).toEqual(before);
    else {
      expect(after.agents.find(agent => agent.slug === slug)?.definitionBody).toBe(retained);
      expect(after.agents.length).toBe(before.agents.length);
      expect(after.goals).toEqual(before.goals); expect(after.runs).toEqual(before.runs);
    }
    await page.evaluate(() => { location.hash = 'inspection'; });
    await expect(page).toHaveURL(/#inspection$/); await expect(submit).toBeDisabled();
    await form.evaluate(form => { (form as HTMLFormElement).reset(); (form as HTMLFormElement).requestSubmit(); });
    await cancel.focus(); await cancel.press('Enter');
    await expect(instructions).toHaveValue(retained); expect(writes).toBe(1); expect(state()).toEqual(after);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Reload persisted agents' }).scrollIntoViewIfNeeded();
    await capture(page, testInfo, `agent-confirmation-${edit}-${committed}-${width}`);
    await page.unroute('**/*.data*');
    const unload = page.waitForEvent('dialog').then(dialog => dialog.accept()), loaded = page.waitForEvent('load');
    const readback = page.waitForResponse(response => response.request().isNavigationRequest() && response.request().method() === 'GET' && new URL(response.url()).pathname === path);
    const reload = page.getByRole('button', { name: 'Reload persisted agents' });
    if (width === 390) await reload.click(); else { await reload.focus(); await reload.press('Enter'); }
    await unload; expect((await readback).ok()).toBe(true); await loaded; await ready(page);
    expect(new URL(page.url()).pathname).toBe(path); expect(new URL(page.url()).search).toBe(scope + (edit ? '&saved=create-agent' : ''));
    await expect(instructions).toHaveValue(edit ? committed ? retained : 'Original isolated instructions.' : '');
    await expect(submit).toBeEnabled(); expect(writes).toBe(1); expect(state()).toEqual(after);
  });
}
