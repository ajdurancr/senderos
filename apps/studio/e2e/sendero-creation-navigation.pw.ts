import { capture, expect, ready, scenarioScope, state, test, visit } from './fixtures';

for (const width of [1440, 390]) {
  test(`preserves workflow creation and import drafts across method and scope changes at ${width}px`, async ({ page, scenario }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await visit(page, `/senderos/new${scenarioScope(scenario)}`);
    const name = page.getByRole('textbox', { name: 'Name', exact: true });
    const slug = page.getByRole('textbox', { name: 'Slug', exact: true });
    await name.fill('Carefully planned workflow');
    await slug.fill(`creation-${scenario.id}`);
    await page.getByRole('textbox', { name: 'Description', exact: true }).fill('Keep this plan until I choose to save or discard it.');
    await page.getByRole('combobox', { name: 'Authoring method' }).selectOption('import');
    const definition = JSON.stringify({ name: 'Imported plan', slug: `import-${scenario.id}`, nodes: [{ key: 'start', kind: 'start', label: 'Start' }, { key: 'end', kind: 'end', label: 'End' }], edges: [{ key: 'finish', source: 'start', target: 'end', name: 'Finish' }] });
    await page.getByRole('textbox', { name: 'Sendero JSON' }).fill(definition);
    await page.getByRole('combobox', { name: 'Authoring method' }).selectOption('create');
    await expect(name).toHaveValue('Carefully planned workflow');
    await expect(slug).toHaveValue(`creation-${scenario.id}`);
    await page.getByRole('combobox', { name: 'Authoring method' }).selectOption('import');
    await expect(page.getByRole('textbox', { name: 'Sendero JSON' })).toHaveValue(definition);
    const before = state();
    await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(scenario.campaignProject);
    const dialog = page.getByRole('dialog', { name: 'Leave graph editor?' });
    await expect(dialog).toBeVisible();
    await capture(page, testInfo, `sendero-creation-navigation-${width}`);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('textbox', { name: 'Sendero JSON' })).toHaveValue(definition);
    expect(state()).toEqual(before);
    await page.getByRole('textbox', { name: 'Sendero JSON' }).fill('{broken');
    await page.getByRole('button', { name: 'Import draft', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('valid JSON');
    await expect(page.getByRole('textbox', { name: 'Sendero JSON' })).toHaveValue('{broken');
    expect(state()).toEqual(before);
    await page.getByRole('textbox', { name: 'Sendero JSON' }).fill(definition);
    let releaseSave!: () => void;
    const saveResponse = new Promise<void>(resolve => { releaseSave = resolve; });
    await page.route('**/*.data*', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      const response = await route.fetch();
      await saveResponse;
      await route.fulfill({ response });
    });
    await page.getByRole('button', { name: 'Import draft', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Saving…' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(scenario.campaignProject);
    await expect(dialog).toContainText('A save is in progress');
    await dialog.getByRole('button', { name: 'Stay here' }).click();
    releaseSave();
    await ready(page);
    await expect(page).toHaveURL(/\/senderos\/[^/?]+\?/);
    expect(state().senderos.filter(value => value.slug === `import-${scenario.id}`)).toHaveLength(1);
    await page.unroute('**/*.data*');
    await visit(page, `/senderos/new${scenarioScope(scenario)}`);
    await name.fill('A new plan'); await slug.fill(`new-${scenario.id}`);
    const unload = page.waitForEvent('dialog');
    const leaving = page.getByRole('link', { name: 'Cancel', exact: true }).evaluate(element => {
      // A real document navigation bypasses the intentional Cancel handler.
      const link = document.createElement('a'); link.href = element.getAttribute('href')!;
      document.body.append(link); link.click(); link.remove();
    });
    const prompt = await unload;
    expect(prompt.type()).toBe('beforeunload'); await prompt.dismiss(); await leaving;
    await expect(name).toHaveValue('A new plan');
    await page.getByRole('button', { name: 'Create draft', exact: true }).click();
    await expect(page.getByText('New draft created. Validate and publish when ready.', { exact: true })).toBeVisible();
    expect(state().senderos.filter(value => value.slug === `new-${scenario.id}`)).toHaveLength(1);
    await visit(page, `/senderos/new${scenarioScope(scenario)}`);
    await name.fill('Intentionally discarded');
    await page.getByRole('link', { name: 'Cancel', exact: true }).click(); await ready(page);
    await page.goBack(); await ready(page);
    await expect(name).toHaveValue('');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
