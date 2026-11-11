import { capture, expect, goalAttempts, ready, runtime, scenarioScope, state, test, visit } from './fixtures';

for (const intent of ['start', 'dispatch-plan', 'cancel-goal'] as const) for (const committed of [true, false]) for (const width of [1440, 390]) {
  test(`requires authoritative ${intent} readback through refresh and scope history (${committed ? 'committed' : 'unapplied'}) at ${width}px`, async ({ page, scenario }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const scope = scenarioScope(scenario), title = `Readback boundary ${scenario.id}`;
    await visit(page, `/projects/${scenario.launchProject}/goals/new${scope}`);
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
    await page.getByRole('combobox', { name: 'Sendero', exact: true }).selectOption(scenario.prerequisiteVersionId);
    await page.getByRole('button', { name: 'Create goal', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Start goal', exact: true })).toBeEnabled();
    const goal = state().goals.find(item => item.title === title)!;
    if (intent !== 'start') {
      await page.getByRole('button', { name: 'Start goal', exact: true }).click();
      await page.getByRole('link', { name: 'Review ready activations' }).click();
      await expect(page.getByRole('button', { name: 'Dispatch all', exact: true })).toBeEnabled();
    }
    let attemptId: string | undefined;
    if (intent === 'cancel-goal') {
      await page.getByRole('button', { name: 'Dispatch all', exact: true }).click();
      await expect.poll(() => goalAttempts(goal.id).length).toBe(1);
      attemptId = goalAttempts(goal.id)[0]!.id;
      runtime('host-claim', attemptId); runtime('host-start', attemptId);
      await visit(page, `/projects/${scenario.launchProject}/canvas/goals/${goal.id}/attempts/${attemptId}${scope}`);
    }
    const currentUrl = page.url();
    // Put document entries on both sides so real Back/Forward can be dismissed.
    await visit(page, `/now${scope}`); await visit(page, currentUrl); await visit(page, `/now${scope}`);
    await page.goBack(); await ready(page);
    if (intent === 'cancel-goal') await page.getByRole('button', { name: 'Request stop', exact: true }).click();
    let writes = 0, refreshReads = 0, completedReads = 0;
    await page.route('**/*.data*', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      writes++;
      expect(new URLSearchParams(route.request().postData() ?? '').get('intent')).toBe(intent);
      if (committed) { const response = await route.fetch(); expect(response.ok()).toBe(true); }
      await route.abort('failed');
    });
    const actionName = intent === 'start' ? 'Start goal' : intent === 'dispatch-plan' ? 'Dispatch all' : 'Confirm stop';
    await page.getByRole('button', { name: actionName, exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Studio could not confirm');
    const repeat = page.getByRole('button', { name: actionName, exact: true });
    await expect(repeat).toBeDisabled();
    const before = state();
    const budget = page.getByRole('spinbutton', { name: 'Activation limit', exact: true });
    const proof = page.getByLabel('Evidence label', { exact: true });
    if (intent !== 'start') await budget.fill('80');
    if (intent === 'cancel-goal') await proof.fill('Keep readback evidence');
    const freshness = page.getByRole('region', { name: 'Snapshot freshness' });
    const timestamp = await freshness.locator('time').getAttribute('datetime');
    await page.route('**/resources/snapshot?**', async route => { refreshReads++; await route.abort('failed'); });
    await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
    await expect(freshness.getByRole('alert')).toContainText('previous snapshot and your edits are kept');
    expect(await freshness.locator('time').getAttribute('datetime')).toBe(timestamp);
    await expect(repeat).toBeDisabled();
    await repeat.evaluate(button => button.closest('form')!.requestSubmit());
    expect(writes).toBe(1); expect(state()).toEqual(before);
    if (intent !== 'start') {
      for (const direction of ['back', 'forward'] as const) {
        let promptType = '';
        page.once('dialog', async dialog => { promptType = dialog.type(); await dialog.dismiss(); });
        await page.evaluate(direction => history[direction](), direction);
        await expect.poll(() => promptType).toBe('beforeunload');
        await expect(budget).toHaveValue('80');
        await expect(repeat).toBeDisabled();
      }
      await page.getByRole('combobox', { name: 'Execution context', exact: true }).selectOption(scenario.researchContext);
      await page.getByRole('dialog').getByRole('button', { name: 'Stay here' }).click();
      await expect(budget).toHaveValue('80');
      if (intent === 'cancel-goal') await expect(proof).toHaveValue('Keep readback evidence');
      expect(page.url()).toBe(currentUrl);
    }
    await page.unroute('**/resources/snapshot?**');
    await page.route('**/resources/snapshot?**', async route => { refreshReads++; await route.continue(); });
    await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
    await expect(freshness.getByRole('alert')).toHaveCount(0);
    expect(refreshReads).toBe(2);
    if (intent !== 'start') await expect(budget).toHaveValue('80');
    if (intent === 'cancel-goal') await expect(proof).toHaveValue('Keep readback evidence');
    expect(writes).toBe(1); expect(state()).toEqual(before);
    await freshness.scrollIntoViewIfNeeded();
    await capture(page, testInfo, `readback-refresh-${intent}-${committed}-${width}`);
    page.on('response', response => { if (response.request().method() === 'GET' && response.url().includes('.data') && response.ok()) completedReads++; });
    await page.getByRole('combobox', { name: 'Execution context', exact: true }).selectOption(scenario.researchContext);
    if (intent !== 'start') await page.getByRole('dialog').getByRole('button', { name: 'Leave editor' }).click();
    await expect(page.getByRole('combobox', { name: 'Execution context', exact: true })).toHaveValue(scenario.researchContext);
    await expect(page.getByRole('button', { name: actionName, exact: true })).toHaveCount(0);
    expect(completedReads).toBeGreaterThan(0);
    let release!: () => void, pendingReads = 0;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/*.data*', async route => {
      if (route.request().method() !== 'GET') return route.fallback();
      pendingReads++; await held; await route.continue();
    });
    await page.evaluate(() => history.back());
    await expect.poll(() => pendingReads).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: actionName, exact: true })).toHaveCount(0);
    expect(writes).toBe(1); expect(state()).toEqual(before);
    release(); await ready(page);
    await expect(page).toHaveURL(currentUrl);
    await expect.poll(() => completedReads).toBeGreaterThan(1);
    if (intent === 'start') {
      if (committed) await expect(page.getByRole('link', { name: 'Review ready activations' })).toBeVisible();
      else await expect(page.getByRole('button', { name: 'Start goal', exact: true })).toBeEnabled();
    } else if (intent === 'dispatch-plan') await expect(page.getByRole('button', { name: 'Dispatch all', exact: true })).toBeEnabled({ enabled: !committed });
    else await expect(page.getByRole('button', { name: committed ? 'Stop requested' : 'Request stop', exact: true })).toBeEnabled({ enabled: !committed });
    expect(writes).toBe(1); expect(state()).toEqual(before);
    await testInfo.attach('readback-boundary-observation', { body: JSON.stringify({ intent, committed, width, writes, refreshReads, completedReads, pendingReads, persistedUnchanged: true }), contentType: 'application/json' });
    await capture(page, testInfo, `readback-history-${intent}-${committed}-${width}`);
  });
}
