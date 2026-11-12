import type { MissionControlData } from '../server';

type Agent = MissionControlData['agents'][number];
type Node = MissionControlData['senderoGraphs'][number]['nodes'][number];
/** A live definition must never be presented as a historical publication snapshot. */
export function pinnedAgent(node: Node | undefined, published: boolean) {
  if (!published || !node?.agentId || !node.agentSnapshotJson) return null;
  try {
    const value: unknown = JSON.parse(node.agentSnapshotJson);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    return record.id === node.agentId && typeof record.name === 'string' && typeof record.instructions === 'string'
      ? { id: record.id, name: record.name, instructions: record.instructions } : null;
  } catch { return null; }
}

export function AgentDefinition({ node, published, agent }: { node?: Node; published: boolean; agent?: Agent }) {
  if (!node?.agentId && !agent) return null;
  const pinned = pinnedAgent(node, published);
  return <section className="inspector-section">
    <h3>Agent definition</h3>
    <dl className="property-list">
      {pinned && <div><dt>Pinned agent</dt><dd>{pinned.name}</dd></div>}
      <div><dt>Current agent</dt><dd>{agent?.name ?? 'Unavailable'}</dd></div>
      {agent && <div><dt>Current role</dt><dd>{agent.description || agent.defaultGoal || agent.kind}</dd></div>}
    </dl>
    {published && node?.agentId && !pinned && <p>Pinned agent snapshot unavailable. The current definition is shown for reference; it does not establish the published instructions.</p>}
    {(pinned || agent) && <details className="inspector-disclosure">
      <summary>{pinned ? 'Pinned instructions' : 'Current instructions'}</summary>
      <p>{pinned ? 'Stored with this published workflow version.' : 'The current editable agent definition.'}</p>
      <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{pinned ? pinned.instructions : agent?.definitionBody}</div>
    </details>}
  </section>;
}
