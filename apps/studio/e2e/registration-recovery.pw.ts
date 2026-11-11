import { capture, expect, ready, scenarioScope, state, test, visit } from './fixtures';

for (const width of [1440, 390]) {
  for (const kind of ['context', 'project'] as const) {
    test(`keeps ${kind} registration accurate while pending and after a lost committed response at ${width}px`, async ({ page, scenario }, testInfo) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await visit(page, `/settings${scenarioScope(scenario)}`);
      await page.getByText(kind === 'context' ? 'Add an execution context' : 'Add a project', { exact: true }).click();
      const input = page.getByRole('textbox', { name: kind === 'context' ? /^Context name/ : /^Project name/ });
      const name = `Recovery ${kind} ${scenario.id.slice(0, 8)}`;
      await input.fill(name);
      const before = state();
      let release!: () => void;
      const held = new Promise<void>(resolve => { release = resolve; });
      let writes = 0;
      await page.route('**/*.data*', async route => {
        if (route.request().method() !== 'POST') return route.continue();
        writes++;
        const response = await route.fetch();
        expect(response.ok()).toBe(true);
        await held;
        await route.abort('failed');
      });
      await page.getByRole('button', { name: kind === 'context' ? 'Add context' : 'Add project', exact: true }).click();
      await expect.poll(() => (kind === 'context' ? state().executionContexts : state().projects).filter(item => item.name === name).length).toBe(1);
      // The submitted identity is already committed; editing it would misrepresent this save.
      const pendingDisabled = await input.isDisabled();
      if (kind === 'project') await expect(page.getByRole('combobox', { name: /^Project execution context/ })).toBeDisabled();
      release();
      await expect(input).toBeVisible();
      await expect(page.getByRole('alert')).toContainText(`could not confirm the ${kind === 'context' ? 'execution context' : 'project'} registration`);
      await expect(page.getByRole('alert')).toContainText('may have reached the server');
      await expect(input).toHaveValue(name);
      expect(pendingDisabled).toBe(true);
      expect(writes).toBe(1);
      await page.getByRole('alert').scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await capture(page, testInfo, `registration-${kind}-response-loss-${width}`);
      await page.unroute('**/*.data*');
      await page.reload(); await ready(page);
      // Reload exposes the committed identity without selecting a different scope.
      expect(new URL(page.url()).searchParams.get('context')).toBe(scenario.productContext);
      expect(new URL(page.url()).searchParams.get('project')).toBe(scenario.launchProject);
      const committed = (kind === 'context' ? state().executionContexts : state().projects).find(item => item.name === name)!;
      await expect(page.getByRole('combobox', { name: kind === 'context' ? 'Execution context' : 'Project', exact: true }).locator(`option[value="${committed.id}"]`)).toHaveText(name);
      await page.getByText(kind === 'context' ? 'Add an execution context' : 'Add a project', { exact: true }).click();
      await input.fill(name);
      await page.getByRole('button', { name: kind === 'context' ? 'Add context' : 'Add project', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText(kind === 'context' ? 'already in use' : 'already exists in this context');
      await expect(input).toHaveValue(name);
      const after = state();
      const records = kind === 'context' ? after.executionContexts : after.projects;
      expect(records.filter(item => item.name === name)).toHaveLength(1);
      expect(after.executionContexts.length).toBe(before.executionContexts.length + (kind === 'context' ? 1 : 0));
      expect(after.projects.length).toBe(before.projects.length + (kind === 'project' ? 1 : 0));
      expect(after.goals).toEqual(before.goals);
      expect(after.runs).toEqual(before.runs);
    });
  }
}
