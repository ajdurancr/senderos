import { eq } from 'drizzle-orm';
import { initHome, createProjectFixture } from './runtime';
import { createGoal } from '../commands/goals/create';
import { activateGoal } from '../commands/goals/activate';
import { dispatchRun } from '../commands/runs/dispatch';
import { openRuntimeDb } from '../db/client';
import { attemptClaims } from '../db/schema';
import { registerExecutionContext } from '../commands/execution-contexts/register';
import { registerHost, grantHostWorkspace, declareHostWorkspace } from '../lifecycle/host-registry';
import { scopedApi } from '../lifecycle/scope';
import { claimAttempt, startAttempt } from '../lifecycle/hosts';

export async function strictHostFixture(remote = false) {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const goal = await createGoal({ home, projectId: project.id, title: 'Host protocol' });
  await activateGoal(goal.id, home);
  const reservation = await dispatchRun({ goalId: goal.id }, home);
  const db = openRuntimeDb(home);
  const current = (await db.select().from(attemptClaims).where(eq(attemptClaims.attemptId, reservation.attemptId)))[0]!;
  if (current.protocolVersion !== 2) throw new Error('Fresh runtimes must dispatch strict protocol version 2 attempts');
  await db.update(attemptClaims).set({ packetJson: JSON.stringify({ ...JSON.parse(current.packetJson), requiredCapabilities: ['shell'] }) }).where(eq(attemptClaims.attemptId, reservation.attemptId));
  if (remote) await registerExecutionContext({ home, id: 'remote', name: 'Remote context' });
  const hostApi = scopedApi({
    register: (caps = ['independent_session', 'shell'], enabled = true) => registerHost({ id: 'host-a', name: 'Host A', harness: 'custom-tool', capabilities: caps, enabled }, home),
    workspace: (available = true, workingPath = '/remote/workspace') => declareHostWorkspace({ hostId: 'host-a', projectId: project.id, available, workingPath }, home),
    claim: (input: Partial<Parameters<typeof claimAttempt>[0]> = {}) => claimAttempt({ attemptId: reservation.attemptId, ownerId: 'host-a', ...input }, home),
    start: (token: string, input: Partial<Parameters<typeof startAttempt>[0]> = {}) => startAttempt({ attemptId: reservation.attemptId, token, externalSessionId: 'worker-1', parentSessionId: 'main-1', workingPath: '/remote/workspace', ...input }, home),
  }, remote ? 'remote' : project.executionContextId);
  await hostApi.register();
  await grantHostWorkspace({ hostId: 'host-a', projectId: project.id, workspaceRef: 'git:example/repo' }, home);
  await hostApi.workspace();
  return { home, project, goal, ...reservation, db, hostApi };
}
