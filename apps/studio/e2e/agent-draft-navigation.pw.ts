import { capture, expect, ready, scenarioScope, state, test, visit } from './fixtures';

for (const width of [1440, 390]) {
  test(`preserves unsaved agent instructions when scope navigation is cancelled at ${width}px`, async ({ page, scenario }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await visit(page, `/agents/new${scenarioScope(scenario)}`);
    const name = page.getByRole('textbox', { name: /^Name\b/ });
    const slug = page.getByRole('textbox', { name: 'Slug', exact: true });
    const instructions = page.getByRole('textbox', { name: 'Instructions', exact: true });
    await name.fill('Carefully drafted reviewer');
    await slug.fill(`draft-reviewer-${scenario.id}`);
    await instructions.fill('Keep these detailed instructions until I choose to save or discard them.');
    const before = state();
    await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(scenario.campaignProject);
    const dialog = page.getByRole('dialog', { name: 'Leave agent editor?' });
    await expect(dialog).toBeVisible();
    await capture(page, testInfo, `agent-draft-navigation-${width}`);
    await page.keyboard.press('Escape');
    await expect(instructions).toHaveValue('Keep these detailed instructions until I choose to save or discard them.');
    await expect(page.getByRole('combobox', { name: 'Project', exact: true })).toHaveValue(scenario.launchProject);
    expect(state()).toEqual(before);
    // Browser-valid whitespace is rejected by the real action without losing the draft.
    await name.fill('   ');
    await page.getByRole('button', { name: 'Create agent', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Name, slug, and instructions are required');
    await expect(instructions).toHaveValue('Keep these detailed instructions until I choose to save or discard them.');
    expect(state()).toEqual(before);
    await name.fill('Carefully drafted reviewer');
    let releaseSave!: () => void;
    const saveResponse = new Promise<void>(resolve => { releaseSave = resolve; });
    await page.route('**/*.data*', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      const response = await route.fetch();
      await saveResponse;
      await route.fulfill({ response });
    });
    await page.getByRole('button', { name: 'Create agent', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Saving…' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(scenario.campaignProject);
    await expect(dialog).toContainText('A save is in progress');
    await dialog.getByRole('button', { name: 'Stay here' }).click();
    releaseSave();
    await ready(page);
    await expect(page.getByText('Agent created.', { exact: true })).toBeVisible();
    await page.unroute('**/*.data*');
    const agent = state().agents.find(agent => agent.slug === `draft-reviewer-${scenario.id}`)!;
    expect(state().agents.filter(value => value.id === agent.id)).toHaveLength(1);
    await instructions.fill('Revised persisted instructions.');
    const unload = page.waitForEvent('dialog');
    const leaving = page.getByRole('link', { name: 'New agent', exact: true }).click({ noWaitAfter: true });
    const prompt = await unload;
    expect(prompt.type()).toBe('beforeunload'); await prompt.dismiss(); await leaving;
    await expect(instructions).toHaveValue('Revised persisted instructions.');
    await page.getByRole('button', { name: 'Save agent', exact: true }).click();
    await expect(page.getByText('Agent changes saved.', { exact: true })).toBeVisible();
    expect(state().agents.find(value => value.id === agent.id)?.definitionBody).toBe('Revised persisted instructions.');
    await instructions.fill('Discard this change.');
    await page.getByRole('link', { name: 'Close agent editor' }).click(); await ready(page);
    await page.goBack(); await ready(page);
    await expect(instructions).toHaveValue('Revised persisted instructions.');
    // Real document history in both directions uses the browser's unload guard.
    await visit(page, `/agents${scenarioScope(scenario)}`);
    await visit(page, `/agents/${agent.id}${scenarioScope(scenario)}`);
    await visit(page, `/agents${scenarioScope(scenario)}`);
    await page.goBack(); await ready(page);
    await instructions.fill('Unsaved history input.');
    for (const direction of ['back', 'forward'] as const) {
      const confirmation = page.waitForEvent('dialog');
      await page.evaluate(direction => history[direction](), direction);
      const prompt = await confirmation;
      expect(prompt.type()).toBe('beforeunload'); await prompt.dismiss();
      await expect(instructions).toHaveValue('Unsaved history input.');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(scenario.campaignProject);
    await dialog.getByRole('button', { name: 'Leave editor' }).click(); await ready(page);
    expect(state().agents.find(value => value.id === agent.id)?.definitionBody).toBe('Revised persisted instructions.');
  });
}
