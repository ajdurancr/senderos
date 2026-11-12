import { capture, expect, ready, scenarioScope, state, test, visit } from './fixtures';

for (const width of [1440, 390]) for (const mode of ['create', 'import'] as const) for (const committed of [false, true]) {
  test(`inspects ${committed ? 'committed' : 'unapplied'} ${mode} confirmation loss before another workflow submission at ${width}px`, async ({ page, scenario }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const scope = scenarioScope(scenario), path = `/senderos/new${scope}`;
    await visit(page, path);
    const name = `Reviewed workflow ${scenario.id}`, slug = `reviewed-${scenario.id}`;
    const definition = JSON.stringify({ slug, name, nodes: [{ key: 'start', kind: 'start', label: 'Start' }, { key: 'end', kind: 'end', label: 'End' }], edges: [{ key: 'finish', source: 'start', target: 'end', name: 'Finish' }] });
    async function fill() {
      await page.getByLabel('Authoring method').selectOption('create');
      await page.getByLabel('Name', { exact: true }).fill(name);
      await page.getByLabel('Slug', { exact: true }).fill(slug);
      await page.getByLabel('Description', { exact: true }).fill('Retain the independently reviewed creation draft.');
      await page.getByLabel('Authoring method').selectOption('import');
      await page.getByLabel('Sendero JSON').fill(definition);
      await page.getByLabel('Authoring method').selectOption(mode);
    }
    await fill();
    const before = state();
    let writes = 0, posted = false, release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/*.data*', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      writes++;
      if (committed) expect((await route.fetch()).ok()).toBe(true);
      posted = true; await held; await route.abort('failed');
    });
    const submit = page.getByRole('button', { name: mode === 'create' ? 'Create draft' : 'Import draft', exact: true });
    const form = page.getByRole('form', { name: 'New workflow', exact: true });
    await submit.click(); await expect.poll(() => posted).toBe(true);
    await expect(page.getByLabel('Authoring method')).toBeDisabled();
    await expect(page.getByLabel(mode === 'create' ? 'Name' : 'Sendero JSON', { exact: true })).toBeDisabled();
    await form.evaluate(form => (form as HTMLFormElement).requestSubmit());
    await page.getByRole('link', { name: 'Cancel', exact: true }).focus(); await page.keyboard.press('Enter');
    expect(writes).toBe(1); expect(new URL(page.url()).pathname).toBe('/senderos/new');
    await page.getByRole('combobox', { name: 'Execution context', exact: true }).selectOption(scenario.researchContext);
    const dialog = page.getByRole('dialog', { name: 'Leave new workflow editor?' });
    await expect(dialog).toContainText('draft may still be created');
    await expect(dialog.getByRole('button', { name: 'Stay here' })).toBeFocused();
    await page.keyboard.press('Escape');
    release();
    await expect(page.getByRole('alert')).toContainText('could not confirm workflow creation');
    await expect(page.getByLabel(mode === 'create' ? 'Name' : 'Sendero JSON', { exact: true })).toHaveValue(mode === 'create' ? name : definition);
    await expect(submit).toBeDisabled();
    const after = state(), created = after.senderos.find(sendero => sendero.slug === slug);
    expect(after.senderos.length).toBe(before.senderos.length + (committed ? 1 : 0));
    expect(after.versions.length).toBe(before.versions.length + (committed ? 1 : 0));
    if (committed) {
      expect(created).toBeTruthy();
      expect(after.versions.filter(version => version.senderoId === created!.id)).toHaveLength(1);
      expect(after.versions.find(version => version.senderoId === created!.id)?.status).toBe('draft');
    } else expect(created).toBeUndefined();
    expect(after.goals).toEqual(before.goals); expect(after.runs).toEqual(before.runs); expect(after.activations).toEqual(before.activations);
    await page.evaluate(() => { location.hash = 'inspection'; });
    await expect(page).toHaveURL(/#inspection$/); await expect(submit).toBeDisabled();
    await form.evaluate(form => { (form as HTMLFormElement).reset(); (form as HTMLFormElement).requestSubmit(); });
    await page.getByRole('link', { name: 'Cancel', exact: true }).focus(); await page.keyboard.press('Enter');
    expect(writes).toBe(1); expect(state()).toEqual(after);
    await page.getByRole('button', { name: 'Reload persisted workflows' }).scrollIntoViewIfNeeded();
    await capture(page, testInfo, `workflow-unconfirmed-${mode}-${committed}-${width}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.unroute('**/*.data*');
    let readbacks = 0;
    page.on('response', response => { if (response.request().method() === 'GET' && response.request().isNavigationRequest() && response.ok()) readbacks++; });
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Reload persisted workflows' }).focus(); await page.keyboard.press('Enter'); await ready(page);
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Create draft', exact: true })).toBeEnabled();
    expect(readbacks).toBeGreaterThan(0); expect(new URL(page.url()).search).toBe(scope); expect(state()).toEqual(after);
    if (committed) {
      await visit(page, `/senderos/${created!.id}${scope}`);
      await expect(page.getByRole('heading', { name: 'Nodes, transitions, and routing', exact: true })).toBeVisible();
    } else {
      await fill(); await page.getByRole('button', { name: mode === 'create' ? 'Create draft' : 'Import draft', exact: true }).click(); await ready(page);
      await expect.poll(() => state().senderos.filter(sendero => sendero.slug === slug).length).toBe(1);
      const saved = state().senderos.find(sendero => sendero.slug === slug)!;
      await expect(page).toHaveURL(new RegExp(`/senderos/${saved.id}`));
    }
    const final = state();
    expect(final.senderos.filter(sendero => sendero.slug === slug)).toHaveLength(1);
    expect(final.versions.filter(version => version.senderoId === final.senderos.find(sendero => sendero.slug === slug)!.id).every(version => version.status === 'draft')).toBe(true);
    expect(final.goals).toEqual(before.goals); expect(final.runs).toEqual(before.runs); expect(final.activations).toEqual(before.activations);
  });
}
