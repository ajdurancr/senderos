import { capture, expect, goalAttempts, ready, reload, scenarioScope, state, test, visit } from './fixtures';

for (const outcome of ['committed', 'unapplied', 'confirmed'] as const) for (const width of [1440, 390]) {
  const committed = outcome !== 'unapplied';
  test(`recovers goal activation confirmation (${outcome}) without replay at ${width}px`, async ({ page, scenario }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const scope = scenarioScope(scenario), title = `Activation confirmation ${scenario.id}`;
    await visit(page, `/projects/${scenario.launchProject}/goals/new${scope}`);
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
    await page.getByRole('combobox', { name: 'Sendero', exact: true }).selectOption(scenario.prerequisiteVersionId);
    await page.getByRole('button', { name: 'Create goal', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Start goal', exact: true })).toBeVisible();
    const goal = state().goals.find(item => item.title === title)!;
    let writes = 0;
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/*.data*', async route => {
      if (route.request().method() !== 'POST' || new URLSearchParams(route.request().postData() ?? '').get('intent') !== 'start') return route.continue();
      writes++;
      const response = committed ? await route.fetch() : null;
      if (response) expect(response.ok()).toBe(true);
      await held;
      if (outcome === 'confirmed') await route.fulfill({ response: response! });
      else await route.abort('failed');
    });
    await page.getByRole('button', { name: 'Start goal', exact: true }).click();
    await expect.poll(() => writes).toBe(1);
    await expect(page.getByRole('button', { name: 'Starting…', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Starting…', exact: true }).evaluate(button => { button.closest('form')!.requestSubmit(); button.closest('form')!.requestSubmit(); });
    expect(writes).toBe(1);
    release();
    if (committed) await expect.poll(() => state().goals.find(item => item.id === goal.id)?.status).not.toBe('draft');
    if (outcome !== 'confirmed') {
      await expect(page.locator('.studio-shell')).toBeVisible();
      await expect(page.getByRole('alert')).toContainText('could not confirm goal activation');
      await expect(page.getByRole('button', { name: 'Start goal', exact: true })).toBeDisabled();
      await page.getByRole('button', { name: 'Start goal', exact: true }).evaluate(button => button.closest('form')!.requestSubmit());
      await expect(page.getByRole('button', { name: 'Edit goal', exact: true })).toBeDisabled();
      await page.getByRole('alert').scrollIntoViewIfNeeded();
      await capture(page, testInfo, `lost-start-${committed ? 'committed' : 'unapplied'}-${width}`);
    }
    expect(writes).toBe(1);
    expect(goalAttempts(goal.id)).toHaveLength(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.unroute('**/*.data*');
    if (outcome !== 'confirmed') {
      const readback = page.getByRole('button', { name: 'Reload persisted goal and workflow progress' });
      await readback.scrollIntoViewIfNeeded();
      await capture(page, testInfo, `start-readback-${outcome}-${width}`);
      const currentUrl = page.url();
      await readback.focus();
      await Promise.all([page.waitForEvent('load'), width === 1440 ? page.keyboard.press('Enter') : readback.click()]); await ready(page);
      expect(page.url()).toBe(currentUrl);
    } else await reload(page);
    expect(writes).toBe(1);
    if (!committed) {
      expect(state().goals.find(item => item.id === goal.id)?.status).toBe('draft');
      await page.getByRole('button', { name: 'Start goal', exact: true }).click();
    }
    await expect(page.getByRole('link', { name: 'Review ready activations' })).toBeVisible();
    const data = state();
    expect(data.goals.find(item => item.id === goal.id)?.senderoVersionId).toBe(scenario.prerequisiteVersionId);
    const executions = data.executions.filter(item => item.goalId === goal.id);
    expect(executions).toHaveLength(1);
    expect(executions[0]!.maxActivations).toBe(data.versions.find(item => item.id === scenario.prerequisiteVersionId)!.maxActivations);
    expect(executions[0]!.attemptsUsed).toBe(0);
    expect(executions[0]!.cancellationRequestedAt).toBeNull();
    expect(data.activations.filter(item => item.goalId === goal.id).length).toBe(executions[0]!.activationsUsed);
    expect(goalAttempts(goal.id)).toHaveLength(0);
    await ready(page);
  });
}
