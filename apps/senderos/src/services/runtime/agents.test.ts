import { describe, expect, test } from 'bun:test';

import { initHome } from '../../../tests/helpers/runtime';
import {
  createAgentRun,
  createSendero,
  listAgentRuns,
  listAgents,
  listSenderosForAgent,
} from './agents';

describe('runtime agents', () => {
  test('initialization seeds built-in agents into the database', () => {
    const home = initHome();
    const agents = listAgents(home);

    expect(agents.length).toBeGreaterThan(0);
    expect(agents.some((agent) => agent.slug === 'spec-partner')).toBe(true);
    expect(agents.every((agent) => agent.definitionFormat === 'markdown')).toBe(true);
    expect(agents.every((agent) => agent.kind === 'system')).toBe(true);
  });

  test('initialization seeds a default sendero for each built-in agent', () => {
    const home = initHome();
    const agents = listAgents(home);

    for (const agent of agents) {
      const senderos = listSenderosForAgent(agent.id, home);
      expect(senderos.some((sendero) => sendero.name === 'default sendero')).toBe(true);
    }
  });

  test('creates senderos assigned to an agent and captures directed goal state', () => {
    const home = initHome();
    const agents = listAgents(home);
    const sourceAgent = agents[0]!;
    const targetAgent = agents[1]!;

    const sendero = createSendero({
      home,
      sourceAgentId: sourceAgent.id,
      targetAgentId: targetAgent.id,
      name: 'Spec handoff',
      description: 'Move refined spec work toward the implementation specialist.',
      goal: 'Hand off an approved implementation-ready contract.',
      assignmentMeta: { lane: 'spec', priority: 'high' },
    });

    expect(sendero.goalMode).toBe('toward_agent');
    expect(sendero.targetAgentId).toBe(targetAgent.id);

    const senderos = listSenderosForAgent(sourceAgent.id, home);
    expect(senderos.length).toBeGreaterThanOrEqual(2);
    expect(senderos.some((record) => record.name === 'Spec handoff')).toBe(true);
  });

  test('creates agent runs with debugging metadata', () => {
    const home = initHome();
    const [sourceAgent, targetAgent] = listAgents(home);
    const sendero = createSendero({
      home,
      sourceAgentId: sourceAgent!.id,
      targetAgentId: targetAgent!.id,
      name: 'Implementation relay',
      goal: 'Advance work from planning to implementation.',
    });

    const agentRun = createAgentRun({
      home,
      agentId: sourceAgent!.id,
      senderoId: sendero.id,
      targetAgentId: targetAgent!.id,
      goal: 'Advance work from planning to implementation.',
      harness: 'codex',
      status: 'running',
      hostEnvironmentName: 'openclaw-main',
      hostEnvironmentSessionId: 'session-123',
      checkpoint: 'contract-approved',
      statusSnapshot: { progress: 0.5 },
      debugMeta: { thread: 'slack-dm', trigger: 'human' },
      startedAt: '2026-07-04T20:00:00.000Z',
    });

    expect(agentRun.hostEnvironmentSessionId).toBe('session-123');
    expect(agentRun.checkpoint).toBe('contract-approved');

    const runs = listAgentRuns(sourceAgent!.id, home);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.senderoId).toBe(sendero.id);
    expect(runs[0]?.debugMetaJson).toContain('slack-dm');
  });
});
