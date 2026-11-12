import { capture, expect, ready, reload, runtime, state, test, visit } from './fixtures';
for (const width of [1440, 390]) test(`identifies command search ownership at ${width}px`, async ({ page, scenario }, testInfo) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  const secondId = crypto.randomUUID(); runtime('prepare-test', secondId);
  const owners = [scenario.id, secondId]; const goals = [];
  for (const id of owners) {
    await visit(page, `/projects/launch-${id}/goals/new?context=product-${id}&project=launch-${id}`);
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Shared searchable outcome');
    await page.getByRole('combobox', { name: 'Sendero', exact: true }).selectOption(scenario.prerequisiteVersionId);
    await page.getByRole('button', { name: 'Create goal', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Start goal', exact: true })).toBeVisible();
    goals.push(state().goals.find(item => item.projectId === `launch-${id}` && item.title === 'Shared searchable outcome')!);
  }
  const before = state(); await visit(page, '/now');
  for (const [index, goal] of goals.entries()) {
    await page.getByRole('button', { name: 'Search or run a command' }).click();
    await page.getByRole('textbox', { name: 'Search commands' }).fill('Shared searchable outcome');
    const row = page.getByRole('dialog', { name: 'Command palette' }).locator(`a[href="/projects/${goal.projectId}/canvas/goals/${goal.id}"]`);
    await expect(row).toBeVisible();
    if (index === 0) {
      await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
      // Other fixtures can also match; select this exact owning result.
      await row.focus(); await expect(row).toBeFocused(); await page.keyboard.press('Enter');
    } else await row.click();
    await ready(page);
    await expect(page).toHaveURL(url => url.pathname === `/projects/${goal.projectId}/canvas/goals/${goal.id}`);
    await expect(page.getByRole('combobox', { name: 'Project', exact: true })).toHaveValue(goal.projectId);
    await page.goBack(); await ready(page);
  }
  expect(state()).toEqual(before);
  await page.getByRole('button', { name: 'Search or run a command' }).click();
  await page.getByRole('textbox', { name: 'Search commands' }).fill('Shared searchable outcome');
  await capture(page, testInfo, `command-ownership-final-${width}`);
  for (const [index, goal] of goals.entries()) {
    const row = page.getByRole('dialog', { name: 'Command palette' }).locator(`a[href="/projects/${goal.projectId}/canvas/goals/${goal.id}"]`);
    await expect(row).toContainText(`Product team ${owners[index]!.slice(0, 8)}`);
    await expect(row).toContainText('Website launch');
    await expect(row).toHaveAccessibleName(new RegExp(`Shared searchable outcome.*Goal.*Product team ${owners[index]!.slice(0, 8)}.*Website launch`));
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Search or run a command' })).toBeFocused();
  await reload(page);
  for (const [index, goal] of goals.entries()) {
    await page.getByRole('combobox', { name: 'Execution context', exact: true }).selectOption(`product-${owners[index]}`);
    await expect(page).toHaveURL(url => url.searchParams.get('context') === `product-${owners[index]}`);
    await ready(page);
    await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(goal.projectId);
    await expect(page).toHaveURL(url => url.searchParams.get('project') === goal.projectId);
    await expect(page.getByRole('combobox', { name: 'Project', exact: true })).toHaveValue(goal.projectId);
    await ready(page); await reload(page);
    await expect(page.getByRole('combobox', { name: 'Project', exact: true })).toHaveValue(goal.projectId);
    await page.getByRole('button', { name: 'Search or run a command' }).click();
    await page.getByRole('textbox', { name: 'Search commands' }).fill('Shared searchable outcome');
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    const ownedResult = palette.locator(`a[href^="/projects/${goal.projectId}/canvas/goals/${goal.id}?"]`);
    await expect(ownedResult).toContainText(`Product team ${owners[index]!.slice(0, 8)}`);
    const destination = new URL((await ownedResult.getAttribute('href'))!, page.url());
    expect(destination.pathname).toBe(`/projects/${goal.projectId}/canvas/goals/${goal.id}`);
    expect(destination.searchParams.get('context')).toBe(`product-${owners[index]}`);
    expect(destination.searchParams.get('project')).toBe(goal.projectId);
    await expect(palette.locator(`a[href*="/goals/${goals[1 - index]!.id}"]`)).toHaveCount(0);
    await page.keyboard.press('Escape');
    expect(state()).toEqual(before);
  }
});
