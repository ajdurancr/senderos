import { capture, expect, goalAttempts, goalRuns, reload, runtime, scenarioScope, state, test, visit } from './fixtures';

test('recorded host recovery guides operators without mutating claims or launching replacement work', async ({ page, scenario }, testInfo) => {
  const scope = scenarioScope(scenario);
  const title = `Recovery inspection ${scenario.id.slice(0, 8)}`;
  await visit(page, `/projects/${scenario.launchProject}/goals/new${scope}`);
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
  await page.getByRole('combobox', { name: 'Sendero', exact: true }).selectOption(scenario.prerequisiteVersionId);
  await page.getByRole('button', { name: 'Create goal', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start goal', exact: true })).toBeVisible();
  const goal = state().goals.find(item => item.title === title)!;
  await page.getByRole('button', { name: 'Start goal', exact: true }).click();
  await page.getByRole('link', { name: 'Review ready activations' }).click();
  await page.getByRole('button', { name: 'Dispatch all' }).click();
  await expect.poll(() => goalAttempts(goal.id).length).toBe(1);
  const attempt = goalAttempts(goal.id)[0]!;
  runtime('host-claim', attempt.id); runtime('host-start', attempt.id);
  const path = `/projects/${scenario.launchProject}/runs/attempts/${attempt.id}${scope}`;
  for (const [outcome, heading] of [
    ['unknown', 'Keep recovery blocked'],
    ['missing', 'Independently confirm the process stopped'],
    ['active', 'Continue the existing session'],
  ]) {
    runtime(`host-reconcile-${outcome}`, attempt.id);
    const before = state();
    await visit(page, path);
    const guidance = page.getByRole('region', { name: 'Recovery next step' });
    await expect(guidance.getByRole('heading', { name: heading })).toBeVisible();
    await expect(guidance.getByRole('button')).toHaveCount(0);
    await page.getByText('Host and session records', { exact: true }).click();
    await expect(page.getByText(`Recovery observation: Deterministic fixture inspection: ${outcome}`, { exact: true })).toBeVisible();
    await reload(page);
    await expect(guidance.getByRole('heading', { name: heading })).toBeVisible();
    expect(state().claims).toEqual(before.claims);
    expect(state().attempts).toEqual(before.attempts);
    expect(goalRuns(goal.id)).toHaveLength(1);
  }
  const guidance = page.getByRole('region', { name: 'Recovery next step' });
  await guidance.scrollIntoViewIfNeeded();
  await capture(page, testInfo, 'recovery-active-desktop-1440x1000');
  await page.setViewportSize({ width: 390, height: 844 });
  await guidance.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture(page, testInfo, 'recovery-active-mobile-390x844');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await visit(page, `/projects/${scenario.launchProject}/canvas/goals/${goal.id}${scope}`);
  await page.getByRole('button', { name: 'Request stop', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm stop', exact: true }).click();
  await expect.poll(() => state().claims.find(item => item.attemptId === attempt.id)?.cancellationRequestedAt).toBeTruthy();
  await visit(page, path);
  await expect(guidance.getByRole('heading', { name: 'Wait for host acknowledgement' })).toBeVisible();
  expect(goalAttempts(goal.id)[0]!.status).toBe('running');
  runtime('host-cancel', attempt.id);
  await reload(page);
  await expect(guidance.getByRole('heading', { name: 'Attempt settled' })).toBeVisible();
  await expect(guidance).toContainText('retained history');
  expect(goalAttempts(goal.id)[0]!.status).toBe('canceled');
  expect(state().claims.find(item => item.attemptId === attempt.id)?.recoveryOutcome).toBe('active');
  expect(goalRuns(goal.id)).toHaveLength(1);
});
