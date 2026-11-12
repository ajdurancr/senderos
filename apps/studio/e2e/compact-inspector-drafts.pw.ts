import { capture, expect, ready, scenarioScope, state, test, visit } from './fixtures';

for (const width of [1440, 390]) for (const kind of ['node', 'transition'] as const) {
  test(`protects compact ${kind} draft across navigation at ${width}px`, async ({ page, scenario }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const scope = scenarioScope(scenario), slug = `compact-${scenario.id}`;
    await visit(page, `/senderos/new${scope}`);
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Compact draft recovery');
    await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(slug);
    await page.getByRole('button', { name: 'Create draft', exact: true }).click();
    await ready(page);
    const saved = state(), workflow = saved.senderos.find(item => item.slug === slug)!;
    const version = saved.versions.find(item => item.senderoId === workflow.id)!;
    const item = kind === 'node' ? saved.nodes.find(item => item.senderoVersionId === version.id)! : saved.edges.find(item => item.senderoVersionId === version.id)!;
    await visit(page, `/senderos/${workflow.id}/${kind === 'node' ? 'nodes' : 'edges'}/${item.id}${scope}`);
    const form = page.locator('form.compact-form');
    const field = form.getByRole('textbox', { name: kind === 'node' ? 'Node label' : 'Arc name', exact: true });
    await field.fill('Retain compact draft');
    await field.scrollIntoViewIfNeeded();
    await capture(page, testInfo, `compact-inspector-before-${kind}-${width}`);
    await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(scenario.campaignProject);
    const dialog = page.getByRole('dialog', { name: 'Leave graph editor?' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(field).toHaveValue('Retain compact draft');
    expect(state()).toEqual(saved);
    await page.evaluate(() => { location.hash = 'compact'; });
    await page.goBack(); await ready(page);
    await expect(field).toHaveValue('Retain compact draft');
    const unloading = page.waitForEvent('dialog');
    const close = page.getByRole('link', { name: 'Close inspector' }).click({ noWaitAfter: true });
    const prompt = await unloading; expect(prompt.type()).toBe('beforeunload'); await prompt.dismiss(); await close;
    await expect(field).toHaveValue('Retain compact draft');
    await field.scrollIntoViewIfNeeded();
    await capture(page, testInfo, `compact-inspector-retained-${kind}-${width}`);
    await form.getByRole('button', { name: kind === 'node' ? 'Save node' : 'Save arc', exact: true }).click();
    await expect(page.getByText('Changes saved.', { exact: true })).toBeVisible();
    await expect(form.getByRole('button', { name: 'Discard inspector changes' })).toBeDisabled();
    const persisted = state();
    if (kind === 'node') expect(persisted.nodes.find(node => node.id === item.id)?.label).toBe('Retain compact draft');
    else expect(persisted.edges.find(edge => edge.id === item.id)?.name).toBe('Retain compact draft');
    await field.fill('Discard this edit');
    await form.getByRole('button', { name: 'Discard inspector changes' }).click();
    await expect(field).toHaveValue('Retain compact draft');
    await page.getByRole('link', { name: 'Close inspector' }).click();
    await expect(form).toHaveCount(0);
    await page.goBack(); await ready(page);
    // History can restore the earlier document snapshot. Explicit document
    // readback verifies the saved value; history freshness is audited separately.
    const readback = page.waitForResponse(response => response.request().isNavigationRequest() && response.request().method() === 'GET');
    await page.reload(); expect((await readback).ok()).toBe(true); await ready(page);
    await expect(field).toHaveValue('Retain compact draft');
    expect(state()).toEqual(persisted);
  });
}

for (const width of [1440, 390]) for (const kind of ['node', 'transition'] as const) for (const committed of [false, true]) {
  test(`retains ${committed ? 'committed' : 'unapplied'} compact ${kind} confirmation at ${width}px`, async ({ page, scenario }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const scope = scenarioScope(scenario), slug = `compact-loss-${scenario.id}`;
    await visit(page, `/senderos/new${scope}`);
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Inspector confirmation recovery');
    await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(slug);
    await page.getByRole('button', { name: 'Create draft', exact: true }).click(); await ready(page);
    const before = state(), workflow = before.senderos.find(item => item.slug === slug)!;
    const version = before.versions.find(item => item.senderoId === workflow.id)!;
    const item = kind === 'node' ? before.nodes.find(item => item.senderoVersionId === version.id)! : before.edges.find(item => item.senderoVersionId === version.id)!;
    const path = `/senderos/${workflow.id}/${kind === 'node' ? 'nodes' : 'edges'}/${item.id}`;
    await visit(page, `${path}${scope}`);
    const form = page.locator('form.compact-form'), field = form.getByRole('textbox', { name: kind === 'node' ? 'Node label' : 'Arc name', exact: true });
    const original = await field.inputValue();
    await field.fill('Unconfirmed compact input');
    let writes = 0, release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/*.data*', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      writes++; if (committed) await route.fetch(); await held; await route.abort('failed');
    });
    const save = form.getByRole('button', { name: kind === 'node' ? 'Save node' : 'Save arc', exact: true });
    await save.click(); await expect.poll(() => writes).toBe(1);
    await expect(field).toBeDisabled(); await expect(form.getByRole('button', { name: 'Discard inspector changes' })).toBeDisabled();
    await form.evaluate(form => (form as HTMLFormElement).requestSubmit()); expect(writes).toBe(1);
    release(); await expect(form.getByRole('status')).toContainText('could not confirm the inspector save');
    await page.evaluate(() => { location.hash = 'inspect'; });
    await expect(field).toHaveValue('Unconfirmed compact input'); await expect(save).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Validate & publish draft' })).toBeDisabled();
    const persisted = state();
    if (!committed) expect(persisted).toEqual(before);
    else if (kind === 'node') expect(persisted.nodes.find(node => node.id === item.id)?.label).toBe('Unconfirmed compact input');
    else expect(persisted.edges.find(edge => edge.id === item.id)?.name).toBe('Unconfirmed compact input');
    const reload = form.getByRole('button', { name: 'Reload persisted workflow' });
    await reload.scrollIntoViewIfNeeded(); await capture(page, testInfo, `compact-inspector-uncertain-${kind}-${committed}-${width}`);
    const unload = page.waitForEvent('dialog').then(dialog => dialog.accept());
    const readback = page.waitForResponse(response => response.request().isNavigationRequest() && response.request().method() === 'GET' && new URL(response.url()).pathname === path);
    const loaded = page.waitForEvent('load');
    if (width === 1440) { await reload.focus(); await reload.press('Enter'); } else await reload.click();
    await unload; expect((await readback).ok()).toBe(true); await loaded; await ready(page);
    await expect(field).toHaveValue(committed ? 'Unconfirmed compact input' : original);
    expect(writes).toBe(1); expect(state()).toEqual(persisted);
    await field.scrollIntoViewIfNeeded(); await capture(page, testInfo, `compact-inspector-readback-${kind}-${committed}-${width}`);
  });
}
