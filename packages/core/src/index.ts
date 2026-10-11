export * from './shared/types';
export * from './lifecycle/host-registry';
export { goalActivations } from './lifecycle/activations';
import { registerHost, listHosts, grantHostWorkspace, declareHostWorkspace, hostPreflight, discoverHostAttempts } from './lifecycle/host-registry';
export { explainGoal, setRetryBudget, setActivationBudget } from './lifecycle/state';
export { claimAttempt, heartbeatAttempt, abandonAttempt, startAttempt, reconcileAttempt } from './lifecycle/hosts';
export { draftSendero, publishSendero, editableGraph, setCompletionPolicy } from './lifecycle/versions';
export { LifecycleError } from './lifecycle/errors';
import { explainGoal, setRetryBudget, setActivationBudget } from './lifecycle/state';
import { claimAttempt, heartbeatAttempt, abandonAttempt, startAttempt, reconcileAttempt } from './lifecycle/hosts';
import { draftSendero, publishSendero, setCompletionPolicy } from './lifecycle/versions';
import { scopedApi } from './lifecycle/scope';
export * from './shared/config';
export * from './commands';
export * from './shared/harness';
export { databaseConnectionFromEnvironment, describeCurrentDb } from './db/client';
export { prepareSharedDatabase } from './db/bootstrap';
export { listEvents } from './shared/events';
export {
  missionControlGoal,
  missionControlOverview,
  missionControlRetryExecution,
  missionControlStartGoal,
  missionControlStopExecution,
} from './mission-control';

import {
  createAgent, updateAgent, upsertAgent, newSendero, importSendero, replaceSenderoDraft, dispatchReviewed,
  activateGoal,
  cancelGoal,
  cancelRun,
  createGoal,
  createProject,
  dispatchRun,
  getAttempt,
  getGoal,
  getProject,
  getRun,
  listAgentTransitions,
  listAgents,
  listGoals,
  listProjects,
  listRunAttempts,
  listRuns,
  plan,
  resumeAttempt,
  status,
  updateGoal,
  updateProject,
  updateRunAttempt,
  recordAttemptEvidence,
  reviewRunAttempt,
  getSenderoGraph,
  listSenderoVersions,
  listSenderos,
  addAgentToSendero,
  removeAgentFromSendero,
  connectSenderoAgents,
  disconnectSenderoAgents,
  listExecutionContexts,
} from './commands';
import { updateSenderoEdge } from './internal/senderos/update-edge';
import { updateSenderoNode } from './internal/senderos/update-node';
import { updateSenderoNodePosition, updateSenderoLayout } from './internal/senderos/update-node-position';
import {
  listSenderoGraphs,
  missionControlGoal,
  missionControlOverview,
  missionControlRetryExecution,
  missionControlStartGoal,
  missionControlStopExecution,
} from './mission-control';
import { resolveExecutionContextId } from './shared/config';

export function createSenderos(input: { home?: string; executionContextId?: string; allExecutionContexts?: boolean } = {}) {
  const home = input.home;
  const executionContextId = input.allExecutionContexts
    ? undefined
    : input.executionContextId ?? resolveExecutionContextId(home);
  return scopedApi({
    commands: {
      hosts: {
        register: (value: Parameters<typeof registerHost>[0]) => registerHost(value, home),
        list: () => listHosts(home),
        grant: (value: Parameters<typeof grantHostWorkspace>[0]) => grantHostWorkspace(value, home),
        workspace: (value: Parameters<typeof declareHostWorkspace>[0]) => declareHostWorkspace(value, home),
        preflight: (value: Parameters<typeof hostPreflight>[0]) => hostPreflight(value, home),
        discover: (id: string) => discoverHostAttempts(id, home),
      },
      projects: {
        create: (value: Parameters<typeof createProject>[0]) =>
          createProject({ ...value, home, executionContextId }),
        get: (id: string) => getProject(id, home, executionContextId),
        list: () => listProjects(home, executionContextId),
        update: (value: Parameters<typeof updateProject>[0]) =>
          updateProject({ ...value, home, executionContextId }),
      },
      executionContexts: {
        list: () => listExecutionContexts(home),
      },
      goals: {
        explain: (id: string) => explainGoal(id, home),
        setActivationBudget: (id: string, maxActivations: number) => setActivationBudget(id, maxActivations, home),
        setRetryBudget: (id: string, maxAttempts: number) => setRetryBudget(id, maxAttempts, home),
        create: (value: Parameters<typeof createGoal>[0]) =>
          createGoal({ ...value, home, executionContextId }),
        get: (id: string) => getGoal(id, home, executionContextId),
        list: () => listGoals(home, executionContextId),
        activate: (id: string) => activateGoal(id, home),
        cancel: (id: string) => cancelGoal(id, home),
        update: (value: Parameters<typeof updateGoal>[0]) =>
          updateGoal({ ...value, home }),
      },
      runs: {
        dispatchReviewed: (value: Parameters<typeof dispatchReviewed>[0]) => dispatchReviewed(value, home),
        dispatch: (value: Parameters<typeof dispatchRun>[0]) =>
          dispatchRun(value, home),
        get: (id: string) => getRun(id, home, executionContextId),
        list: () => listRuns(home, executionContextId),
        cancel: (id: string) => cancelRun(id, home),
      },
      attempts: {
        start: (value: Parameters<typeof startAttempt>[0]) => startAttempt(value, home),
        reconcile: (value: Parameters<typeof reconcileAttempt>[0]) => reconcileAttempt(value, home),
        abandon: (value: Parameters<typeof abandonAttempt>[0]) => abandonAttempt(value, home),
        claim: (value: Parameters<typeof claimAttempt>[0]) => claimAttempt(value, home),
        heartbeat: (value: Parameters<typeof heartbeatAttempt>[0]) => heartbeatAttempt(value, home),
        get: (id: string) => getAttempt(id, home, executionContextId),
        list: (runId?: string) => listRunAttempts(runId, home, executionContextId),
        update: (id: string, value: Parameters<typeof updateRunAttempt>[1]) =>
          updateRunAttempt(id, value, home),
        recordEvidence: (value: Omit<Parameters<typeof recordAttemptEvidence>[0], 'home'>) =>
          recordAttemptEvidence({ ...value, home }),
        review: (value: Omit<Parameters<typeof reviewRunAttempt>[0], 'home'>) =>
          reviewRunAttempt({ ...value, home }),
        resume: (id: string) => resumeAttempt(id, home),
      },
      agents: {
        create: (value: Parameters<typeof createAgent>[0]) => createAgent({ ...value, home }),
        update: (value: Parameters<typeof updateAgent>[0]) => updateAgent({ ...value, home }),
        upsert: (value: Parameters<typeof upsertAgent>[0]) => upsertAgent({ ...value, home }),
        list: () => listAgents(home),
        transitions: () => listAgentTransitions(home),
      },
      senderos: {
        create: (value: Parameters<typeof newSendero>[0]) => newSendero({ ...value, home }),
        import: (value: Parameters<typeof importSendero>[0]) => importSendero({ ...value, home }),
        replaceDraft: (value: Parameters<typeof replaceSenderoDraft>[0]) => replaceSenderoDraft({ ...value, home }),
        draft: (id: string) => draftSendero(id, home),
        publish: (id: string, expectedVersionId?: string, expectedRevision?: string) => publishSendero(id, home, expectedVersionId, expectedRevision),
        setCompletionPolicy: (value: Parameters<typeof setCompletionPolicy>[0]) =>
          setCompletionPolicy(value, home),
        list: () => listSenderos(home),
        get: (id: string, version?: number) => getSenderoGraph(id, version, home),
        versions: {
          list: () => listSenderoVersions(home),
        },
        agents: {
          add: (value: Omit<Parameters<typeof addAgentToSendero>[0], 'home'>) =>
            addAgentToSendero({ ...value, home }),
          remove: (value: Omit<Parameters<typeof removeAgentFromSendero>[0], 'home'>) =>
            removeAgentFromSendero({ ...value, home }),
        },
        connect: (value: Omit<Parameters<typeof connectSenderoAgents>[0], 'home'>) =>
          connectSenderoAgents({ ...value, home }),
        disconnect: (value: Omit<Parameters<typeof disconnectSenderoAgents>[0], 'home'>) =>
          disconnectSenderoAgents({ ...value, home }),
      },
      plan: () => plan({ home, executionContextId }),
      status: () => status(home, executionContextId),
    },
    missionControl: {
      senderos: {
        listGraphs: () => listSenderoGraphs(home),
        updateNode: (value: Omit<Parameters<typeof updateSenderoNode>[0], 'home'>) =>
          updateSenderoNode({ ...value, home }),
        updateEdge: (value: Omit<Parameters<typeof updateSenderoEdge>[0], 'home'>) =>
          updateSenderoEdge({ ...value, home }),
        updateLayout: (value: Omit<Parameters<typeof updateSenderoLayout>[0], 'home'>) =>
          updateSenderoLayout({ ...value, home }),
        updateNodePosition: (value: Omit<Parameters<typeof updateSenderoNodePosition>[0], 'home'>) =>
          updateSenderoNodePosition({ ...value, home }),
      },
      overview: () => missionControlOverview(home, executionContextId),
      goal: (value: { goalId: string }) =>
        missionControlGoal({ ...value, home }),
      startGoal: (value: { goalId: string; workingPath?: string }) =>
        missionControlStartGoal({ ...value, home }),
      stopExecution: (value: { runId: string }) =>
        missionControlStopExecution({ ...value, home }),
      retryExecution: (value: { goalId: string; workingPath?: string }) =>
        missionControlRetryExecution({ ...value, home }),
    },
  }, executionContextId);
}
