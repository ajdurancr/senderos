import { type Scenario, scenarioScope, test, expect, capture, goalAttempts, goalRuns, ready, reload, runtime, state, visit } from './fixtures';

async function createGoal(page: import('@playwright/test').Page, scenario: Scenario, title: string, research = false, versionId = scenario.prerequisiteVersionId) {
  const project = research ? scenario.researchProject : scenario.launchProject;
  const context = research ? scenario.researchContext : scenario.productContext;
  await visit(page, `/projects/${project}/goals/new?context=${context}&project=${project}`);
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
  await page.getByLabel('Category', { exact: true }).fill('feature');
  await page.getByRole('textbox', { name: 'Specification', exact: true }).fill('Keyboard and responsive acceptance with persisted evidence.');
  await page.getByRole('combobox', { name: 'Sendero', exact: true }).selectOption(versionId);
  await page.getByRole('button', { name: 'Create goal', exact: true }).click();
  await expect.poll(() => state().goals.some(goal => goal.title === title && goal.projectId === project)).toBe(true);
  const goal = state().goals.find(goal => goal.title === title && goal.projectId === project)!;
  await visit(page, `/projects/${project}/canvas/goals/${goal.id}?context=${context}&project=${project}`);
  return goal;
}

// Each test drives a genuine browser against the production HTTP server. No route
// interception, loader mocking, or direct mutation of operator-owned data.
test('author, publish, activate, review dispatch, and settle typed evidence gates', async ({ page, scenario }, testInfo) => {
  const scope = scenarioScope(scenario);
  const suffix = scenario.id.slice(0, 8);
  const name = `Browser acceptance reviewer ${suffix}`;
  const slug = `browser-reviewer-${suffix}`;
  const instructions = 'Review keyboard navigation and responsive layout. Report acceptance evidence.';
  await visit(page, `/agents/new${scope}`);
  await page.getByRole('button', { name: 'Create agent', exact: true }).click();
  expect(await page.getByRole('textbox', { name: /^Name\b/ }).evaluate(input => (input as HTMLInputElement).validity.valueMissing)).toBe(true);
  expect(state().agents.filter(agent => agent.slug === slug)).toHaveLength(0);
  await page.getByRole('textbox', { name: /^Name\b/ }).fill(name);
  await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(slug);
  await page.getByRole('textbox', { name: 'Description', exact: true }).fill('Browser-created independent acceptance role');
  await page.getByRole('textbox', { name: 'Instructions', exact: true }).fill(instructions);
  await page.getByRole('button', { name: 'Create agent', exact: true }).click();
  await expect.poll(() => state().agents.find(agent => agent.slug === slug)?.definitionBody).toBe(instructions);
  const agent = state().agents.find(agent => agent.slug === slug)!;
  await expect(page).toHaveURL(new RegExp(`/agents/${agent.id}`));
  expect(agent).toMatchObject({ name, kind: 'custom', status: 'active', description: 'Browser-created independent acceptance role' });
  await reload(page);
  await expect(page.getByRole('textbox', { name: 'Instructions', exact: true })).toHaveValue(instructions);
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('disabled');
  await page.getByRole('button', { name: 'Save agent', exact: true }).click();
  await expect.poll(() => state().agents.find(item => item.id === agent.id)?.status).toBe('disabled');
  await reload(page);
  await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('disabled');
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('active');
  await page.getByRole('button', { name: 'Save agent', exact: true }).click();
  await expect.poll(() => state().agents.find(item => item.id === agent.id)?.status).toBe('active');

  const workflowName = `Verified browser workflow ${suffix}`;
  const definition = {
    slug: `verified-browser-workflow-${suffix}`, name: workflowName, maxActivations: 20,
    nodes: [
      { key: 'start', kind: 'start', label: 'Begin acceptance' },
      { key: 'review', kind: 'agent', label: 'Acceptance reviewer', agentSlug: slug, executionObjective: 'Verify the operator journey', completion: { requireReview: true, evidenceKinds: ['test'] }, requirements: ['browser', 'independent_session'] },
      { key: 'end', kind: 'end', label: 'Accepted' },
    ],
    edges: [
      { key: 'begin', source: 'start', target: 'review', name: 'Begin review' },
      { key: 'accept', source: 'review', target: 'end', name: 'Accept review', condition: { outcome: 'accepted' } },
    ],
  };
  await visit(page, `/senderos/new${scope}`);
  await page.getByRole('combobox', { name: 'Authoring method' }).selectOption('import');
  const countBeforeImport = state().senderos.length;
  await page.getByRole('textbox', { name: 'Sendero JSON' }).fill('{broken');
  await page.getByRole('button', { name: 'Import draft', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('JSON');
  await expect(page.getByRole('textbox', { name: 'Sendero JSON' })).toHaveValue('{broken');
  expect(state().senderos).toHaveLength(countBeforeImport);
  await page.getByRole('textbox', { name: 'Sendero JSON' }).fill(JSON.stringify(definition));
  await page.getByRole('button', { name: 'Import draft', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nodes, transitions, and routing' })).toBeVisible();
  const workflow = state().senderos.find(item => item.slug === definition.slug)!;
  const version = state().versions.find(item => item.senderoId === workflow.id)!;
  expect(version.status).toBe('draft');
  const editor = page.locator('.graph-editor');
  await editor.getByRole('spinbutton', { name: 'Maximum activations per goal' }).fill('999');
  await page.getByRole('button', { name: 'Cancel changes', exact: true }).click();
  await expect(editor.getByRole('spinbutton', { name: 'Maximum activations per goal' })).toHaveValue('20');
  expect(state().versions.find(item => item.id === version.id)?.maxActivations).toBe(20);
  await editor.getByRole('spinbutton', { name: 'Maximum activations per goal' }).fill('25');
  const objective = 'Verify keyboard traversal and 390px responsive acceptance';
  await editor.getByRole('textbox', { name: 'Execution objective', exact: true }).fill(objective);
  await expect(page.getByRole('button', { name: 'Validate & publish draft' })).toBeDisabled();
  await page.getByRole('button', { name: 'Save graph draft' }).click();
  await expect.poll(() => state().nodes.find(node => node.senderoVersionId === version.id && node.kind === 'agent')?.executionObjective).toBe(objective);
  await reload(page);
  await expect(editor.getByRole('spinbutton', { name: 'Maximum activations per goal' })).toHaveValue('25');
  await expect(editor.getByRole('textbox', { name: 'Execution objective', exact: true })).toHaveValue(objective);
  await page.getByRole('button', { name: 'Validate & publish draft' }).click();
  await expect(page.getByRole('button', { name: 'Create editable draft' })).toBeVisible();
  const saved = state();
  const published = saved.versions.find(item => item.id === version.id)!;
  const node = saved.nodes.find(item => item.senderoVersionId === version.id && item.kind === 'agent')!;
  expect(published).toMatchObject({ status: 'published', maxActivations: 25 });
  expect(JSON.parse(node.agentSnapshotJson!).instructions).toBe(instructions);
  expect(JSON.parse(node.completionJson)).toEqual({ requireReview: true, evidenceKinds: ['test'] });
  expect(JSON.parse(node.requirementsJson)).toEqual(['browser', 'independent_session']);
  const publishedPositions = () => state().nodes.filter(item => item.senderoVersionId === version.id)
    .map(item => ({ id: item.id, x: item.positionX, y: item.positionY })).sort((a, b) => a.id.localeCompare(b.id));
  const positionsBeforeLayout = publishedPositions();
  await page.getByRole('button', { name: 'Auto layout', exact: true }).click();
  await expect.poll(publishedPositions).not.toEqual(positionsBeforeLayout);
  const positionsAfterLayout = publishedPositions();
  expect(positionsAfterLayout.map(item => item.x)).not.toEqual(positionsBeforeLayout.map(item => item.x));
  expect(state().versions.find(item => item.id === version.id)?.status).toBe('published');
  await reload(page);
  expect(publishedPositions()).toEqual(positionsAfterLayout);
  await expect(page.getByRole('button', { name: 'Create editable draft' })).toBeVisible();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator('.canvas-page-header').scrollIntoViewIfNeeded();
  await capture(page, testInfo, 'workflow-definition-desktop-1920x1080');
  await page.setViewportSize({ width: 1440, height: 1000 });

  const goal = await createGoal(page, scenario, `Ship accessible browser outcome ${suffix}`, false, version.id);
  expect(goal).toMatchObject({ status: 'draft', kind: 'feature', senderoVersionId: version.id, specText: 'Keyboard and responsive acceptance with persisted evidence.' });
  expect(goalRuns(goal.id)).toHaveLength(0);
  await page.getByRole('button', { name: 'Start goal', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Review ready activations' })).toBeVisible();
  expect(state().goals.find(item => item.id === goal.id)?.status).toBe('active');
  expect(goalRuns(goal.id)).toHaveLength(0);
  expect(goalAttempts(goal.id)).toHaveLength(0);
  const activation = state().activations.find(item => item.goalId === goal.id && item.status === 'ready')!;
  expect(activation).toMatchObject({ nodeId: node.id, revision: 0 });
  await page.getByRole('link', { name: 'Review ready activations' }).click();
  await expect(page.locator('.dispatch-tray')).toContainText(`${activation.id} · revision 0`);
  await page.getByRole('link', { name: 'Close dispatch plan' }).click();
  await expect(page.locator('.dispatch-tray')).toHaveCount(0);
  expect(goalRuns(goal.id)).toHaveLength(0);
  expect(new URL(page.url()).searchParams.get('context')).toBe(scenario.productContext);
  await page.getByRole('link', { name: 'Review ready activations' }).click();
  await page.getByRole('button', { name: 'Dispatch all' }).click();
  await expect.poll(() => goalAttempts(goal.id).length).toBe(1);
  const attempt = goalAttempts(goal.id)[0]!;
  expect(attempt).toMatchObject({ status: 'queued', startedAt: null, externalSessionId: null });
  expect(state().claims.find(claim => claim.attemptId === attempt.id)).toMatchObject({ protocolVersion: 2, ownerId: null, claimedAt: null });
  expect(goalRuns(goal.id)).toHaveLength(1);
  await testInfo.attach('reviewed-reservation', { body: JSON.stringify({ goal, activation, attempt }, null, 2), contentType: 'application/json' });

  expect(runtime('host-claim', attempt.id)).toEqual({ eligible: true, claimed: true, started: false });
  await reload(page);
  await expect(page.locator('.context-inspector .inspector-status')).toContainText('claimed');
  expect(goalAttempts(goal.id)[0]!.startedAt).toBeNull();
  runtime('host-start', attempt.id);
  await reload(page);
  await expect(page.locator('.context-inspector .inspector-status')).toContainText('started');
  expect(goalAttempts(goal.id)[0]!.status).toBe('running');
  await page.getByRole('textbox', { name: 'Evidence label', exact: true }).fill('Keyboard and responsive report');
  await page.getByRole('textbox', { name: 'Evidence URL (optional)' }).fill('invalid-url');
  await page.getByRole('button', { name: 'Record evidence', exact: true }).click();
  expect(await page.getByRole('textbox', { name: 'Evidence URL (optional)' }).evaluate(input => (input as HTMLInputElement).validity.typeMismatch)).toBe(true);
  expect(JSON.parse(goalAttempts(goal.id)[0]!.statusSnapshotJson).evidence ?? []).toHaveLength(0);
  await page.getByRole('textbox', { name: 'Evidence URL (optional)' }).fill('https://example.com/e2e/operator-report');
  await page.getByRole('button', { name: 'Record evidence', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open evidence: Keyboard and responsive report' })).toHaveAttribute('href', 'https://example.com/e2e/operator-report');
  await page.getByRole('link', { name: 'Reviews', exact: true }).click();
  await page.getByRole('link', { name: 'Inspect evidence' }).click();
  await expect(page.getByRole('link', { name: 'Open evidence: Keyboard and responsive report' })).toBeVisible();
  await page.getByRole('link', { name: 'Review this attempt', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/attempts/${attempt.id}`));
  await page.getByRole('textbox', { name: 'Decision rationale' }).fill('Keyboard and responsive review accepted.');
  await page.getByRole('button', { name: 'Record decision', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Recorded review' })).toContainText('Keyboard and responsive review accepted.');
  let current = goalAttempts(goal.id)[0]!;
  expect(current.status).toBe('running');
  expect(JSON.parse(current.statusSnapshotJson)).toMatchObject({ evidence: [{ kind: 'manual', label: 'Keyboard and responsive report' }], review: { status: 'approved', reviewer: 'Studio operator', rationale: 'Keyboard and responsive review accepted.' } });
  runtime('host-complete', attempt.id);
  await reload(page);
  current = goalAttempts(goal.id)[0]!;
  expect(current.status).toBe('paused');
  expect(JSON.parse(current.statusSnapshotJson).completionRequested).toBe(true);
  expect(state().goals.find(item => item.id === goal.id)?.status).not.toBe('completed');
  await expect(page.locator('.context-inspector .inspector-status')).toContainText('paused');
  runtime('host-test-evidence', attempt.id);
  await reload(page);
  expect(goalAttempts(goal.id)[0]!.status).toBe('succeeded');
  expect(state().goals.find(item => item.id === goal.id)?.status).toBe('completed');
  await expect(page.locator('.context-inspector .inspector-status')).toContainText('completed');
  await expect(page.getByRole('button', { name: 'Record decision', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Record evidence', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open evidence: Host test report' })).toBeVisible();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator('.canvas-page-header').scrollIntoViewIfNeeded();
  await capture(page, testInfo, 'workflow-progress-completed-desktop-1920x1080');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('link', { name: 'Reviews', exact: true }).click();
  await page.getByRole('link', { name: 'Inspect evidence' }).click();
  await expect(page.getByRole('link', { name: 'Open evidence: Keyboard and responsive report' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Recorded review' })).toContainText('Keyboard and responsive review accepted.');
  await page.locator('.run-detail').scrollIntoViewIfNeeded();
  await capture(page, testInfo, 'completed-evidence-desktop-1440x1000');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.run-detail').scrollIntoViewIfNeeded();
  await capture(page, testInfo, 'completed-evidence-mobile-390x844');
});

test('scope switch remounts project settings and invalid/canceled forms do not write', async ({ page, scenario }) => {
  const scope = scenarioScope(scenario);
  await visit(page, `/settings${scope}`);
  await expect(page.getByRole('textbox', { name: /^Name\b/ })).toHaveValue('Website launch');
  await page.getByRole('textbox', { name: /^Name\b/ }).fill('UNSAVED WRONG PROJECT');
  await page.getByRole('textbox', { name: /^Target branch\b/ }).fill('wrong-project-branch');
  await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(scenario.campaignProject);
  await expect(page.getByRole('textbox', { name: /^Name\b/ })).toHaveValue('Next campaign');
  await expect(page.getByRole('textbox', { name: /^Target branch\b/ })).toHaveValue('');
  await page.getByRole('textbox', { name: /^Name\b/ }).fill('Campaign preview');
  await page.getByRole('textbox', { name: /^Target branch\b/ }).fill('campaign-preview');
  await page.getByRole('combobox', { name: /^Integration mode\b/ }).selectOption('local_merge');
  await page.getByRole('button', { name: 'Save project' }).click();
  await expect.poll(() => state().projects.find(item => item.id === scenario.campaignProject)?.targetBranch).toBe('campaign-preview');
  await reload(page);
  await expect(page.getByRole('textbox', { name: /^Name\b/ })).toHaveValue('Campaign preview');
  await expect(page.getByRole('textbox', { name: /^Target branch\b/ })).toHaveValue('campaign-preview');
  expect(state().projects.find(item => item.id === scenario.campaignProject)).toMatchObject({ name: 'Campaign preview', integrationMode: 'local_merge', githubRepo: '' });
  expect(state().projects.find(item => item.id === scenario.launchProject)).toMatchObject({ name: 'Website launch', targetBranch: 'main', integrationMode: 'github_pr', githubRepo: 'launch-site' });
  await page.getByRole('textbox', { name: /^Name\b/ }).fill('');
  await page.getByRole('button', { name: 'Save project' }).click();
  expect(await page.getByRole('textbox', { name: /^Name\b/ }).evaluate(input => (input as HTMLInputElement).validity.valueMissing)).toBe(true);
  expect(state().projects.find(item => item.id === scenario.campaignProject)?.name).toBe('Campaign preview');
  await page.getByRole('combobox', { name: 'Execution context', exact: true }).selectOption(scenario.researchContext);
  await expect(page.getByRole('combobox', { name: 'Project', exact: true })).toHaveValue('');
  await expect(page.getByRole('textbox', { name: /^Name\b/ })).toHaveValue('Research project');
  expect(new URL(page.url()).searchParams.has('project')).toBe(false);
  const before = state().goals.length;
  await visit(page, `/goals/new?context=${scenario.productContext}`);
  await expect(page.getByRole('heading', { name: 'Choose a project' })).toBeVisible();
  await page.getByRole('link', { name: 'Campaign preview', exact: true }).click();
  await page.getByRole('button', { name: 'Create goal', exact: true }).click();
  expect(await page.getByRole('textbox', { name: 'Title', exact: true }).evaluate(input => (input as HTMLInputElement).validity.valueMissing)).toBe(true);
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Canceled browser goal');
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Goals', exact: true })).toBeVisible();
  expect(state().goals).toHaveLength(before);
  await page.getByRole('link', { name: 'New goal', exact: true }).last().click();
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('');
});

test('concurrent graph save rejects stale revisions and preserves both edits for recovery', async ({ page, context, scenario }, testInfo) => {
  const slug = `concurrent-browser-${scenario.id}`;
  await visit(page, '/senderos/new');
  await page.getByRole('textbox', { name: /^Name\b/ }).fill('Concurrent browser draft');
  await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(slug);
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  await expect(page.locator('.graph-editor')).toBeVisible();
  const workflow = state().senderos.find(item => item.slug === slug)!;
  const version = state().versions.find(item => item.senderoId === workflow.id)!;
  const second = await context.newPage();
  await visit(second, new URL(page.url()).pathname);
  await page.getByRole('spinbutton', { name: 'Maximum activations per goal' }).fill('101');
  await second.getByRole('spinbutton', { name: 'Maximum activations per goal' }).fill('102');
  await second.getByRole('button', { name: 'Save graph draft' }).click();
  await expect.poll(() => state().versions.find(item => item.id === version.id)?.maxActivations).toBe(102);
  await page.getByRole('button', { name: 'Save graph draft' }).click();
  await expect(page.getByRole('alert').first()).toContainText(/changed|revision|stale/i);
  await expect(page.getByRole('spinbutton', { name: 'Maximum activations per goal' })).toHaveValue('101');
  expect(state().versions.find(item => item.id === version.id)?.maxActivations).toBe(102);
  await page.getByRole('button', { name: 'Cancel changes', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Maximum activations per goal' })).toHaveValue('102');
  await reload(page);
  await expect(page.getByRole('spinbutton', { name: 'Maximum activations per goal' })).toHaveValue('102');
  await second.close();
});

test('keyboard palette and mobile drawer preserve scope, focus, and viewport bounds', async ({ page, scenario }, testInfo) => {
  const scope = scenarioScope(scenario);
  const own = await createGoal(page, scenario, `Keyboard visible goal ${scenario.id.slice(0, 8)}`);
  await createGoal(page, scenario, `Keyboard hidden goal ${scenario.id.slice(0, 8)}`, true);
  await visit(page, `/now${scope}`);
  const runsBefore = state().runs.length;
  const trigger = page.getByRole('button', { name: 'Search or run a command' });
  await trigger.focus();
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  const search = page.getByRole('textbox', { name: 'Search commands' });
  await expect(search).toBeFocused();
  await search.fill('NO_SUCH_GOAL_924890');
  await expect(palette).toContainText('Nothing matches that query.');
  await page.keyboard.press('Shift+Tab');
  await expect(palette.getByRole('button', { name: 'Esc' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(search).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(palette).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Control+k');
  await search.fill('Keyboard hidden goal');
  await expect(palette).toContainText('Nothing matches that query.');
  await search.fill(own.title);
  const result = palette.getByRole('link', { name: new RegExp(own.title) });
  await expect(result).toBeVisible();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(result).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.context-inspector h2')).toHaveText(own.title);
  expect(new URL(page.url()).searchParams.get('context')).toBe(scenario.productContext);
  expect(state().runs).toHaveLength(runsBefore);

  await visit(page, `/goals${scope}`);
  await capture(page, testInfo, 'goals-desktop-1440x1000');
  await visit(page, `/settings${scope}`);
  await capture(page, testInfo, 'settings-desktop-1440x1000');
  for (const width of [1024, 900, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ['/now', '/goals', '/runs', '/reviews', '/settings', '/agents/new', '/senderos/new']) {
      await visit(page, `${path}${scope}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${path} fits ${width}px without whole-page overflow`).toBe(true);
      if (width === 390 && ['/goals', '/settings'].includes(path)) await capture(page, testInfo, `${path.slice(1)}-mobile-390x844`);
    }
    if (width <= 900) {
      const menu = page.getByRole('button', { name: 'Open navigation' });
      await menu.click();
      const drawer = page.getByRole('dialog', { name: 'Studio menu' });
      await expect(page.getByRole('button', { name: 'Close navigation' })).toBeFocused();
      if (width === 390) await capture(page, testInfo, 'navigation-drawer-mobile-390x844');
      await drawer.getByRole('link', { name: 'Settings', exact: true }).focus();
      await page.keyboard.press('Tab');
      await expect(drawer.locator('.studio-brand')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(drawer).toHaveCount(0);
      await expect(menu).toBeFocused();
      await menu.click();
      await page.getByRole('dialog', { name: 'Studio menu' }).getByRole('link', { name: 'Settings', exact: true }).click();
      await expect(page.getByRole('textbox', { name: /^Name\b/ })).toHaveValue('Website launch');
      await expect(page.getByRole('dialog', { name: 'Studio menu' })).toHaveCount(0);
    }
  }
});

test('unclaimed cancellation is durable and missing entities remain explicit', async ({ page, scenario }, testInfo) => {
  const scope = scenarioScope(scenario);
  const goal = await createGoal(page, scenario, `Cancel unclaimed browser goal ${scenario.id.slice(0, 8)}`);
  await page.getByRole('button', { name: 'Start goal', exact: true }).click();
  await page.getByRole('link', { name: 'Review ready activations' }).click();
  await page.getByRole('button', { name: 'Dispatch all' }).click();
  await expect(page.getByRole('button', { name: 'Request stop', exact: true })).toBeVisible();
  await expect(page.locator('.context-inspector')).toContainText('this goal and all active branches');
  await page.getByRole('button', { name: 'Request stop', exact: true }).click();
  await expect.poll(() => state().goals.find(item => item.id === goal.id)?.status).toBe('canceled');
  await reload(page);
  expect(goalAttempts(goal.id)).toHaveLength(1);
  expect(goalAttempts(goal.id)[0]).toMatchObject({ status: 'canceled', externalSessionId: null, startedAt: null });
  await expect(page.getByRole('button', { name: 'Request stop', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Record evidence', exact: true })).toHaveCount(0);
  await visit(page, `/projects/${scenario.launchProject}/runs/attempts/missing-attempt${scope}`);
  await expect(page.getByText(/This attempt is unavailable/)).toBeVisible();
  await visit(page, `/projects/${scenario.launchProject}/canvas/goals/missing-goal${scope}`);
  await expect(page.getByText(/goal is no longer available|goal is unavailable/i)).toBeVisible();
});
