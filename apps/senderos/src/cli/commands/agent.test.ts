import { describe, expect, test } from 'bun:test';

import { handleAgent, handleAgentRun, handleSendero } from './agent';
import { initHome } from '../../../tests/helpers/runtime';

describe('agent command family', () => {
  test('agent list returns seeded agents and show returns a record', () => {
    const home = initHome();
    const agents = handleAgent('list', [], home) as any[];

    expect(agents.length).toBeGreaterThan(0);
    expect(agents[0]?.slug).toBeTruthy();

    const shown = handleAgent('show', ['agent', 'show', agents[0].id], home) as any;
    expect(shown.id).toBe(agents[0].id);
  });

  test('sendero commands create and list senderos', () => {
    const home = initHome();
    const [sourceAgent, targetAgent] = handleAgent('list', [], home) as any[];

    const created = handleSendero(
      'create',
      [],
      {
        'source-agent-id': sourceAgent.id,
        'target-agent-id': targetAgent.id,
        name: 'Review handoff',
        goal: 'Move work toward review.',
      },
      home
    ) as any;

    expect(created.goalMode).toBe('toward_agent');

    const listed = handleSendero('list', [], { 'agent-id': sourceAgent.id }, home) as any[];
    expect(listed.some((sendero) => sendero.id === created.id)).toBe(true);

    const shown = handleSendero('show', ['sendero', 'show', created.id], {}, home) as any;
    expect(shown.id).toBe(created.id);
  });

  test('agent-run commands create and list run records', () => {
    const home = initHome();
    const [sourceAgent, targetAgent] = handleAgent('list', [], home) as any[];
    const sendero = handleSendero(
      'create',
      [],
      {
        'source-agent-id': sourceAgent.id,
        'target-agent-id': targetAgent.id,
        name: 'Implementation handoff',
        goal: 'Move work toward implementation.',
      },
      home
    ) as any;

    const created = handleAgentRun(
      'create',
      [],
      {
        'agent-id': sourceAgent.id,
        'sendero-id': sendero.id,
        'target-agent-id': targetAgent.id,
        goal: 'Move work toward implementation.',
        harness: 'codex',
        status: 'running',
        'host-environment-name': 'openclaw-main',
        'host-environment-session-id': 'thread-abc',
      },
      home
    ) as any;

    expect(created.status).toBe('running');

    const listed = handleAgentRun('list', [], { 'agent-id': sourceAgent.id }, home) as any[];
    expect(listed.some((run) => run.id === created.id)).toBe(true);

    const shown = handleAgentRun('show', ['agent-run', 'show', created.id], {}, home) as any;
    expect(shown.hostEnvironmentSessionId).toBe('thread-abc');
  });
});
