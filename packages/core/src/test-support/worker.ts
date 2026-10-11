import { claimAttempt, startAttempt } from '../lifecycle/hosts';
import { registerHost, grantHostWorkspace, declareHostWorkspace } from '../lifecycle/host-registry';
export async function startTestWorker(home: string, projectId: string, attemptId: string, workingPath = "/test/workspace") {
  await registerHost({ id: 'test-worker', name: 'Test worker', harness: 'deterministic-test', capabilities: ['independent_session', 'shell'] }, home);
  await grantHostWorkspace({ hostId: 'test-worker', projectId, workspaceRef: projectId }, home);
  await declareHostWorkspace({ hostId: 'test-worker', projectId, available: true, workingPath }, home);
  const claim = await claimAttempt({ attemptId, ownerId: 'test-worker' }, home);
  await startAttempt({ attemptId, token: claim.token, externalSessionId: `worker:${attemptId}`, parentSessionId: 'controller', workingPath }, home);
  return claim;
}
