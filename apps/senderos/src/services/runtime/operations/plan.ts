import type { FeatureStatus } from '../../../domain/types';
import { getRun } from '../../sendero-supervisor';
import { getAgentBySlug, getDefaultSenderoForAgent, getRunExecutionByRunId } from '../agents';
import { listFeatures } from '../features';
import { listSessions } from './runs';

const DEFAULT_FEATURE_STATUSES: FeatureStatus[] = ['active', 'failed'];
const PHASE_AGENT_SLUG: Record<string, string | null> = {
  idle: 'tdd-craftsman',
  implementation: 'tdd-craftsman',
  review: 'judge',
  mutation: 'mutation-tester',
  done: null,
  blocked: null,
};

function plannedAgentForStep(senderoStep: string, previousRunId?: string, home?: string) {
  if (previousRunId) {
    const currentExecution = getRunExecutionByRunId(previousRunId, home);
    if (currentExecution?.agentId) {
      if (currentExecution.status === 'failed') {
        return currentExecution.agentId;
      }
    }
  }

  const slug = PHASE_AGENT_SLUG[senderoStep] ?? null;
  return slug ? getAgentBySlug(slug, home)?.id ?? null : null;
}

function plannedSenderoForAgent(agentId: string | null, previousRunId?: string, home?: string) {
  if (!agentId) {
    return null;
  }

  if (previousRunId) {
    const currentExecution = getRunExecutionByRunId(previousRunId, home);
    if (currentExecution?.status === 'failed' && currentExecution.senderoId) {
      return currentExecution.senderoId;
    }
  }

  return getDefaultSenderoForAgent(agentId, home)?.id ?? null;
}

function featureIsRunning(currentRunId: string, home?: string) {
  return (listSessions(home) as any[]).some((session) => session.run_id === currentRunId && session.status === 'active');
}

export function plan(input: { home?: string; featureStatuses?: FeatureStatus[] }) {
  const statuses = input.featureStatuses?.length ? input.featureStatuses : DEFAULT_FEATURE_STATUSES;
  const features = listFeatures(input.home).filter((feature) => statuses.includes(feature.status));
  const items: Array<{ featureId: string; senderoId: string | null; agentId: string | null; previousRunId: string | null }> = [];

  for (const feature of features) {
    if (!feature.currentRunId) {
      const agentId = plannedAgentForStep(feature.senderoStep, undefined, input.home);
      const senderoId = plannedSenderoForAgent(agentId, undefined, input.home);
      if (agentId && senderoId) {
        items.push({ featureId: feature.id, senderoId, agentId, previousRunId: null });
      }
      continue;
    }

    const currentRun: any = getRun(feature.currentRunId, input.home);
    if (!currentRun) {
      continue;
    }

    if (featureIsRunning(feature.currentRunId, input.home)) {
      continue;
    }

    if (currentRun.status === 'succeeded' || currentRun.status === 'failed') {
      const agentId = plannedAgentForStep(feature.senderoStep, currentRun.id, input.home);
      const senderoId = plannedSenderoForAgent(agentId, currentRun.id, input.home);
      if (agentId && senderoId) {
        items.push({ featureId: feature.id, senderoId, agentId, previousRunId: currentRun.id });
      }
    }
  }

  return items;
}
