import { test, expect, scenarioScope, visit, ready, state, capture } from './fixtures';

test('keeps graph inputs when scope navigation is canceled', async ({ page, scenario }, testInfo) => {
  const scope = scenarioScope(scenario);
  await visit(page, `/senderos/new${scope}`);
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(`Navigation draft ${scenario.id}`);
  await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(`navigation-${scenario.id}`);
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nodes, transitions, and routing' })).toBeVisible();
  const workflow = state().senderos.find(item => item.slug === `navigation-${scenario.id}`)!;
  const savedBudget = () => state().versions.find(item => item.senderoId === workflow.id)!.maxActivations;
  const originalUrl = page.url();
  const budget = page.getByRole('spinbutton', { name: 'Maximum activations per goal' });
  await budget.fill('37');
  const before = state();
  await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(scenario.campaignProject);
  const dialog = page.getByRole('dialog', { name: 'Leave graph editor?' });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(originalUrl);
  await page.evaluate(() => window.scrollTo(0, 0));
  await capture(page, testInfo, 'draft-navigation-desktop-1440x1000');
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, testInfo, 'draft-navigation-mobile-390x844');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(budget).toHaveValue('37');
  await expect(page.getByRole('combobox', { name: 'Project', exact: true })).toHaveValue(scenario.launchProject);
  expect(state()).toEqual(before);
  let releaseSave!: () => void;
  const saveResponse = new Promise<void>(resolve => { releaseSave = resolve; });
  await page.route('**/*.data*', async route => {
    if (route.request().method() === 'POST') {
      const response = await route.fetch();
      await saveResponse;
      await route.fulfill({ response });
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Save graph draft', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saving…', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(scenario.campaignProject);
  await expect(dialog).toContainText('A save is in progress');
  await dialog.getByRole('button', { name: 'Stay here' }).click();
  releaseSave();
  await expect(page.getByText('All graph edits are saved.')).toBeVisible();
  await page.unroute('**/*.data*');
  await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(scenario.campaignProject);
  await ready(page);
  await expect(page).toHaveURL(new RegExp(scenario.campaignProject));
  await page.goBack();
  await ready(page);
  await expect(budget).toHaveValue('37');
  await budget.fill('43');
  for (const direction of ['back', 'forward'] as const) {
    await page.evaluate(direction => history[direction](), direction);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Stay here' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Leave editor' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Stay here' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(budget).toHaveValue('43');
  }
  const unload = page.waitForEvent('dialog');
  // Document navigation uses the browser's native unsaved-change confirmation.
  const leaving = page.getByRole('link', { name: 'New Sendero', exact: true }).click({ noWaitAfter: true });
  const prompt = await unload;
  expect(prompt.type()).toBe('beforeunload');
  await prompt.dismiss();
  await leaving;
  await expect(budget).toHaveValue('43');
  await page.getByRole('combobox', { name: 'Execution context', exact: true }).selectOption(scenario.researchContext);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Leave editor' }).click();
  await expect(page).toHaveURL(new RegExp(scenario.researchContext));
  expect(savedBudget()).toBe(37);
});


test('retains graph inputs after an interrupted save and confirms a retry', async ({ page, scenario }) => {
  await visit(page, `/senderos/new${scenarioScope(scenario)}`);
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(`Interrupted save ${scenario.id}`);
  await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(`interrupted-${scenario.id}`);
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  const budget = page.getByRole('spinbutton', { name: 'Maximum activations per goal' });
  await expect(budget).toBeVisible();
  await budget.fill('39');
  const before = state();
  // Deliberately interrupt the request before it reaches Studio. All successful
  // saves, revalidation, and persistence still use the production server/database.
  await page.route('**/*.data*', async route => {
    if (route.request().method() === 'POST') await route.abort('connectionfailed');
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Save graph draft', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('could not confirm');
  await expect(budget).toHaveValue('39');
  expect(state()).toEqual(before);
  await page.unroute('**/*.data*');
  await page.getByRole('button', { name: 'Save graph draft', exact: true }).click();
  await expect(page.getByText('All graph edits are saved.')).toBeVisible();
  await page.reload();
  await ready(page);
  await expect(budget).toHaveValue('39');
  await budget.fill('41');
  // Lose the response after the real server has applied it. Retrying must not
  // silently overwrite the new revision or discard the user's newer edits.
  await page.route('**/*.data*', async route => {
    if (route.request().method() === 'POST') { await route.fetch(); await route.abort('connectionfailed'); }
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Save graph draft', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('could not confirm');
  await expect(budget).toHaveValue('41');
  await page.unroute('**/*.data*');
  await budget.fill('42');
  await page.getByRole('button', { name: 'Save graph draft', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'changed' }).first()).toBeVisible();
  await expect(budget).toHaveValue('42');
  await page.getByRole('button', { name: 'Cancel changes', exact: true }).click();
  await expect(budget).toHaveValue('41');
  await page.reload();
  await ready(page);
  await expect(budget).toHaveValue('41');
});

test('status refresh retains an unsaved graph and its reviewed revision', async ({ page, scenario }) => {
  await visit(page, `/senderos/new${scenarioScope(scenario)}`);
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(`Snapshot draft ${scenario.id}`);
  await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(`snapshot-${scenario.id}`);
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  const budget = page.getByRole('spinbutton', { name: 'Maximum activations per goal' });
  await expect(budget).toBeVisible();
  await budget.fill('47');
  const revision = await page.locator('.graph-editor input[name="expectedRevision"]').inputValue();
  const before = state();
  await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Refresh status', exact: true })).toHaveAttribute('aria-disabled', 'false');
  await expect(budget).toHaveValue('47');
  expect(await page.locator('.graph-editor input[name="expectedRevision"]').inputValue()).toBe(revision);
  expect(state()).toEqual(before);
  await page.getByRole('button', { name: 'Save graph draft', exact: true }).click();
  await expect(page.getByText('All graph edits are saved.')).toBeVisible();
  await page.reload(); await ready(page);
  await expect(budget).toHaveValue('47');
});
