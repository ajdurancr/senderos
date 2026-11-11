import { capture, expect, scenarioScope, state, test, visit } from './fixtures';

for (const width of [1440, 390]) {
  test(`protects simultaneous workspace registration drafts across scope navigation at ${width}px`, async ({ page, scenario }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await visit(page, `/settings${scenarioScope(scenario)}`);
    await page.getByText('Add a project', { exact: true }).click();
    await page.getByText('Add an execution context', { exact: true }).click();
    const project = page.getByRole('textbox', { name: /^Project name/ });
    const context = page.getByRole('textbox', { name: /^Context name/ });
    await project.fill('Retained notebook');
    await context.fill('Retained team');
    const before = state();
    await page.getByRole('combobox', { name: 'Execution context', exact: true }).selectOption(scenario.researchContext);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 2500 });
    await capture(page, testInfo, `registration-navigation-${width}`);
    await dialog.getByRole('button', { name: 'Stay here' }).click();
    await expect(project).toHaveValue('Retained notebook');
    await expect(context).toHaveValue('Retained team');
    expect(state()).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('combobox', { name: 'Execution context', exact: true }).selectOption(scenario.researchContext);
    await dialog.getByRole('button', { name: 'Leave editor' }).click();
    await expect(page.getByRole('combobox', { name: 'Execution context', exact: true })).toHaveValue(scenario.researchContext);
    await page.getByText('Add a project', { exact: true }).click();
    await page.getByText('Add an execution context', { exact: true }).click();
    await expect(project).toHaveValue('');
    await expect(context).toHaveValue('');
    expect(state()).toEqual(before);
  });
}

for (const width of [1440, 390]) {
  for (const lostResponse of [false, true]) {
  test(`preserves registration and settings drafts through history and ${lostResponse ? "lost" : "pending"} confirmation at ${width}px`, async ({ page, scenario }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await visit(page, `/now${scenarioScope(scenario)}`);
    await visit(page, `/settings${scenarioScope(scenario)}`);
    await visit(page, `/now${scenarioScope(scenario)}`);
    await page.goBack();
    await expect(page.getByRole('button', { name: 'Save project', exact: true })).toBeEnabled();
    await page.getByText('Add a project', { exact: true }).click();
    await page.getByText('Add an execution context', { exact: true }).click();
    const project = page.getByRole('textbox', { name: /^Project name/ });
    const context = page.getByRole('textbox', { name: /^Context name/ });
    const settings = page.getByRole('textbox', { name: /^Name\b/ });
    const name = `Navigation ${scenario.id.slice(0, 8)}`;
    await project.fill(name);
    await context.fill('Keep this context draft');
    await settings.fill('Keep these settings');
    const before = state();
    for (const direction of ['back', 'forward'] as const) {
      const prompt = page.waitForEvent('dialog');
      await page.evaluate(direction => history[direction](), direction);
      const dialog = await prompt;
      expect(dialog.type()).toBe('beforeunload');
      await dialog.dismiss();
      await expect(project).toHaveValue(name);
      await expect(context).toHaveValue('Keep this context draft');
      await expect(settings).toHaveValue('Keep these settings');
    }
    let confirmationMessage = '';
    page.once('dialog', async dialog => { confirmationMessage = dialog.message(); await dialog.dismiss(); });
    await page.getByRole('button', { name: 'Add project', exact: true }).click();
    expect(confirmationMessage).toContain('other settings forms will be discarded');
    expect(state()).toEqual(before);
    await expect(settings).toHaveValue('Keep these settings');
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/*.data*', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      const response = await route.fetch();
      await held;
      if (lostResponse) await route.abort('failed');
      else await route.fulfill({ response });
    });
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Add project', exact: true }).click();
    await expect.poll(() => state().projects.filter(item => item.name === name).length).toBe(1);
    await expect(project).toBeDisabled();
    await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(scenario.campaignProject);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('save may still finish');
    await capture(page, testInfo, `registration-${lostResponse ? "lost" : "pending"}-navigation-${width}`);
    await dialog.getByRole('button', { name: 'Stay here' }).click();
    await expect(context).toHaveValue('Keep this context draft');
    release();
    if (lostResponse) {
      await expect(page.getByRole('alert')).toContainText('may have reached the server');
      await expect(project).toHaveValue(name);
      await expect(context).toHaveValue('Keep this context draft');
      await expect(settings).toHaveValue('Keep these settings');
      await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(scenario.campaignProject);
      await expect(dialog).toContainText('unsaved');
      await dialog.getByRole('button', { name: 'Stay here' }).click();
    } else {
      await expect(page.getByRole('combobox', { name: 'Project', exact: true })).toHaveValue(state().projects.find(item => item.name === name)!.id);
    }
    expect(state().projects.find(item => item.id === scenario.launchProject)).toEqual(before.projects.find(item => item.id === scenario.launchProject));
    expect(state().executionContexts).toEqual(before.executionContexts);
    await page.unroute('**/*.data*');
  });
}
}

for (const width of [1440, 390]) {
  test(`asks before registration redirects discard another form at ${width}px`, async ({ page, scenario }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await visit(page, `/settings${scenarioScope(scenario)}`);
    await page.getByText('Add an execution context', { exact: true }).click();
    await page.getByRole('textbox', { name: /^Name\b/ }).fill('Other unsaved settings');
    await page.getByRole('textbox', { name: /^Context name/ }).fill(`Confirm ${scenario.id}`);
    const before = state();
    let message = '';
    page.once('dialog', async dialog => { message = dialog.message(); await dialog.dismiss(); });
    await page.getByRole('button', { name: 'Add context', exact: true }).click();
    expect(message).toContain('other settings forms will be discarded');
    await expect(page.getByRole('textbox', { name: /^Name\b/ })).toHaveValue('Other unsaved settings');
    expect(state()).toEqual(before);
  });
}

for (const width of [1440, 390]) {
  test(`guards onboarding without a project and discards only the requested registration at ${width}px`, async ({ page, scenario }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await visit(page, `/settings${scenarioScope(scenario)}`);
    await page.getByText('Add an execution context', { exact: true }).click();
    const context = page.getByRole('textbox', { name: /^Context name/ });
    await context.fill(`Empty workspace ${scenario.id}`);
    await page.getByRole('button', { name: 'Add context', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'No project in this scope' })).toBeVisible();
    await page.getByRole('textbox', { name: /^Project name/ }).fill('First project draft');
    await page.getByText('Add an execution context', { exact: true }).click();
    await context.fill('Another team draft');
    const before = state();
    await page.getByRole('button', { name: 'Discard project registration' }).click();
    await expect(page.getByRole('textbox', { name: /^Project name/ })).toHaveValue('');
    await expect(context).toHaveValue('Another team draft');
    await page.getByRole('combobox', { name: 'Execution context', exact: true }).selectOption(scenario.productContext);
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Stay here' }).click();
    await page.getByRole('button', { name: 'Discard context registration' }).click();
    await page.getByRole('combobox', { name: 'Execution context', exact: true }).selectOption(scenario.productContext);
    await expect(page.getByRole('textbox', { name: /^Name\b/ })).toHaveValue(before.projects.find(item => item.id === scenario.launchProject)!.name);
    expect(state()).toEqual(before);
  });
}
