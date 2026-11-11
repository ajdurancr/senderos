import { capture, expect, ready, scenarioScope, state, test, visit } from './fixtures';

for (const width of [1440, 390]) {
  test(`retains project settings after a committed response is lost at ${width}px`, async ({ page, scenario }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await visit(page, `/settings${scenarioScope(scenario)}`);
    const name = page.getByRole('textbox', { name: /^Name\b/ });
    await name.fill('Unconfirmed committed settings');
    const before = state();
    let writes = 0;
    await page.route('**/*.data*', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      writes++;
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      await route.abort('failed');
    });
    await page.getByRole('button', { name: 'Save project', exact: true }).click();
    await expect.poll(() => state().projects.find(item => item.id === scenario.launchProject)?.name).toBe('Unconfirmed committed settings');
    await expect(name).toHaveValue('Unconfirmed committed settings');
    await expect(page.getByRole('alert')).toContainText('could not confirm the project settings save');
    await expect(page.getByRole('alert')).toContainText('may have reached the server');
    await capture(page, testInfo, `settings-response-loss-${width}`);
    expect(writes).toBe(1);
    expect(state().projects.find(item => item.id === scenario.campaignProject)).toEqual(before.projects.find(item => item.id === scenario.campaignProject));
    await page.unroute('**/*.data*');
    await name.fill('Still unsaved recovery input');
    await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(scenario.campaignProject);
    await page.getByRole('dialog', { name: 'Leave project settings editor?' }).getByRole('button', { name: 'Leave editor' }).click();
    await ready(page);
    await expect(name).toHaveValue(before.projects.find(item => item.id === scenario.campaignProject)!.name);
    await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(scenario.launchProject);
    await expect(name).toHaveValue('Unconfirmed committed settings');
    expect(writes).toBe(1);
    expect(state().goals).toEqual(before.goals);
    expect(state().runs).toEqual(before.runs);
  });
}
