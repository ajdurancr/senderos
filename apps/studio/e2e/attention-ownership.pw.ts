import { capture, expect, ready, reload, runtime, state, test, visit } from './fixtures';

for (const width of [1440, 390]) test(`identifies attention ownership across duplicate outcomes at ${width}px`, async ({ page, scenario }, testInfo) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  const secondId = crypto.randomUUID();
  runtime('prepare-test', secondId);
  const owners = [scenario.id, secondId];
  const goals = [];
  for (const id of owners) {
    await visit(page, `/projects/launch-${id}/goals/new?context=product-${id}&project=launch-${id}`);
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Shared attention outcome');
    await page.getByRole('combobox', { name: 'Sendero', exact: true }).selectOption(scenario.prerequisiteVersionId);
    await page.getByRole('button', { name: 'Create goal', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Start goal', exact: true })).toBeVisible();
    const goal = state().goals.find(item => item.projectId === `launch-${id}` && item.title === 'Shared attention outcome')!;
    await page.getByRole('button', { name: 'Start goal', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Review ready activations' })).toBeVisible();
    goals.push(goal);
  }
  const before = state();
  await visit(page, '/now?filter=dispatchable');
  for (const [index, goal] of goals.entries()) {
    const destination = `/projects/${goal.projectId}/canvas/goals/${goal.id}?plan=true`;
    const ownedRow = page.locator(`.attention-list > a[href="${destination}"]`);
    await expect(ownedRow.getByRole('heading')).toHaveText(goal.title);
    await expect(ownedRow).toBeVisible();
    await expect(ownedRow).toHaveAttribute('href', destination);
    if (index === 0) { await ownedRow.focus(); await ownedRow.press('Enter'); } else await ownedRow.click();
    await ready(page);
    await expect(page).toHaveURL(url => url.pathname === `/projects/${goal.projectId}/canvas/goals/${goal.id}` && url.searchParams.get('plan') === 'true');
    await expect(page.getByRole('combobox', { name: 'Project', exact: true })).toHaveValue(goal.projectId);
    await expect(page.getByRole('link', { name: 'Review ready activations' })).toBeVisible();
    await page.goBack(); await ready(page);
  }
  expect(state()).toEqual(before);
  await page.locator('.attention-list').scrollIntoViewIfNeeded();
  await capture(page, testInfo, `attention-ownership-final-${width}`);
  for (const [index, goal] of goals.entries()) {
    const row = page.locator(`.attention-list > a[href="/projects/${goal.projectId}/canvas/goals/${goal.id}?plan=true"]`);
    await expect(row).toContainText(`Product team ${owners[index]!.slice(0, 8)}`);
    await expect(row).toContainText('Website launch');
  }
  await reload(page);
  expect(state()).toEqual(before);
  for (const [index, goal] of goals.entries()) {
    await page.getByRole('combobox', { name: 'Execution context', exact: true }).selectOption(`product-${owners[index]}`);
    await ready(page);
    await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(goal.projectId);
    await ready(page);
    await expect(page.locator(`.attention-list > a[href*="/goals/${goal.id}?"]`)).toContainText(`Product team ${owners[index]!.slice(0, 8)}`);
    await expect(page.locator(`.attention-list > a[href*="/goals/${goals[1 - index]!.id}?"]`)).toHaveCount(0);
    await reload(page);
    await expect(page.getByRole('combobox', { name: 'Project', exact: true })).toHaveValue(goal.projectId);
    expect(state()).toEqual(before);
  }
});
