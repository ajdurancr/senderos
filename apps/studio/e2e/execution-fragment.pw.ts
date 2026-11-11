import { capture, expect, goalAttempts, ready, reload, runtime, scenarioScope, state, test, visit } from './fixtures';

for (const committed of [true, false]) for (const width of [1440, 390]) for (const intent of ['dispatch-plan', 'cancel-goal'] as const) {
  test(`holds uncertain ${intent} across fragment navigation (${committed ? "committed" : "unapplied"}) without replay at ${width}px`, async ({ page, scenario }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const scope = scenarioScope(scenario), title = `Confirmation recovery ${scenario.id}`;
    await visit(page, `/projects/${scenario.launchProject}/goals/new${scope}`);
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
    await page.getByRole('combobox', { name: 'Sendero', exact: true }).selectOption(scenario.prerequisiteVersionId);
    await page.getByRole('button', { name: 'Create goal', exact: true }).click();
    await page.getByRole('button', { name: 'Start goal', exact: true }).click();
    await page.getByRole('link', { name: 'Review ready activations' }).click();
    await expect(page.getByRole('button', { name: 'Dispatch all', exact: true })).toBeVisible();
    const goal = state().goals.find(item => item.title === title)!;
    let attemptId: string | undefined;
    if (intent === 'cancel-goal') {
      await page.getByRole('button', { name: 'Dispatch all' }).click();
      await expect.poll(() => goalAttempts(goal.id).length).toBe(1);
      attemptId = goalAttempts(goal.id)[0]!.id;
      runtime('host-claim', attemptId); runtime('host-start', attemptId);
      await visit(page, `/projects/${scenario.launchProject}/canvas/goals/${goal.id}/attempts/${attemptId}${scope}#recovery`);
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
    let reads = 0;
    let replays = 0;
    let releaseReads!: () => void;
    const heldReads = new Promise<void>(resolve => { releaseReads = resolve; });
    await page.route('**/*.data*', async route => {
      if (route.request().method() === 'POST') { replays++; return route.abort('failed'); }
      if (route.request().method() === 'GET') { reads++; await heldReads; }
      return route.continue();
    });
    const before = state();
    await page.evaluate(() => { window.location.hash = 'fragment-readback-audit'; });
    await expect(page).toHaveURL(/#fragment-readback-audit$/);
    const repeat = page.getByRole('button', { name: intent === 'dispatch-plan' ? 'Dispatch all' : 'Confirm stop', exact: true });
    try {
      await expect(repeat).toBeDisabled();
      expect(reads).toBe(0);
      await repeat.evaluate(button => button.closest('form')!.requestSubmit());
      expect(replays).toBe(0);
      expect(state()).toEqual(before);
    } finally {
      await testInfo.attach('fragment-readback-observation', { body: JSON.stringify({ reads, writes, replays, disabled: await repeat.isDisabled(), persistedUnchanged: JSON.stringify(state()) === JSON.stringify(before) }), contentType: 'application/json' });
      await capture(page, testInfo, `fragment-readback-${intent}-${committed}-${width}`);
      releaseReads();
    }
    expect(writes).toBe(1);
    // Exercise the existing production link, then verify authoritative readback.
    const scopedUrl = page.url();
    let documents = 0;
    page.on('request', request => { if (request.isNavigationRequest() && request.method() === 'GET') documents++; });
    await page.unroute('**/*.data*');
    const readback = page.getByRole('link', { name: intent === 'dispatch-plan' ? 'Reload persisted runs and ready activations' : 'Reload cancellation and host acknowledgements', exact: true });
    await readback.focus();
    await Promise.all([page.waitForEvent('load'), width === 1440 ? page.keyboard.press('Enter') : readback.click()]);
    await ready(page);
    const beforeUrl = new URL(scopedUrl), afterUrl = new URL(page.url());
    expect(`${afterUrl.pathname}${afterUrl.search}`).toBe(`${beforeUrl.pathname}${beforeUrl.search}`);
    expect(documents).toBe(1);
    expect(state()).toEqual(before);
    await capture(page, testInfo, `fragment-authoritative-readback-${intent}-${committed}-${width}`);
    if (!committed) {
      if (intent === 'cancel-goal') await page.getByRole('button', { name: 'Request stop', exact: true }).click();
      await expect(page.getByRole('button', { name: intent === 'dispatch-plan' ? 'Dispatch all' : 'Confirm stop', exact: true })).toBeEnabled();
    }
    expect(replays).toBe(0);
  });
}
