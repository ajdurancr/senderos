import { capture, expect, goalAttempts, ready, reload, runtime, scenarioScope, state, test, visit } from './fixtures';

for (const committed of [true, false]) for (const width of [1440, 390]) for (const intent of ['dispatch-plan', 'cancel-goal'] as const) {
  test(`recovers a lost ${intent} confirmation (${committed ? "committed" : "unapplied"}) without replay at ${width}px`, async ({ page, scenario }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const scope = scenarioScope(scenario), title = `Confirmation recovery ${scenario.id}`;
    await visit(page, `/projects/${scenario.launchProject}/goals/new${scope}`);
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
    await page.getByRole('combobox', { name: 'Sendero', exact: true }).selectOption(scenario.prerequisiteVersionId);
    await page.getByRole('button', { name: 'Create goal', exact: true }).click();
    await page.getByRole('button', { name: 'Start goal', exact: true }).click();
    await page.getByRole('link', { name: 'Review ready activations' }).click();
    const goal = state().goals.find(item => item.title === title)!;
    let attemptId: string | undefined;
    if (intent === 'cancel-goal') {
      await page.getByRole('button', { name: 'Dispatch all' }).click();
      await expect.poll(() => goalAttempts(goal.id).length).toBe(1);
      attemptId = goalAttempts(goal.id)[0]!.id;
      runtime('host-claim', attemptId); runtime('host-start', attemptId);
      await visit(page, `/projects/${scenario.launchProject}/canvas/goals/${goal.id}/attempts/${attemptId}${scope}`);
      await page.getByRole('button', { name: 'Request stop', exact: true }).click();
    }
    let writes = 0;
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/*.data*', async route => {
      if (route.request().method() !== 'POST' || !route.request().postData()?.includes(intent)) return route.continue();
      writes++;
      if (committed) { const response = await route.fetch(); expect(response.ok()).toBe(true); }
      await held;
      await route.abort('failed');
    });
    await page.getByRole('button', { name: intent === 'dispatch-plan' ? 'Dispatch all' : 'Confirm stop', exact: true }).click();
    await expect.poll(() => writes).toBe(1);
    const pendingButton = page.getByRole('button', { name: intent === 'dispatch-plan' ? 'Reserving…' : 'Requesting…', exact: true });
    await expect(pendingButton).toBeDisabled();
    await pendingButton.evaluate(button => { button.closest('form')!.requestSubmit(); button.closest('form')!.requestSubmit(); });
    expect(writes).toBe(1);
    release();
    if (committed && intent === 'dispatch-plan') await expect.poll(() => goalAttempts(goal.id).length).toBe(1);
    else if (committed) await expect.poll(() => state().claims.find(item => item.attemptId === attemptId)?.cancellationRequestedAt).toBeTruthy();
    await expect(page.locator('.studio-shell')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(intent === 'dispatch-plan' ? 'could not confirm run reservation' : 'could not confirm the stop request');
    await expect(page.getByRole('button', { name: intent === 'dispatch-plan' ? 'Dispatch all' : 'Confirm stop', exact: true })).toBeDisabled();
    await page.getByRole('alert').scrollIntoViewIfNeeded();
    await capture(page, testInfo, `lost-${intent}-${committed ? "committed" : "unapplied"}-${width}`);
    expect(writes).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.unroute('**/*.data*');
    await reload(page);
    expect(writes).toBe(1);
    if (!committed) {
      if (intent === 'dispatch-plan') expect(goalAttempts(goal.id)).toHaveLength(0);
      else {
        expect(state().claims.find(item => item.attemptId === attemptId)?.cancellationRequestedAt).toBeNull();
        await page.getByRole('button', { name: 'Request stop', exact: true }).click();
      }
      await page.getByRole('button', { name: intent === 'dispatch-plan' ? 'Dispatch all' : 'Confirm stop', exact: true }).click();
      if (intent === 'dispatch-plan') await expect.poll(() => goalAttempts(goal.id).length).toBe(1);
      else await expect(page.getByRole('button', { name: 'Stop requested', exact: true })).toBeDisabled();
    }
    expect(goalAttempts(goal.id)).toHaveLength(1);
    if (intent === 'dispatch-plan') await expect(page.getByRole('button', { name: 'Dispatch all', exact: true })).toBeDisabled();
    else {
      await expect(page.getByText('Waiting for every owning host to acknowledge stopping. Senderos does not terminate external processes.')).toBeVisible();
      expect(goalAttempts(goal.id)[0]!.status).toBe('running');
      runtime('host-cancel', attemptId!); await reload(page);
      expect(state().goals.find(item => item.id === goal.id)?.status).toBe('canceled');
    }
    await ready(page);
  });
}
