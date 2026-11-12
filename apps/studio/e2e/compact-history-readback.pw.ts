import { capture, expect, ready, scenarioScope, state, test, visit, workflowCreated } from './fixtures';

type HistoryAudit = { id: string; pageshow: boolean[] };
declare global { interface Window { __historyAudit: HistoryAudit } }

// Exercise normal Chrome history eligibility as well as the suite's default controls.
test.use({ launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    ignoreDefaultArgs: ['--disable-back-forward-cache'],
} });
for (const width of [1440, 390]) for (const kind of ['node', 'transition'] as const) {
  test(`reads confirmed compact ${kind} history readback at ${width}px`, async ({ page, scenario }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.addInitScript(() => {
      const observed = { id: crypto.randomUUID(), pageshow: [] as boolean[] };
      window.__historyAudit = observed;
      window.addEventListener('pageshow', event => observed.pageshow.push(event.persisted));
    });
    const responses: object[] = [];
    page.on('response', response => {
      if (response.request().isNavigationRequest() || response.url().includes('.data')) {
        responses.push({ url: response.url(), status: response.status(), method: response.request().method(), headers: response.headers(), navigation: response.request().isNavigationRequest() });
      }
    });
    const scope = scenarioScope(scenario), slug = `history-${scenario.id}`;
    await visit(page, `/senderos/new${scope}`);
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('History readback audit');
    await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(slug);
    await page.getByRole('button', { name: 'Create draft', exact: true }).click();
    await workflowCreated(page);
    const before = state(), workflow = before.senderos.find(item => item.slug === slug)!;
    const version = before.versions.find(item => item.senderoId === workflow.id)!;
    const item = kind === 'node' ? before.nodes.find(item => item.senderoVersionId === version.id)! : before.edges.find(item => item.senderoVersionId === version.id)!;
    await visit(page, `/senderos/${workflow.id}/${kind === 'node' ? 'nodes' : 'edges'}/${item.id}${scope}`);
    const form = page.locator('form.compact-form'), field = form.getByRole('textbox', { name: kind === 'node' ? 'Node label' : 'Arc name', exact: true });
    const observe = async () => ({ document: await page.evaluate(() => ({ ...window.__historyAudit, navigation: performance.getEntriesByType('navigation').map(item => item.toJSON()) })), value: await field.inputValue(), defaultValue: await field.evaluate((input: HTMLInputElement) => input.defaultValue), revision: await form.locator('input[name="expectedRevision"]').inputValue() });
    const initial = await observe();
    await field.fill('Confirmed history value');
    await form.getByRole('button', { name: kind === 'node' ? 'Save node' : 'Save arc', exact: true }).click();
    await expect(page.getByText('Changes saved.', { exact: true })).toBeVisible();
    const saved = await observe(), persisted = state();
    expect(kind === 'node' ? persisted.nodes.find(node => node.id === item.id)?.label : persisted.edges.find(edge => edge.id === item.id)?.name).toBe('Confirmed history value');
    await page.getByRole('link', { name: 'Close inspector' }).click(); await expect(form).toHaveCount(0);
    const beforeBack = responses.length;
    await page.goBack(); await ready(page);
    const restored = await observe();
    expect(restored.value).toBe('Confirmed history value');
    expect(restored.defaultValue).toBe('Confirmed history value');
    expect(restored.revision).toBe(saved.revision);
    expect(responses.slice(beforeBack)).toContainEqual(expect.objectContaining({ navigation: true, method: 'GET', status: 200, headers: expect.objectContaining({ 'cache-control': 'no-store' }) }));
    expect(state()).toEqual(persisted);
    await capture(page, testInfo, `history-readback-${kind}-${width}`);
    const readback = page.waitForResponse(response => response.request().isNavigationRequest());
    await page.reload(); await readback; await ready(page);
    const reloaded = await observe();
    await testInfo.attach('history-navigation-observation', { body: JSON.stringify({ initial, saved, restored, reloaded, beforeBack, responses }, null, 2), contentType: 'application/json' });
    expect(reloaded.value).toBe('Confirmed history value');
    expect(responses.filter(response => (response as { method: string }).method === 'POST')).toHaveLength(2);
    expect(state()).toEqual(persisted);
  });
}

for (const width of [1440, 390]) for (const kind of ['node', 'transition'] as const) {
  test(`retains concurrent compact ${kind} revision protection at ${width}px`, async ({ page, context, scenario }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const scope = scenarioScope(scenario), slug = `history-conflict-${scenario.id}`;
    await visit(page, `/senderos/new${scope}`);
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('History revision control');
    await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(slug);
    await page.getByRole('button', { name: 'Create draft', exact: true }).click();
    await workflowCreated(page);
    const before = state(), workflow = before.senderos.find(item => item.slug === slug)!;
    const version = before.versions.find(item => item.senderoId === workflow.id)!;
    const item = kind === 'node' ? before.nodes.find(item => item.senderoVersionId === version.id)! : before.edges.find(item => item.senderoVersionId === version.id)!;
    const path = `/senderos/${workflow.id}/${kind === 'node' ? 'nodes' : 'edges'}/${item.id}${scope}`;
    await visit(page, path);
    const form = page.locator('form.compact-form');
    const fieldName = kind === 'node' ? 'Node label' : 'Arc name';
    const saveName = kind === 'node' ? 'Save node' : 'Save arc';
    const field = form.getByRole('textbox', { name: fieldName, exact: true });
    const reviewed = await form.locator('input[name="expectedRevision"]').inputValue();
    const second = await context.newPage(); await visit(second, path);
    const secondForm = second.locator('form.compact-form');
    await secondForm.getByRole('textbox', { name: fieldName, exact: true }).fill('New persisted revision');
    await secondForm.getByRole('button', { name: saveName, exact: true }).click();
    await expect(second.getByText('Changes saved.', { exact: true })).toBeVisible();
    const persisted = state();
    await field.fill('Keep my conflicting input');
    await form.getByRole('button', { name: saveName, exact: true }).click();
    await expect(page.getByRole('alert').first()).toContainText(/changed|revision|stale/i);
    await expect(field).toHaveValue('Keep my conflicting input');
    expect(await form.locator('input[name="expectedRevision"]').inputValue()).toBe(reviewed);
    expect(state()).toEqual(persisted);
    await field.scrollIntoViewIfNeeded(); await capture(page, testInfo, `history-conflict-${kind}-${width}`);
    await form.getByRole('button', { name: 'Discard inspector changes' }).click();
    await expect(field).toHaveValue('New persisted revision');
    expect(await form.locator('input[name="expectedRevision"]').inputValue()).not.toBe(reviewed);
    expect(state()).toEqual(persisted);
    await second.close();
  });
}
