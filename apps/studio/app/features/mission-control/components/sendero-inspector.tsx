import { DurableLink as Link } from "../../../components/durable-link";
import { Form } from "react-router";
import { StatusBadge } from "../../../components/status-badge";
import { eventLabel, relativeTime } from "../model";
import { senderoPath } from "../navigation";
import type { MissionControlData } from "../server";
import { Icon } from "./icons";

export function SenderoInspector({ data, senderoId, nodeId, edgeId }: { data: MissionControlData; senderoId: string; nodeId?: string; edgeId?: string }) {
  const graph = data.senderoGraphs.find((item) => item.sendero.id === senderoId);
  if (!graph) return null;
  const node = graph.nodes.find((item) => item.id === nodeId);
  const edge = graph.edges.find((item) => item.id === edgeId);
  const agent = data.agents.find((item) => item.id === node?.agentId);
  const events = data.events.filter((event) => [graph.sendero.id, node?.id, edge?.id, agent?.id].includes(event.entityId)).slice(-8).reverse();
  return <aside className="context-inspector"><header><div><span>{edge ? "Trail arc" : node ? `${node.kind} node` : "Sendero definition"}</span><h2>{edge?.name ?? agent?.name ?? node?.label ?? graph.sendero.name}</h2></div><Link to={senderoPath(graph.sendero.id)} aria-label="Close inspector"><Icon name="x"/></Link></header>
    <div className="inspector-tabs"><span className="active">Definition</span></div>
    <section className="inspector-section"><div className="inspector-status"><StatusBadge value={edge?.status ?? graph.sendero.status}/><span>Version {graph.version.version} · {graph.version.status}</span></div><dl className="property-list">
      <div><dt>Sendero ID</dt><dd className="mono">{graph.sendero.id}</dd></div>
      {node && <><div><dt>Node ID</dt><dd className="mono">{node.id}</dd></div><div><dt>Position</dt><dd>{node.positionX}, {node.positionY}</dd></div></>}
      {agent && <><div><dt>Agent</dt><dd>{agent.name}</dd></div><div><dt>Agent ID</dt><dd className="mono">{agent.id}</dd></div><div><dt>Role</dt><dd>{agent.description}</dd></div></>}
      {edge && <><div><dt>Arc ID</dt><dd className="mono">{edge.id}</dd></div><div><dt>From</dt><dd className="mono">{edge.sourceNodeId}</dd></div><div><dt>To</dt><dd className="mono">{edge.targetNodeId}</dd></div><div><dt>Objective</dt><dd>{edge.transitionObjective}</dd></div><div><dt>Conditions</dt><dd className="mono">{edge.conditionJson}</dd></div></>}
    </dl>{node && <Form className="compact-form" method="post"><input type="hidden" name="intent" value="update-sendero-node"/><input type="hidden" name="nodeId" value={node.id}/><input name="label" defaultValue={node.label} aria-label="Node label"/><button>Save node</button></Form>}{edge && <Form className="compact-form" method="post"><input type="hidden" name="intent" value="update-sendero-edge"/><input type="hidden" name="edgeId" value={edge.id}/><input name="name" defaultValue={edge.name} aria-label="Arc name"/><input name="description" defaultValue={edge.description} placeholder="Description"/><textarea name="transitionObjective" defaultValue={edge.transitionObjective} aria-label="Transition objective"/><select name="status" defaultValue={edge.status}><option value="active">Active</option><option value="draft">Draft</option><option value="disabled">Disabled</option><option value="archived">Archived</option></select><button>Save arc</button></Form>}</section>
    <section className="inspector-section event-preview"><header><h3>Related events</h3><span>{events.length}</span></header>{events.map((event) => <div key={event.id}><i/><span><strong>{eventLabel(event.eventType)}</strong><small>{relativeTime(event.createdAt)}</small></span></div>)}{!events.length && <p>No related events recorded yet.</p>}</section>
  </aside>;
}
