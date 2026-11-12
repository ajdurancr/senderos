import { capture, expect, ready, reload, runtime, state, test, visit } from './fixtures';

for (const width of [1440, 390]) test(`refines bounded command matches by loaded ID at ${width}px`, async ({ page, scenario }, testInfo) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  const title = `Repeated searchable outcome ${scenario.id.slice(0, 8)}`;
  const scope = `?context=${scenario.productContext}&project=${scenario.launchProject}`;
  for (let index = 0; index < 10; index++) {
    await visit(page, `/projects/${scenario.launchProject}/goals/new${scope}`);
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
    await page.getByRole('combobox', { name: 'Sendero', exact: true }).selectOption(scenario.prerequisiteVersionId);
    await page.getByRole('button', { name: 'Create goal', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Start goal', exact: true })).toBeVisible();
    await expect(page).toHaveURL(url => /\/canvas\/goals\/goal-/.test(url.pathname));
  }
  runtime('prepare-evidence-references', scenario.id);
  const before = state();
  const goals = before.goals.filter(goal => goal.projectId === scenario.launchProject && goal.title === title);
  expect(goals).toHaveLength(10);
  await visit(page, `/now${scope}`);
  const trigger = page.getByRole('button', { name: 'Search or run a command' });
  await trigger.click();
  const search = page.getByRole('textbox', { name: 'Search commands' });
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await search.fill(title);
  await expect(palette.getByRole('link')).toHaveCount(9);
  await expect(palette.getByRole('status')).toHaveText('Showing 9 of 10 matches in loaded Studio data');
  await expect(palette).toContainText('Refine by name, context, project, or goal/attempt ID.');
  const paths = await palette.getByRole('link').evaluateAll(links => links.map(link => (link as HTMLAnchorElement).pathname));
  const omitted = goals.filter(goal => !paths.includes(`/projects/${goal.projectId}/canvas/goals/${goal.id}`));
  expect(omitted).toHaveLength(1);
  await capture(page, testInfo, `command-discovery-bounded-${width}`);
  await search.fill(omitted[0]!.id.toUpperCase());
  await expect(palette.getByRole('link')).toHaveCount(1);
  const result = palette.getByRole('link');
  await expect(result).toHaveAccessibleName(new RegExp(`${title}.*Product team.*Website launch`));
  const destination = new URL((await result.getAttribute('href'))!, page.url());
  expect(destination.pathname).toBe(`/projects/${scenario.launchProject}/canvas/goals/${omitted[0]!.id}`);
  expect(destination.searchParams.get('context')).toBe(scenario.productContext);
  expect(destination.searchParams.get('project')).toBe(scenario.launchProject);
  await expect(palette.getByRole('status')).toHaveText('Showing 1 of 1 matches in loaded Studio data');
  await capture(page, testInfo, `command-discovery-id-${width}`);
  if (width === 1440) { await search.press('Tab'); await page.keyboard.press('Tab'); await expect(result).toBeFocused(); await page.keyboard.press('Enter'); }
  else await result.click();
  await expect(page).toHaveURL(url => url.pathname === destination.pathname); await ready(page);
  await reload(page);
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.goBack(); await ready(page);
  await expect(page).toHaveURL(url => url.pathname === '/now');
  await trigger.click();
  // Existing attempt lookup remains scoped and uses the exact owning destination.
  const ownedRuns = before.runs.filter(run => before.goals.some(goal => goal.id === run.goalId && goal.projectId === scenario.launchProject));
  const attempt = before.attempts.find(item => ownedRuns.some(run => run.id === item.runId))!;
  expect(attempt).toBeTruthy();
  await search.fill(attempt.id);
  const attemptResult = palette.getByRole('link');
  await expect(attemptResult).toHaveCount(1);
  expect(new URL((await attemptResult.getAttribute('href'))!, page.url()).pathname).toBe(`/projects/${scenario.launchProject}/runs/attempts/${attempt.id}`);
  await attemptResult.click(); await ready(page);
  await expect(page).toHaveURL(url => url.pathname.endsWith(`/attempts/${attempt.id}`));
  await page.goBack(); await ready(page); await trigger.click();
  await search.fill(`not-loaded-${scenario.id}`);
  await expect(palette.getByRole('link')).toHaveCount(0);
  await expect(palette).toContainText('Nothing matches in the loaded Studio data.');
  await expect(palette.getByRole('status')).toHaveText('Showing 0 of 0 matches in loaded Studio data');
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(state()).toEqual(before);
});
