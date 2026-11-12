import { capture, expect, ready, scenarioScope, state, test, visit } from './fixtures';

for (const width of [1440, 390]) {
  test(`preserves creation drafts across scope and history attempts, then discards explicitly at ${width}px`, async ({ page, scenario }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const path = `/projects/${scenario.launchProject}/goals/new${scenarioScope(scenario)}`;
    await visit(page, `/goals${scenarioScope(scenario)}`);
    await visit(page, path);
    await visit(page, `/events${scenarioScope(scenario)}`);
    await page.goBack(); await ready(page);
    const url = page.url(), title = `Unsaved new goal ${scenario.id}`;
    const input = page.getByRole('textbox', { name: 'Title', exact: true });
    await input.fill(title);
    await page.getByLabel('Category', { exact: true }).fill('research');
    await page.getByRole('textbox', { name: 'Specification', exact: true }).fill('Keep the reviewed acceptance criteria.');
    const before = state();
    await page.getByRole('combobox', { name: 'Execution context', exact: true }).selectOption(scenario.researchContext);
    const dialog = page.getByRole('dialog', { name: 'Leave new goal editor?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Stay here' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(input).toHaveValue(title); expect(page.url()).toBe(url);
    for (const direction of ['back', 'forward'] as const) {
      let prompt = '';
      page.once('dialog', async dialog => { prompt = dialog.type(); await dialog.dismiss(); });
      await page.evaluate(direction => history[direction](), direction);
      await expect.poll(() => prompt).toBe('beforeunload');
      await expect(input).toHaveValue(title);
    }
    // A known server rejection retains correctable values and does not create.
    await input.fill(' ');
    await page.getByRole('button', { name: 'Create goal', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Goal title');
    await expect(input).toHaveValue(' ');
    await expect(page.getByLabel('Category', { exact: true })).toHaveValue('research');
    await expect(page.getByRole('textbox', { name: 'Specification', exact: true })).toHaveValue('Keep the reviewed acceptance criteria.');
    await input.fill(title);
    await capture(page, testInfo, `new-goal-retained-${width}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Discard goal draft' }).click();
    await expect(input).toHaveValue('');
    await expect(page.getByLabel('Category', { exact: true })).toHaveValue('task');
    await expect(page.getByRole('textbox', { name: 'Specification', exact: true })).toHaveValue('');
    expect(state()).toEqual(before);
    await page.getByRole('combobox', { name: 'Execution context', exact: true }).selectOption(scenario.researchContext);
    await expect(page.getByRole('combobox', { name: 'Execution context', exact: true })).toHaveValue(scenario.researchContext);
    await expect(dialog).toHaveCount(0);
  });

  for (const committed of [false, true]) test(`requires inspection after ${committed ? 'committed' : 'unapplied'} creation response loss at ${width}px`, async ({ page, scenario }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const scope = scenarioScope(scenario), path = `/projects/${scenario.launchProject}/goals/new${scope}`;
    await visit(page, path);
    const title = `Unconfirmed creation ${scenario.id}`, spec = 'Preserve this reviewed outcome without replaying creation.';
    const input = page.getByLabel('Title', { exact: true });
    await input.fill(title); await page.getByRole('textbox', { name: 'Specification', exact: true }).fill(spec);
    const before = state();
    let writes = 0, release!: () => void, posted = false;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/*.data*', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      writes++;
      if (committed) expect((await route.fetch()).ok()).toBe(true);
      posted = true;
      await held; await route.abort('failed');
    });
    const create = page.getByRole('button', { name: 'Create goal', exact: true });
    await create.click();
    await expect.poll(() => posted).toBe(true);
    await expect(input).toBeDisabled();
    await expect(page.getByRole('textbox', { name: 'Specification', exact: true })).toBeDisabled();
    await page.getByRole('form', { name: 'New goal', exact: true }).evaluate(form => (form as HTMLFormElement).requestSubmit());
    expect(writes).toBe(1);
    await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(scenario.campaignProject);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('goal may still be created');
    await dialog.getByRole('button', { name: 'Stay here' }).click();
    release();
    await expect(page.getByRole('alert')).toContainText('could not confirm goal creation');
    await expect(input).toHaveValue(title);
    await expect(page.getByRole('textbox', { name: 'Specification', exact: true })).toHaveValue(spec);
    await expect(create).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Discard goal draft' })).toBeDisabled();
    const after = state();
    expect(after.goals.filter(goal => goal.title === title)).toHaveLength(committed ? 1 : 0);
    expect(after.goals.length).toBe(before.goals.length + (committed ? 1 : 0));
    expect(after.runs).toEqual(before.runs); expect(after.activations).toEqual(before.activations);
    await page.evaluate(() => { location.hash = 'inspect'; });
    await expect(page).toHaveURL(/#inspect$/);
    await expect(create).toBeDisabled();
    await page.getByRole('form', { name: 'New goal', exact: true }).evaluate(form => (form as HTMLFormElement).requestSubmit());
    expect(writes).toBe(1); expect(state()).toEqual(after);
    await page.getByRole('button', { name: 'Reload persisted goals' }).scrollIntoViewIfNeeded();
    await capture(page, testInfo, `new-goal-unconfirmed-${committed}-${width}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.unroute('**/*.data*');
    let readbacks = 0;
    page.on('response', response => { if (response.request().method() === 'GET' && response.request().isNavigationRequest() && response.ok()) readbacks++; });
    page.once('dialog', dialog => dialog.accept());
    const reload = page.getByRole('button', { name: 'Reload persisted goals' });
    await reload.focus(); await page.keyboard.press('Enter'); await ready(page);
    await expect(input).toHaveValue('');
    await expect(create).toBeEnabled();
    expect(readbacks).toBeGreaterThan(0);
    expect(new URL(page.url()).search).toBe(scope);
    expect(state()).toEqual(after);
    if (committed) {
      const goal = after.goals.find(goal => goal.title === title)!;
      await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible();
      expect(goal).toMatchObject({ status: 'draft', specText: spec });
    } else {
      await input.fill(title); await page.getByRole('textbox', { name: 'Specification', exact: true }).fill(spec);
      await create.click(); await ready(page);
      await expect.poll(() => state().goals.filter(goal => goal.title === title).length).toBe(1);
      const goal = state().goals.find(goal => goal.title === title)!;
      expect(goal).toMatchObject({ status: 'draft', specText: spec });
      await expect(page).toHaveURL(new RegExp(`/canvas/goals/${goal.id}`));
    }
    expect(state().runs).toEqual(before.runs); expect(state().activations).toEqual(before.activations);
  });
}
