export * from './shared/types';
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
  updateSenderoNode,
  updateSenderoEdge,
  addAgentToSendero,
  removeAgentFromSendero,
  connectSenderoAgents,
  disconnectSenderoAgents,
} from './commands';
import {
  listSenderoGraphs,
  missionControlGoal,
  missionControlOverview,
  missionControlRetryExecution,
  missionControlStartGoal,
  missionControlStopExecution,
  updateSenderoNodePosition,
} from './mission-control';

export function createSenderos(input: { home?: string } = {}) {
  const home = input.home;
  return {
    commands: {
      projects: {
        create: (value: Parameters<typeof createProject>[0]) =>
          createProject({ ...value, home }),
        get: (id: string) => getProject(id, home),
        list: () => listProjects(home),
        update: (value: Parameters<typeof updateProject>[0]) =>
          updateProject({ ...value, home }),
      },
      goals: {
        create: (value: Parameters<typeof createGoal>[0]) =>
          createGoal({ ...value, home }),
        get: (id: string) => getGoal(id, home),
        list: () => listGoals(home),
        activate: (id: string) => activateGoal(id, home),
        cancel: (id: string) => cancelGoal(id, home),
        update: (value: Parameters<typeof updateGoal>[0]) =>
          updateGoal({ ...value, home }),
      },
      runs: {
        dispatch: (value: Parameters<typeof dispatchRun>[0]) =>
          dispatchRun(value, home),
        get: (id: string) => getRun(id, home),
        list: () => listRuns(home),
        cancel: (id: string) => cancelRun(id, home),
      },
      attempts: {
        get: (id: string) => getAttempt(id, home),
        list: (runId?: string) => listRunAttempts(runId, home),
        update: (id: string, value: Parameters<typeof updateRunAttempt>[1]) =>
          updateRunAttempt(id, value, home),
        recordEvidence: (value: Omit<Parameters<typeof recordAttemptEvidence>[0], 'home'>) =>
          recordAttemptEvidence({ ...value, home }),
        review: (value: Omit<Parameters<typeof reviewRunAttempt>[0], 'home'>) =>
          reviewRunAttempt({ ...value, home }),
        resume: (id: string) => resumeAttempt(id, home),
      },
      agents: {
        list: () => listAgents(home),
        transitions: () => listAgentTransitions(home),
      },
      senderos: {
        list: () => listSenderos(home),
        get: (id: string, version?: number) => getSenderoGraph(id, version, home),
        versions: {
          list: () => listSenderoVersions(home),
        },
        nodes: {
          update: (value: Omit<Parameters<typeof updateSenderoNode>[0], 'home'>) =>
            updateSenderoNode({ ...value, home }),
        },
        edges: {
          update: (value: Omit<Parameters<typeof updateSenderoEdge>[0], 'home'>) =>
            updateSenderoEdge({ ...value, home }),
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
      plan: () => plan({ home }),
      status: () => status(home),
    },
    missionControl: {
      senderos: {
        listGraphs: () => listSenderoGraphs(home),
        updateNodePosition: (value: Omit<Parameters<typeof updateSenderoNodePosition>[0], 'home'>) =>
          updateSenderoNodePosition({ ...value, home }),
      },
      overview: () => missionControlOverview(home),
      goal: (value: { goalId: string }) =>
        missionControlGoal({ ...value, home }),
      startGoal: (value: { goalId: string; workingPath?: string }) =>
        missionControlStartGoal({ ...value, home }),
      stopExecution: (value: { runId: string }) =>
        missionControlStopExecution({ ...value, home }),
      retryExecution: (value: { goalId: string; workingPath?: string }) =>
        missionControlRetryExecution({ ...value, home }),
    },
  };
}
