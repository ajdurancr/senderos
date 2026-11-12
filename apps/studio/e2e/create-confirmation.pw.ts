import { capture, expect, ready, scenarioScope, state, test, visit, workflowCreated } from './fixtures';

for (const width of [1440, 390]) test(`waits for workflow creation confirmation at ${width}px`, async ({ page, scenario }, testInfo) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  const scope = scenarioScope(scenario), slug = `held-create-${scenario.id}`;
  await visit(page, `/senderos/new${scope}`);
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Held creation confirmation');
  await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(slug);
  const before = state();
  let signal!: () => void, release!: () => void;
  const intercepted = new Promise<void>(resolve => { signal = resolve; });
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/*.data*', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    signal(); await held; await route.continue();
  });
  let confirmation: Promise<void> | undefined;
  try {
    await page.getByRole('button', { name: 'Create draft', exact: true }).click();
    await intercepted;
    let confirmed = false;
    confirmation = workflowCreated(page).then(() => { confirmed = true; });
    await ready(page);
    // No timer or mutation replay: the request remains held until these checks.
    expect(new URL(page.url()).pathname).toBe('/senderos/new');
    expect(confirmed).toBe(false);
    expect(state()).toEqual(before);
    await capture(page, testInfo, `create-confirmation-pending-${width}`);
  } finally { release(); }
  await confirmation;
  await expect(page.getByText('New draft created. Validate and publish when ready.', { exact: true })).toBeVisible();
  const persisted = state(), workflow = persisted.senderos.find(item => item.slug === slug)!;
  expect(workflow).toBeDefined();
  expect(persisted.eventCount).toBeGreaterThan(before.eventCount);
  await capture(page, testInfo, `create-confirmation-${width}`);
  await page.reload(); await ready(page);
  expect(state()).toEqual(persisted);
});
