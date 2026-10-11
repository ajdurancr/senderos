import { and, asc, eq, or } from 'drizzle-orm';
import { atomic, openRuntimeDb } from '../db/client';
import { executionContexts, projects, goals, runs, runAttempts, attemptClaims } from '../db/schema';
import { executionHosts, hostWorkspaces } from '../db/host-schema';
import { now } from '../shared/ids';
import { loadConfig } from '../shared/config';
import { currentExecutionContextId } from './scope';
import { requireLifecycle } from './errors';
import { emitEvent } from '../shared/events';

export function capabilities(value: unknown): string[] {
  requireLifecycle(Array.isArray(value) && value.every(v => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(v)), 'INVALID_CAPABILITIES', 'Capabilities must be nonempty identifiers');
  return [...new Set(value as string[])].sort();
}
export async function requireHost(id: string, home?: string, ownContext = true) {
  const host = (await openRuntimeDb(home).select().from(executionHosts).where(eq(executionHosts.id, id)))[0];
  const scope = currentExecutionContextId(home);
  requireLifecycle(host && (!ownContext || !scope || host.executionContextId === scope), 'HOST_NOT_FOUND', `Host not found in the current execution context: ${id}`);
  return host;
}
export async function registerHost(input: { id: string; name: string; harness?: string; capabilities: string[]; enabled?: boolean }, home?: string) {
  return atomic(home, async () => {
    const context = currentExecutionContextId(home);
    requireLifecycle(context, 'CONTEXT_REQUIRED', 'Select an execution context before registering a host');
    const db = openRuntimeDb(home);
    requireLifecycle((await db.select().from(executionContexts).where(eq(executionContexts.id, context)))[0], 'CONTEXT_REQUIRED', 'Register the execution context in this database first');
    const harness = input.harness ?? (home ? loadConfig(home).defaultHarness : undefined);
    requireLifecycle(input.id.trim() && input.name.trim() && harness?.trim() && harness !== 'unknown', 'INVALID_INPUT', 'Host id, name, and a known harness are required');
    const previous = (await db.select().from(executionHosts).where(eq(executionHosts.id, input.id)))[0];
    requireLifecycle(!previous || previous.executionContextId === context, 'HOST_CONTEXT_CONFLICT', 'A host cannot change its execution context');
    const ts = now();
    const values = { name: input.name.trim(), harness: harness!, capabilitiesJson: JSON.stringify(capabilities(input.capabilities)), enabled: input.enabled ?? true, updatedAt: ts, lastSeenAt: ts };
    await db.insert(executionHosts).values({ ...values, id: input.id, executionContextId: context, createdAt: ts }).onConflictDoUpdate({ target: executionHosts.id, set: values });
    await emitEvent(db, 'host.registered', 'host', input.id, { executionContextId: context, capabilities: input.capabilities });
    return requireHost(input.id, home);
  });
}
export async function listHosts(home?: string) {
  const scope = currentExecutionContextId(home);
  const query = openRuntimeDb(home).select().from(executionHosts);
  return scope ? query.where(eq(executionHosts.executionContextId, scope)).orderBy(asc(executionHosts.id)) : query.orderBy(asc(executionHosts.id));
}
export async function grantHostWorkspace(input: { hostId: string; projectId: string; workspaceRef: string; revoke?: boolean }, home?: string) {
  return atomic(home, async () => {
    const db = openRuntimeDb(home);
    const project = (await db.select().from(projects).where(eq(projects.id, input.projectId)))[0];
    const scope = currentExecutionContextId(home);
    requireLifecycle(project && (!scope || scope === project.executionContextId), 'NOT_FOUND', 'Project not found in the current execution context');
    await requireHost(input.hostId, home, false);
    requireLifecycle(input.workspaceRef.trim(), 'INVALID_INPUT', 'A portable workspace reference is required');
    const values = { workspaceRef: input.workspaceRef, accessGranted: !input.revoke, available: false, verifiedAt: null, updatedAt: now() };
    const id = JSON.stringify([input.hostId, input.projectId]);
    await db.insert(hostWorkspaces).values({ ...values, id, hostId: input.hostId, projectId: input.projectId }).onConflictDoUpdate({ target: hostWorkspaces.id, set: values });
    await emitEvent(db, input.revoke ? 'workspace.revoked' : 'workspace.granted', 'host', input.hostId, { projectId: input.projectId, workspaceRef: input.workspaceRef });
    return (await db.select().from(hostWorkspaces).where(eq(hostWorkspaces.id, id)))[0]!;
  });
}
export async function declareHostWorkspace(input: { hostId: string; projectId: string; available: boolean; workingPath?: string }, home?: string) {
  return atomic(home, async () => {
    await requireHost(input.hostId, home);
    const db = openRuntimeDb(home);
    const id = JSON.stringify([input.hostId, input.projectId]);
    const workspace = (await db.select().from(hostWorkspaces).where(eq(hostWorkspaces.id, id)))[0];
    requireLifecycle(workspace?.accessGranted, 'WORKSPACE_NOT_GRANTED', 'The project owner must grant this host access first');
    requireLifecycle(!input.available || !!input.workingPath?.trim(), 'WORKSPACE_PATH_REQUIRED', 'An available workspace requires a host-local working path');
    const ts = now();
    await db.update(hostWorkspaces).set({ available: input.available, workingPath: input.workingPath ?? workspace.workingPath, verifiedAt: ts, updatedAt: ts }).where(eq(hostWorkspaces.id, id));
    await db.update(executionHosts).set({ lastSeenAt: ts }).where(eq(executionHosts.id, input.hostId));
    await emitEvent(db, 'workspace.availability-declared', 'host', input.hostId, { projectId: input.projectId, available: input.available, workingPath: input.workingPath ?? workspace.workingPath, verifiedAt: ts, declarationOnly: true });
    return (await db.select().from(hostWorkspaces).where(eq(hostWorkspaces.id, id)))[0]!;
  });
}

async function checkHostPreflight(input: { attemptId: string; ownerId: string }, home?: string, includeAssigned = false) {
  const host = await requireHost(input.ownerId, home);
  const db = openRuntimeDb(home);
  const row = (await db.select({ attempt: runAttempts, claim: attemptClaims, goal: goals }).from(runAttempts)
    .innerJoin(runs, eq(runAttempts.runId, runs.id)).innerJoin(goals, eq(runs.goalId, goals.id))
    .leftJoin(attemptClaims, eq(runAttempts.id, attemptClaims.attemptId)).where(eq(runAttempts.id, input.attemptId)))[0];
  requireLifecycle(row, 'NOT_FOUND', 'Attempt not found');
  const workspace = (await db.select().from(hostWorkspaces).where(and(eq(hostWorkspaces.hostId, host.id), eq(hostWorkspaces.projectId, row.goal.projectId))))[0];
  // Do not disclose another context's instructions or workspace without an explicit grant.
  requireLifecycle(workspace?.accessGranted || (includeAssigned && row.claim?.ownerId === host.id), 'WORKSPACE_NOT_GRANTED', 'The project owner has not granted this host access');
  const packet = JSON.parse(row.claim?.packetJson ?? '{}');
  const required = capabilities(packet.requiredCapabilities ?? []);
  if (row.claim?.protocolVersion === 2 && !required.includes('independent_session')) required.push('independent_session');
  const declared = capabilities(JSON.parse(host.capabilitiesJson));
  const missingCapabilities = required.filter(capability => !declared.includes(capability));
  const blockers = [...(!workspace?.accessGranted ? ['workspace_not_granted'] : []), ...(!host.enabled ? ['host_disabled'] : []), ...(!workspace?.available || !workspace.workingPath ? ['workspace_unavailable'] : []), ...(missingCapabilities.length ? ['missing_capabilities'] : [])];
  return { attemptId: row.attempt.id, hostId: host.id, eligible: blockers.length === 0, blockers, missingCapabilities, requiredCapabilities: required, declaredCapabilities: declared, checkedAt: now(), harness: host.harness, workspace: { reference: workspace?.workspaceRef ?? row.goal.projectId, workingPath: workspace?.workingPath ?? row.attempt.workingPath, available: workspace?.available ?? false, verifiedAt: workspace?.verifiedAt ?? null }, declarationOnly: true };
}
export async function hostPreflight(input: { attemptId: string; ownerId: string }, home?: string) {
  return checkHostPreflight(input, home);
}
export async function discoverHostAttempts(hostId: string, home?: string) {
  await requireHost(hostId, home);
  const rows = await openRuntimeDb(home).select({ attempt: runAttempts, claim: attemptClaims }).from(runAttempts)
    .innerJoin(runs, eq(runAttempts.runId, runs.id)).innerJoin(goals, eq(runs.goalId, goals.id))
    .leftJoin(hostWorkspaces, and(eq(hostWorkspaces.projectId, goals.projectId), eq(hostWorkspaces.hostId, hostId)))
    .leftJoin(attemptClaims, eq(attemptClaims.attemptId, runAttempts.id)).where(or(eq(hostWorkspaces.accessGranted, true), eq(attemptClaims.ownerId, hostId))).orderBy(asc(runAttempts.createdAt));
  const result = [];
  for (const { attempt, claim } of rows) {
    if (['succeeded', 'failed', 'canceled'].includes(attempt.status) || (claim?.ownerId && claim.ownerId !== hostId)) continue;
    result.push({ attemptId: attempt.id, runId: attempt.runId, status: attempt.status, ownerId: claim?.ownerId ?? null, leaseExpiresAt: claim?.leaseExpiresAt ?? null, recoveryOutcome: claim?.recoveryOutcome ?? null, preflight: await checkHostPreflight({ attemptId: attempt.id, ownerId: hostId }, home, true) });
  }
  return result;
}
