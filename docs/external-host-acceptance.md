# External-host acceptance matrix

The deterministic simulator is an executable contract test for an **external** host.
It does not call a model, require an API key, install cron, or add a runner to Core.
Every Senderos operation crosses the public CLI in a fresh operating-system process.
Workers are separate processes with their own PID, session identifier, home directory,
and host-local workspace. They exchange instructions and reports over standard I/O.
Only the coordination database is shared. A workspace reference is not file transfer.

## Acceptance criteria

| Scenario | Evidence required | Failure that must remain safe |
| --- | --- | --- |
| Author a custom graph | Agents and graph created through CLI; published version and instructions appear in packets | Invalid graph cannot become executable |
| Conditional routing | A structured outcome selects the documented matching edge | Unmatched outcome blocks rather than silently choosing a path |
| Backedge and bounded cycle | A later node activates an earlier node with a new activation ID | Budget exhaustion blocks; a replay cannot spend another visit |
| Fan-out | Independent activations and worker processes execute each enabled branch | One completed branch cannot prematurely complete the whole goal |
| Explicit joins | Nested forks, descendant splits, cycle generations, mixed exit/arrival, unselected branches, and zero arrivals produce their documented activation counts | Retries and completion replay cannot duplicate a join; ordinary convergence remains per-arrival |
| Context and capability routing | Two tools on a simulated laptop plus another simulated machine have distinct identities and workspaces | Missing grant, workspace, independent-session support, or required tool prevents execution |
| Dispatch contention | Separate CLI processes race one activation | At most one reservation is created; transient contention can retry its original request |
| Claim contention | Separate CLI processes race the same attempt | At most one live owner receives a usable fence |
| Replay and fencing | Dispatch replay returns the original IDs; terminal replay is stable | Changed inputs and a stale owner token are rejected |
| Independent session | Worker PID differs from controller; session differs from parent; working path matches host declaration | Parent-session reuse or wrong workspace cannot record a start |
| Crash and lease expiry | A real worker process is terminated and its lease expires | Expiry alone never authorizes an uninspected duplicate launch |
| Active orphan and resume | A live worker is found; resume metadata and observation are recorded | Unknown session state remains blocked |
| Finished but unreported | Host observes process completion and reconciles the retained result | Report recovery cannot revive a canceled or fenced attempt |
| Missing process | Host confirms process absence, records it, and explicitly abandons | Unconfirmed abandonment is rejected |
| Cancellation | A live worker sees cancellation through heartbeat and acknowledges stopped work | Goal cannot report canceled while external work remains unacknowledged |
| Evidence and review | Required evidence/review keeps completion paused until satisfied | A claimed success alone cannot bypass configured gates |
| Publication pinning | New publication and edited global instructions do not mutate an existing goal's packet | A goal cannot silently execute the latest definition |

## What this proves

The test establishes process-separated CLI coordination against one real local
libSQL database. It checks persistent state, returned error codes, process identities,
workspace isolation, and terminal outcomes. Successful assertions are written to the
JSON report; a failed assertion exits nonzero and includes its scenario.

It does **not** certify networking, a remote libSQL service, real Cursor/Codex sessions,
container or operating-system security isolation, truthfulness of a host declaration,
model output quality, or exactly-once external side effects. The process simulation
uses separate directories on one physical machine; it deliberately never depends on
one worker reading another worker's checkout or output. Real adapters must verify
session and filesystem state using their own tool's APIs.

## External host adapter responsibilities

1. Register the host's concrete tool/machine identity and capabilities.
2. Obtain an explicit project grant and declare a verified local workspace.
3. Discover work; run preflight; reserve a Core-selected activation idempotently.
4. Claim and durably retain the fence before any external launch.
5. Deduplicate launches by attempt ID. Start an independent worker and record its
   actual session, parent session, local working path, and resume information.
6. Renew the lease, check cancellation, and report with the current fence.
7. On ambiguity, inspect the actual session. Record active, finished, missing, or
   unknown. Keep unknown blocked; never infer process death from a clock alone.
8. Let Core select the next activation. Never implement a competing graph interpreter
   in the host, and never execute stored resume text without checking its context.
