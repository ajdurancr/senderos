import type { FeatureStatus, SenderoRecord } from '../../../domain/types';
import { getRun } from '../../run-state';
import { getRunExecutionByRunId, listSenderos } from '../agents';
import { listFeatures } from '../features';
import { listSessions } from './runs';

const DEFAULT_FEATURE_STATUSES: FeatureStatus[] = ['active', 'failed'];

function firstAvailableSendero(home?: string) {
  return listSenderos(home).find((sendero) => sendero.status === 'active') ?? null;
}

function senderoForSuccessfulRun(previousRunId: string, home?: string) {
  const currentExecution = getRunExecutionByRunId(previousRunId, home);
  if (!currentExecution) {
    return null;
  }

  if (currentExecution.status === 'failed') {
    return currentExecution.senderoId
      ? (listSenderos(home).find((sendero) => sendero.id === currentExecution.senderoId) ?? null)
      : null;
  }

  if (currentExecution.targetAgentId) {
    const matches = listSenderos(home).filter(
      (sendero) => sendero.status === 'active' && sendero.sourceAgentId === currentExecution.targetAgentId
    );
    return matches.at(-1) ?? null;
  }

  return null;
}

function planningTarget(previousRunId: string | undefined, home?: string): SenderoRecord | null {
  if (!previousRunId) {
    return firstAvailableSendero(home);
  }

  return senderoForSuccessfulRun(previousRunId, home) ?? firstAvailableSendero(home);
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
      const sendero = planningTarget(undefined, input.home);
      if (sendero) {
        items.push({
          featureId: feature.id,
          senderoId: sendero.id,
          agentId: sendero.sourceAgentId,
          previousRunId: null,
        });
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
      const sendero = planningTarget(currentRun.id, input.home);
      if (sendero) {
        items.push({
          featureId: feature.id,
          senderoId: sendero.id,
          agentId: sendero.sourceAgentId,
          previousRunId: currentRun.id,
        });
      }
    }
  }

  return items;
}
