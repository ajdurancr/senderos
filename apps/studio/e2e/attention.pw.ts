import type { Page } from '@playwright/test';
import { type Scenario, capture, expect, goalRuns, reload, runtime, scenarioScope, state, test, visit } from './fixtures';

async function authorAgent(page: Page, scenario: Scenario, label: string) {
  const slug = `${label}-${scenario.id}`;
  await visit(page, `/agents/new${scenarioScope(scenario)}`);
  await page.getByRole('textbox', { name: /^Name\b/ }).fill(`${label} ${scenario.id.slice(0, 8)}`);
  await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(slug);
  await page.getByRole('textbox', { name: 'Instructions', exact: true }).fill('Report verified work through the host contract.');
  await page.getByRole('button', { name: 'Create agent', exact: true }).click();
  await expect.poll(() => state().agents.some(item => item.slug === slug)).toBe(true);
  return state().agents.find(item => item.slug === slug)!;
}

async function authorGoal(page: Page, scenario: Scenario, firstSlug: string, secondSlug: string, parallel: boolean) {
  const definition = {
    slug: `attention-${scenario.id}`, name: `Attention workflow ${scenario.id.slice(0, 8)}`, maxActivations: parallel ? 20 : 1,
    nodes: [
      { key: 'start', kind: 'start', label: 'Begin' },
      { key: 'first', kind: 'agent', label: 'First branch', agentSlug: firstSlug, executionObjective: 'First isolated step', requirements: ['independent_session'] },
      { key: 'second', kind: 'agent', label: 'Second branch', agentSlug: secondSlug, executionObjective: 'Second isolated step', requirements: ['independent_session'] },
      { key: 'end', kind: 'end', label: 'Done' },
    ],
    edges: (parallel ? [['start', 'first'], ['start', 'second'], ['first', 'end'], ['second', 'end']] : [['start', 'first'], ['first', 'second'], ['second', 'end']]).map(([source, target]) => ({ source, target, name: `${source} to ${target}` })),
  };
  await visit(page, `/senderos/new${scenarioScope(scenario)}`);
  await page.getByRole('combobox', { name: 'Authoring method' }).selectOption('import');
  await page.getByRole('textbox', { name: 'Sendero JSON' }).fill(JSON.stringify(definition));
  await page.getByRole('button', { name: 'Import draft', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Validate & publish draft' })).toBeVisible();
  await page.getByRole('button', { name: 'Validate & publish draft' }).click();
  await expect(page.getByRole('button', { name: 'Create editable draft' })).toBeVisible();
  const workflow = state().senderos.find(item => item.slug === definition.slug)!;
  const version = state().versions.find(item => item.senderoId === workflow.id && item.status === 'published')!;
  const title = `Attention goal ${scenario.id.slice(0, 8)}`;
  await visit(page, `/projects/${scenario.launchProject}/goals/new${scenarioScope(scenario)}`);
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
  await page.getByRole('combobox', { name: 'Sendero', exact: true }).selectOption(version.id);
  await page.getByRole('button', { name: 'Create goal', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start goal', exact: true })).toBeVisible();
  const goal = state().goals.find(item => item.title === title)!;
  await page.getByRole('button', { name: 'Start goal', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Review ready activations' })).toBeVisible();
  return goal;
}

test('attention includes a blocked branch while another remains ready, and clears after agent remediation', async ({ page, scenario }, testInfo) => {
  const first = await authorAgent(page, scenario, 'attention-first');
  const second = await authorAgent(page, scenario, 'attention-second');
  const goal = await authorGoal(page, scenario, first.slug, second.slug, true);
  await visit(page, `/agents/${first.id}${scenarioScope(scenario)}`);
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('disabled');
  await page.getByRole('button', { name: 'Save agent', exact: true }).click();
  await expect.poll(() => state().agents.find(item => item.id === first.id)?.status).toBe('disabled');
  await visit(page, `/now${scenarioScope(scenario)}`);
  const card = page.getByRole('article', { name: `Goal blockers: ${goal.title}` });
  await expect(card).toContainText('Agent unavailable');
  await expect(card).toContainText('Other branches may still be ready or running.');
  await expect(page.getByRole('heading', { name: 'Queue clear' })).toHaveCount(0);
  expect(state().goals.find(item => item.id === goal.id)?.status).toBe('active');
  expect(goalRuns(goal.id)).toHaveLength(0);
  await page.getByRole('link', { name: 'Goal blockers (1)' }).click();
  await expect(card).toBeVisible();
  await capture(page, testInfo, 'attention-partial-blocker-desktop-1440x1000');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await card.scrollIntoViewIfNeeded();
  await capture(page, testInfo, 'attention-partial-blocker-mobile-390x844');
  await reload(page);
  await expect(card).toContainText('Agent unavailable');
  await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(scenario.campaignProject);
  await expect(page.getByRole('heading', { name: 'Queue clear' })).toBeVisible();
  await expect(card).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(scenario.launchProject);
  await card.getByRole('link', { name: 'Manage agent' }).click();
  await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('disabled');
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('active');
  await page.getByRole('button', { name: 'Save agent', exact: true }).click();
  await expect.poll(() => state().agents.find(item => item.id === first.id)?.status).toBe('active');
  await visit(page, `/now${scenarioScope(scenario)}&filter=blocked`);
  await expect(page.getByRole('heading', { name: 'No goal blockers' })).toBeVisible();
  await reload(page);
  await expect(card).toHaveCount(0);
  expect(goalRuns(goal.id)).toHaveLength(0);
  await page.getByRole('link', { name: 'All attention', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Queue clear' })).toHaveCount(0);
  expect(state().activations.filter(item => item.goalId === goal.id && item.status === 'ready')).toHaveLength(2);
  await visit(page, `/now${scenarioScope(scenario)}&filter=unknown`);
  await expect(page.getByRole('heading', { name: 'Unknown attention filter' })).toBeVisible();
  await page.getByRole('link', { name: 'Show all attention' }).click();
  await expect(page.getByRole('navigation', { name: 'Attention filters' })).toBeVisible();
});

test('attention explains a persisted activation-budget blocker and links to its cancelable goal', async ({ page, scenario }, testInfo) => {
  const agent = await authorAgent(page, scenario, 'budget-agent');
  const goal = await authorGoal(page, scenario, agent.slug, agent.slug, false);
  await page.getByRole('link', { name: 'Review ready activations' }).click();
  await page.getByRole('button', { name: 'Dispatch all' }).click();
  await expect.poll(() => goalRuns(goal.id).length).toBe(1);
  const attempt = state().attempts.find(item => item.runId === goalRuns(goal.id)[0]!.id)!;
  runtime('host-claim', attempt.id);
  runtime('host-start', attempt.id);
  runtime('host-complete', attempt.id);
  await visit(page, `/now${scenarioScope(scenario)}&filter=blocked`);
  const card = page.getByRole('article', { name: `Goal blockers: ${goal.title}` });
  await expect(card).toContainText('Activation budget reached');
  await expect(card).toContainText('explicitly increasing the activation budget');
  expect(state().goals.find(item => item.id === goal.id)?.status).toBe('blocked');
  await reload(page);
  await expect(card).toContainText('Activation budget reached');
  await capture(page, testInfo, 'attention-budget-blocker-desktop-1440x1000');
  await card.getByRole('link', { name: 'Inspect activation' }).click();
  await expect(page.locator('.context-inspector')).toContainText('activation limit reached');
  await page.getByRole('button', { name: 'Request stop', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm stop', exact: true }).click();
  await expect.poll(() => state().goals.find(item => item.id === goal.id)?.status).toBe('canceled');
  await visit(page, `/now${scenarioScope(scenario)}&filter=blocked`);
  await expect(page.getByRole('heading', { name: 'No goal blockers' })).toBeVisible();
  expect(goalRuns(goal.id)).toHaveLength(1);
});
