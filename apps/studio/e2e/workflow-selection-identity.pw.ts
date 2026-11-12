import { type State, capture, expect, ready, reload, state, test, visit, workflowCreated } from './fixtures';

for (const width of [1440, 390]) test(`distinguishes published workflow identities and preserves pinned assignments at ${width}px`, async ({ page, scenario }, testInfo) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  const title = `Independent workflow ${scenario.id.slice(0, 8)}`;
  const agent = state().agents.find(item => item.status === 'active')!;
  const workflows: { workflow: State['senderos'][number]; version: State['versions'][number] }[] = [];
  const scope = `?context=${scenario.productContext}&project=${scenario.launchProject}`;
  for (const suffix of ['first', 'second']) {
    const definition = { slug: `identity-${suffix}-${scenario.id}`, name: title, nodes: [
      { key: 'start', kind: 'start', label: 'Start' },
      { key: 'agent', kind: 'agent', label: `${suffix} policy`, agentSlug: agent.slug, executionObjective: `Distinct ${suffix} workflow instructions` },
      { key: 'end', kind: 'end', label: 'End' },
    ], edges: [ { key: 'begin', source: 'start', target: 'agent', name: 'Begin' }, { key: 'end', source: 'agent', target: 'end', name: 'Finish' } ] };
    await visit(page, `/senderos/new${scope}`);
    await page.getByRole('combobox', { name: 'Authoring method' }).selectOption('import');
    await page.getByRole('textbox', { name: 'Sendero JSON' }).fill(JSON.stringify(definition));
    await page.getByRole('button', { name: 'Import draft', exact: true }).click();
    await workflowCreated(page);
    await page.getByRole('button', { name: 'Validate & publish draft' }).click();
    await expect(page.getByRole('button', { name: 'Create editable draft' })).toBeVisible();
    const saved = state(); const workflow = saved.senderos.find(item => item.slug === definition.slug)!;
    const version = saved.versions.find(item => item.senderoId === workflow.id && item.status === 'published')!;
    expect(version).toBeTruthy(); workflows.push({ workflow, version });
  }
  const before = state();
  await visit(page, `/projects/${scenario.launchProject}/goals/new${scope}`);
  const select = page.getByRole('combobox', { name: 'Sendero', exact: true });
  for (const { workflow, version } of workflows) {
    await expect(select.locator(`option[value="${version.id}"]`)).toHaveText(`${title} · ${workflow.slug} · v1`);
  }
  await select.selectOption({ label: `${title} · ${workflows[1]!.workflow.slug} · v1` });
  await select.scrollIntoViewIfNeeded();
  await capture(page, testInfo, `workflow-identity-create-${width}`);
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill(`Pinned identity ${scenario.id}`);
  await page.getByRole('button', { name: 'Create goal', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start goal', exact: true })).toBeVisible();
  const created = state();
  const goal = created.goals.find(item => item.title === `Pinned identity ${scenario.id}`)!;
  expect(goal.senderoVersionId).toBe(workflows[1]!.version.id);
  expect(created.runs).toEqual(before.runs);
  expect(created.attempts).toEqual(before.attempts);
  const goalUrl = page.url();
  await reload(page);
  expect(state()).toEqual(created);
  await page.getByRole('button', { name: 'Edit goal', exact: true }).click();
  const assignment = page.getByRole('combobox', { name: 'Goal workflow', exact: true });
  await expect(assignment).toHaveValue(workflows[1]!.version.id);
  await assignment.selectOption({ label: `${title} · ${workflows[0]!.workflow.slug} · v1` });
  await assignment.scrollIntoViewIfNeeded();
  await capture(page, testInfo, `workflow-identity-prepare-${width}`);
  await page.getByRole('button', { name: 'Save goal draft', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit goal', exact: true })).toBeVisible();
  const edited = state();
  expect(edited.goals.find(item => item.id === goal.id)!.senderoVersionId).toBe(workflows[0]!.version.id);
  expect(edited.runs).toEqual(created.runs);
  expect(edited.attempts).toEqual(created.attempts);
  await reload(page);
  expect(state()).toEqual(edited);
  await visit(page, `/senderos/${workflows[0]!.workflow.id}${scope}`);
  const inspector = page.getByRole('combobox', { name: 'Sendero', exact: true });
  await expect(inspector).toHaveValue(workflows[0]!.workflow.id);
  // Native select key selection is separately bounded by the retained plain-HTML
  // Mac Chrome control. Verify keyboard focus here without claiming key selection.
  await inspector.focus();
  await inspector.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(inspector).toBeFocused();
  await inspector.press('Escape');
  expect(page.url()).toContain(`/senderos/${workflows[0]!.workflow.id}`);
  await inspector.selectOption({ label: `${title} · ${workflows[1]!.workflow.slug} · v1` });
  await expect(page).toHaveURL(url => url.pathname === `/senderos/${workflows[1]!.workflow.id}` && url.search === scope);
  await ready(page);
  await expect(inspector).toHaveValue(workflows[1]!.workflow.id);
  await inspector.scrollIntoViewIfNeeded();
  await capture(page, testInfo, `workflow-identity-inspector-${width}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.goBack(); await ready(page);
  await expect(inspector).toHaveValue(workflows[0]!.workflow.id);
  await inspector.selectOption({ label: `${title} · ${workflows[1]!.workflow.slug} · v1` });
  await expect(page).toHaveURL(url => url.pathname === `/senderos/${workflows[1]!.workflow.id}`);
  await reload(page);
  await expect(inspector).toHaveValue(workflows[1]!.workflow.id);
  expect(state()).toEqual(edited);
  await visit(page, new URL(goalUrl).pathname + scope);
  await page.getByRole('button', { name: 'Edit goal', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Goal workflow', exact: true })).toHaveValue(workflows[0]!.version.id);
  expect(state()).toEqual(edited);
  await testInfo.attach('workflow-identity-assigned-state', { body: JSON.stringify({ workflows, goal: edited.goals.find(item => item.id === goal.id) }, null, 2), contentType: 'application/json' });
});
