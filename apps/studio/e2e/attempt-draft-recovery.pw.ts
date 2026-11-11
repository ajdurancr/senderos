import { capture, expect, goalAttempts, ready, scenarioScope, state, test, visit } from './fixtures';

for (const width of [1440, 390]) {
  test(`protects unsaved evidence and review drafts on scope change at ${width}px`, async ({ page, scenario }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const scope = scenarioScope(scenario), title = `Evidence draft audit ${scenario.id}`;
    await visit(page, `/projects/${scenario.launchProject}/goals/new${scope}`);
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
    await page.getByRole('combobox', { name: 'Sendero', exact: true }).selectOption(scenario.prerequisiteVersionId);
    await page.getByRole('button', { name: 'Create goal', exact: true }).click();
    await page.getByRole('button', { name: 'Start goal', exact: true }).click();
    const goal = state().goals.find(item => item.title === title)!;
    await page.getByRole('link', { name: 'Review ready activations' }).click();
    await page.getByRole('button', { name: 'Dispatch all' }).click();
    await expect.poll(() => goalAttempts(goal.id).length).toBe(1);
    const attempt = goalAttempts(goal.id)[0]!;
    await visit(page, `/projects/${scenario.launchProject}/canvas/goals/${goal.id}/attempts/${attempt.id}${scope}`);
    await visit(page, `/now${scope}`);
    await page.goBack();
    await ready(page);
    await page.getByLabel('Evidence label', { exact: true }).fill('Unsaved acceptance proof');
    await page.getByLabel('Evidence summary (optional)', { exact: true }).fill('Keep the observed result until explicitly discarded.');
    await page.getByLabel('Decision rationale', { exact: true }).fill('Unsubmitted review rationale');
    const before = state();
    await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(scenario.campaignProject);

    expect(state()).toEqual(before);
    const dialog = page.getByRole('dialog', { name: 'Leave evidence and review editor?' });
    await expect(dialog).toBeVisible();
    await capture(page, testInfo, `evidence-draft-guard-${width}`);
    await dialog.getByRole('button', { name: 'Stay here' }).click();
    await expect(page.getByLabel('Evidence label', { exact: true })).toHaveValue('Unsaved acceptance proof');
    await expect(page.getByLabel('Decision rationale')).toHaveValue('Unsubmitted review rationale');
    await page.getByRole('button', { name: 'Discard evidence draft' }).click();
    await expect(page.getByLabel('Evidence label', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Decision rationale')).toHaveValue('Unsubmitted review rationale');
    for (const direction of ['back', 'forward'] as const) {
      const prompt = page.waitForEvent('dialog');
      await page.evaluate(direction => history[direction](), direction);
      const nativeDialog = await prompt;
      expect(nativeDialog.type()).toBe('beforeunload');
      await nativeDialog.dismiss();
      await expect(page.getByLabel('Decision rationale')).toHaveValue('Unsubmitted review rationale');
    }
    await page.getByRole('button', { name: 'Discard review draft' }).click();
    await page.getByLabel('Evidence label', { exact: true }).fill('Confirmed leave');
    await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(scenario.campaignProject);
    await dialog.getByRole('button', { name: 'Leave editor' }).click();
    await expect(page.getByLabel('Evidence label', { exact: true })).toHaveCount(0);
    expect(state()).toEqual(before);
  });
}

for (const intent of ['evidence', 'review'] as const) {
  test(`retains simultaneous drafts after a committed ${intent} response is lost`, async ({ page, scenario }, testInfo) => {
    const scope = scenarioScope(scenario), title = `Evidence draft audit ${scenario.id}`;
    await visit(page, `/projects/${scenario.launchProject}/goals/new${scope}`);
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
    await page.getByRole('combobox', { name: 'Sendero', exact: true }).selectOption(scenario.prerequisiteVersionId);
    await page.getByRole('button', { name: 'Create goal', exact: true }).click();
    await page.getByRole('button', { name: 'Start goal', exact: true }).click();
    const goal = state().goals.find(item => item.title === title)!;
    await page.getByRole('link', { name: 'Review ready activations' }).click();
    await page.getByRole('button', { name: 'Dispatch all' }).click();
    await expect.poll(() => goalAttempts(goal.id).length).toBe(1);
    const attempt = goalAttempts(goal.id)[0]!;
    await visit(page, `/projects/${scenario.launchProject}/canvas/goals/${goal.id}/attempts/${attempt.id}${scope}`);

    await page.getByLabel('Evidence label', { exact: true }).fill('Committed proof');
    await page.getByLabel('Decision rationale').fill('Committed rationale');
    let writes = 0;
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/*.data*', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      writes++;
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      await held;
      await route.abort('failed');
    });
    await page.getByRole('button', { name: intent === 'evidence' ? 'Record evidence' : 'Record decision', exact: true }).click();
    const saved = () => JSON.parse(state().attempts.find(item => item.id === attempt.id)!.statusSnapshotJson);
    await expect.poll(() => intent === 'evidence' ? saved().evidence?.length : saved().review?.rationale).toBe(intent === 'evidence' ? 1 : 'Committed rationale');
    await expect(page.getByLabel('Evidence label', { exact: true })).toBeDisabled();
    await expect(page.getByLabel('Decision rationale')).toBeDisabled();
    await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(scenario.campaignProject);
    const dialog = page.getByRole('dialog', { name: 'Leave evidence and review editor?' });
    await expect(dialog).toContainText('may still finish');
    await dialog.getByRole('button', { name: 'Stay here' }).click();
    release();
    await expect(page.getByRole('alert')).toContainText('could not confirm');
    await expect(page.getByRole('alert')).toContainText('before submitting again');
    await expect(page.getByLabel('Evidence label', { exact: true })).toHaveValue('Committed proof');
    await expect(page.getByLabel('Decision rationale')).toHaveValue('Committed rationale');
    expect(writes).toBe(1);
    await capture(page, testInfo, `attempt-${intent}-lost-response`);
    await page.unroute('**/*.data*');
    await page.getByRole('button', { name: 'Discard evidence draft' }).click();
    await page.getByRole('button', { name: 'Discard review draft' }).click();
    await page.reload();
    if (intent === 'evidence') await expect(page.getByText('Committed proof', { exact: true })).toBeVisible();
    else await expect(page.getByText(/Current review:/)).toContainText('approved');
    expect(writes).toBe(1);
  });
}

test('confirmed submissions reset only their own draft and preserve persisted readback', async ({ page, scenario }, testInfo) => {
  const scope = scenarioScope(scenario), title = `Confirmed evidence ${scenario.id}`;
  await visit(page, `/projects/${scenario.launchProject}/goals/new${scope}`);
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
  await page.getByRole('combobox', { name: 'Sendero', exact: true }).selectOption(scenario.prerequisiteVersionId);
  await page.getByRole('button', { name: 'Create goal', exact: true }).click();
  await page.getByRole('button', { name: 'Start goal', exact: true }).click();
  const goal = state().goals.find(item => item.title === title)!;
  await page.getByRole('link', { name: 'Review ready activations' }).click();
  await page.getByRole('button', { name: 'Dispatch all' }).click();
  await expect.poll(() => goalAttempts(goal.id).length).toBe(1);
  const attempt = goalAttempts(goal.id)[0]!;
  await visit(page, `/projects/${scenario.launchProject}/canvas/goals/${goal.id}/attempts/${attempt.id}${scope}`);
  await page.getByLabel('Evidence label', { exact: true }).fill('Confirmed evidence');
  await page.getByLabel('Decision rationale').fill('Independent review draft');
  await page.getByRole('button', { name: 'Record evidence', exact: true }).click();
  await expect(page.getByLabel('Evidence label', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Decision rationale')).toHaveValue('Independent review draft');
  // An accidental second click cannot replay the cleared, required evidence label.
  await page.getByRole('button', { name: 'Record evidence', exact: true }).click();
  expect(JSON.parse(state().attempts.find(item => item.id === attempt.id)!.statusSnapshotJson).evidence).toHaveLength(1);
  await page.getByLabel('Evidence label', { exact: true }).fill('Independent evidence draft');
  await page.getByRole('combobox', { name: 'Review decision', exact: true }).selectOption('rejected');
  await page.getByRole('button', { name: 'Record decision', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Discard review draft' })).toBeDisabled();
  await expect(page.getByLabel('Decision rationale')).toHaveValue('Independent review draft');
  await expect(page.getByRole('combobox', { name: 'Review decision', exact: true })).toHaveValue('rejected');
  await page.getByRole('button', { name: 'Record decision', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Record decision', exact: true })).toBeEnabled();
  expect(JSON.parse(state().attempts.find(item => item.id === attempt.id)!.statusSnapshotJson).review.status).toBe('rejected');
  await expect(page.getByLabel('Evidence label', { exact: true })).toHaveValue('Independent evidence draft');
  await capture(page, testInfo, 'attempt-confirmed-independent-drafts');
  await page.getByRole('button', { name: 'Discard evidence draft' }).click();
  await page.reload();
  await expect(page.getByText('Confirmed evidence', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Recorded review' })).toContainText('Independent review draft');
});
