import { capture, expect, goalAttempts, ready, scenarioScope, state, test, visit } from './fixtures';
import type { Page } from '@playwright/test';
import type { Scenario } from './fixtures';

async function openAttempt(page: Page, scenario: Scenario) {
  const scope = scenarioScope(scenario), title = `Budget draft audit ${scenario.id}`;
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
  return { goal, attempt };
}

for (const width of [1440, 390]) {
  test(`protects simultaneous budget drafts on project scope change at ${width}px`, async ({ page, scenario }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await openAttempt(page, scenario);
    await visit(page, `/now${scenarioScope(scenario)}`);
    await page.goBack(); await ready(page);
    await page.getByRole('spinbutton', { name: 'Activation limit', exact: true }).fill('80');
    await page.getByRole('spinbutton', { name: 'Attempt limit per activation', exact: true }).fill('7');
    const before = state();
    await capture(page, testInfo, `budget-drafts-before-scope-${width}`);
    await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(scenario.campaignProject);
    expect(state()).toEqual(before);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await capture(page, testInfo, `budget-drafts-guard-${width}`);
    await dialog.getByRole('button', { name: 'Stay here' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('spinbutton', { name: 'Activation limit', exact: true })).toHaveValue('80');
    await expect(page.getByRole('spinbutton', { name: 'Attempt limit per activation', exact: true })).toHaveValue('7');
    await page.getByLabel('Evidence label', { exact: true }).fill('Independent proof');
    await page.getByLabel('Decision rationale').fill('Independent rationale');
    await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(scenario.campaignProject);
    await expect(dialog).toContainText('evidence, review and execution budgets');
    await expect(dialog).toHaveCount(1);
    await expect(dialog.getByRole('button', { name: 'Stay here' })).toBeFocused();
    await capture(page, testInfo, `inspector-all-drafts-guard-${width}`);
    await dialog.getByRole('button', { name: 'Stay here' }).click();
    await expect(dialog).toHaveCount(0);
    for (const direction of ['back', 'forward'] as const) {
      const prompt = page.waitForEvent('dialog');
      await page.evaluate(direction => history[direction](), direction);
      const nativeDialog = await prompt;
      expect(nativeDialog.type()).toBe('beforeunload');
      await nativeDialog.dismiss();
      await expect(page.getByRole('spinbutton', { name: 'Activation limit', exact: true })).toHaveValue('80');
    }
    await page.getByRole('button', { name: 'Discard activation limit draft' }).click();
    await expect(page.getByRole('spinbutton', { name: 'Attempt limit per activation', exact: true })).toHaveValue('7');
    await expect(page.getByLabel('Evidence label', { exact: true })).toHaveValue('Independent proof');
    await page.getByRole('button', { name: 'Discard attempt limit draft' }).click();
    await expect(page.getByLabel('Decision rationale')).toHaveValue('Independent rationale');
    await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(scenario.campaignProject);
    await dialog.getByRole('button', { name: 'Leave editor' }).click();
    await expect(page.getByRole('spinbutton', { name: 'Activation limit', exact: true })).toHaveCount(0);
    expect(state()).toEqual(before);
  });
}

for (const intent of ['set-activation-budget', 'set-retry-budget'] as const) {
  test(`retains both budget drafts after a committed ${intent} response is lost`, async ({ page, scenario }, testInfo) => {
    const { goal } = await openAttempt(page, scenario);
    await page.getByRole('spinbutton', { name: 'Activation limit', exact: true }).fill('80');
    await page.getByRole('spinbutton', { name: 'Attempt limit per activation', exact: true }).fill('7');
    await page.getByLabel('Evidence label', { exact: true }).fill('Retained proof');
    await page.getByLabel('Decision rationale').fill('Retained rationale');
    let writes = 0;
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/*.data*', async route => {
      const request = route.request();
      if (request.method() !== 'POST' || new URLSearchParams(request.postData() ?? '').get('intent') !== intent) return route.continue();
      writes++;
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      await held;
      await route.abort('failed');
    });
    await page.getByRole('button', { name: intent === 'set-activation-budget' ? 'Save activation limit' : 'Save attempt limit', exact: true }).click();
    await expect.poll(() => {
      const execution = state().executions.find(item => item.goalId === goal.id)!;
      return intent === 'set-activation-budget' ? execution.maxActivations : execution.maxAttempts;
    }).toBe(intent === 'set-activation-budget' ? 80 : 7);
    await expect(page.getByRole('spinbutton', { name: 'Activation limit', exact: true })).toBeDisabled();
    await expect(page.getByRole('spinbutton', { name: 'Attempt limit per activation', exact: true })).toBeDisabled();
    await expect(page.getByLabel('Evidence label', { exact: true })).toBeDisabled();
    await page.getByRole('form', { name: intent === 'set-activation-budget' ? 'Change activation limit' : 'Change attempt limit' }).evaluate((form: HTMLFormElement) => { form.requestSubmit(); });
    expect(writes).toBe(1);
    await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(scenario.campaignProject);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('may still finish');
    await dialog.getByRole('button', { name: 'Stay here' }).click();
    release();
    await expect(page.getByRole('alert')).toContainText('could not confirm');
    await expect(page.getByRole('alert')).toContainText('inspect persisted execution budgets');
    await expect(page.getByRole('spinbutton', { name: 'Activation limit', exact: true })).toHaveValue('80');
    await expect(page.getByRole('spinbutton', { name: 'Attempt limit per activation', exact: true })).toHaveValue('7');
    expect(writes).toBe(1);
    await expect(page.getByLabel('Evidence label', { exact: true })).toHaveValue('Retained proof');
    await expect(page.getByLabel('Decision rationale')).toHaveValue('Retained rationale');
    await capture(page, testInfo, `budget-${intent}-lost-response`);
    await page.unroute('**/*.data*');
    for (const name of ['Discard activation limit draft', 'Discard attempt limit draft', 'Discard evidence draft', 'Discard review draft']) await page.getByRole('button', { name }).click();
    await page.reload(); await ready(page);
    await expect(page.getByRole('spinbutton', { name: intent === 'set-activation-budget' ? 'Activation limit' : 'Attempt limit per activation', exact: true })).toHaveValue(intent === 'set-activation-budget' ? '80' : '7');
    expect(writes).toBe(1);
  });
}

test('confirmed budget saves keep other valid inspector drafts and do not dispatch work', async ({ page, scenario }, testInfo) => {
  const { goal } = await openAttempt(page, scenario);
  const beforeAttempts = goalAttempts(goal.id);
  await page.getByLabel('Evidence label', { exact: true }).fill('Unsaved independent proof');
  await page.getByLabel('Decision rationale').fill('Unsaved independent decision');
  await page.getByRole('spinbutton', { name: 'Activation limit', exact: true }).fill('80');
  await page.getByRole('spinbutton', { name: 'Attempt limit per activation', exact: true }).fill('7');
  await page.getByRole('button', { name: 'Save activation limit', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Discard activation limit draft' })).toBeDisabled();
  await expect(page.getByRole('spinbutton', { name: 'Attempt limit per activation', exact: true })).toHaveValue('7');
  await expect(page.getByLabel('Evidence label', { exact: true })).toHaveValue('Unsaved independent proof');
  await page.getByRole('button', { name: 'Save attempt limit', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Discard attempt limit draft' })).toBeDisabled();
  await expect(page.getByLabel('Decision rationale')).toHaveValue('Unsaved independent decision');
  expect(state().executions.find(item => item.goalId === goal.id)).toMatchObject({ maxActivations: 80, maxAttempts: 7 });
  expect(goalAttempts(goal.id)).toEqual(beforeAttempts);
  await capture(page, testInfo, 'budget-confirmed-independent-drafts');
  await page.getByRole('button', { name: 'Discard evidence draft' }).click();
  await page.getByRole('button', { name: 'Discard review draft' }).click();
  await page.reload(); await ready(page);
  await expect(page.getByRole('spinbutton', { name: 'Activation limit', exact: true })).toHaveValue('80');
  await expect(page.getByRole('spinbutton', { name: 'Attempt limit per activation', exact: true })).toHaveValue('7');
});
