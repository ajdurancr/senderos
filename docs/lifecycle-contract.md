# Lifecycle and external-host contract

Core owns graph eligibility, durable activations, completion gates, retry and visit
budgets, ownership, and workflow publication. The CLI and Studio call those
operations. Neither starts a model, creates a worker session, synchronizes a
checkout, installs cron, or inspects another machine's processes.

## Author and publish

Create agent definitions with `agent create` or `agent import`, and create a sendero
with `sendero create` or `sendero import`. The bundled templates are examples.
Inspect the installed command's help for its current input schema. Draft edits do
not change published executable definitions. Publication validates the whole graph
and snapshots its agent instructions. Graph reads include a content revision.
Studio submits the reviewed version and revision for saving/publishing, including
inspector edits and atomic layout saves; concurrent graph or draft-agent changes
reject stale actions. CLI automation may opt into `--expected-version-id` and
`--expected-revision` publication fences and a revision fence on draft replacement.
Existing goals retain the published version
and instructions they were assigned, even after later drafts or agent edits.

An agent node owns its execution objective, completion policy, and host
requirements. Inserting or removing neighboring nodes must not silently transfer
or clear those policies. Node labels are edited in drafts. Canvas coordinates are presentation-only metadata and may be repositioned without changing execution semantics.

## Graph semantics

- Exactly one start and at least one end delimit a nonempty directed graph. Agent nodes can have
  multiple outgoing edges, conditional edges, and backedges.
- An edge with `{}` matches every successful completion. An edge with
  `{"outcome":"accepted"}` matches that exact top-level structured result outcome.
  All matching edges are enabled. This is deterministic fan-out, not priority order.
- No matching outgoing edge rejects the completion report with an explanation; it
  does not silently finish the visit. Hosts must not invent a route. Failed attempts
  use retry policy rather than success routing.
- Each visit is a separate durable activation. Replaying a dispatch or completion
  cannot create another activation. Retrying a failed visit is distinct from a
  graph cycle's new visit.
- A finite `maxActivations` budget bounds graph expansion and cycles independently
  of the per-activation attempt budget. The default is 100; the allowed range is
  1–10,000. Reaching the limit blocks instead of silently declaring completion. Use
  `goal activation-budget --max-activations` for an explicit operator change.
- Ordinary convergence is per-arrival: two branches arriving at the same node
  create two visits. It is not an implicit join.
- An explicit join names its matching fork through `joinForkNodeId`. Its durable
  generation waits for every activated descendant of that fork to arrive or exit
  successfully. Unselected edges are not awaited; unresolved failures remain
  outstanding. At least one arrival is needed to create the join activation.
  Nested forks and later cycle iterations belong to separate generations.
  Publication rejects a join reached without reentering its paired fork and crossed
  nested pairings: the inner join must be consumed before the outer join. Successful
  side exits to the end are allowed.
- A successful branch reaching the end cannot complete a goal with other live,
  blocked, retryable, or join-waiting work. Completion is derived from the whole
  goal's activations and configured outcomes. No universal Judge is required.

## Prepare concrete hosts

A host identifies a tool and machine inside an execution context. Two tools on one
laptop and a tool on a VPS should have distinct host identities. Registration
records their harness and capabilities, including `independent_session` when they
can really create a worker separate from the controller conversation.

The project-owning context grants each eligible host access to that project's
workspace reference. In its own context, the host declares whether that workspace
is locally available and gives the actual local path. A grant is not a checkout,
a mount, a transfer of files, or proof that a path exists on another machine.
The host must perform its own filesystem and tool checks before declaring readiness.

Revoking a grant or disabling a host blocks new execution, while an already
assigned owner can still heartbeat, report, reconcile, or acknowledge cancellation
to drain its work safely. Revocation does not terminate the external process.

A shared database alone does not authorize cross-context work. Discovery and
preflight report explicit grants, missing capabilities, and unavailable workspaces.
They do not implement a missing capability on the host's behalf. Database access
is trusted: context scoping is a coordination boundary, not tenant authentication.

## One host tick

1. Call `plan --explain`, `goal explain`, or host discovery. Planning can initialize
   or reconcile durable lifecycle state, but never reserves or launches work.
   An empty ready list does not mean the goal is complete.
2. Reserve a Core-selected activation with `run dispatch --request-id <stable-id>`.
   Include the returned activation and revision when selecting among branches.
   Dispatch rechecks eligibility transactionally. A matching request replays its
   original result; changed inputs with that ID are rejected. A reservation is
   queued, not proof that a worker exists.
3. Run host preflight, then `attempt claim --owner-id <registered-host-id>`.
   Persist the returned token before any launch. A claim records ownership and a
   lease; it must not be presented as verified external execution.
4. Deduplicate launches by attempt ID in the host. Create an independent external
   session. Use `attempt start --token` to report the actual worker session,
   distinct parent session, verified local working path, and resume information.
   Core validates this declared contract; the host supplies the actual isolation.
5. Heartbeat with the current token. Inspect every response for cancellation.
   Update checkpoints and report a structured result with the current fence.
6. A success report may pause behind configured evidence/review. Core settles
   completion and enables subsequent activations. Ask Core again; never use a
   second graph interpreter hidden in the host.

## Recovery, cancellation, and external effects

A lease expiring is not proof that a process stopped. Inspect the actual host
session before deciding what to do and persist the observation with `attempt
reconcile`:

| Observation | Required host behavior |
| --- | --- |
| `active` | Keep the existing session; explicitly reclaim eligible expired ownership, rotate the fence, and resume reporting. |
| `finished` | Recover the existing result and reconcile its terminal status; do not relaunch the completed operation. |
| `missing` | Confirm that the old process is absent/stopped, then explicitly abandon with the reason before retrying. |
| `unknown` | Keep work blocked. Restore inspection capability or ask an operator; do not assume absence. |

Reclaim rotates the ownership token. Reports carrying the old token are rejected.
A lost claim or launch response requires reconciliation, not an unconditional
retry of the external launch. A crash before `attempt start` leaves no recorded
session to reclaim as active; resolve the ambiguous launch, confirm it stopped, and
abandon/retry instead of inventing a session. Replaying an identical finished
reconciliation is safe; conflicting recovered results are rejected. `attempt resume` returns information; it never
executes the stored command. Verify ownership and local session/workspace context
before using that information.

Canceling unclaimed queued work is immediate. Canceling owned execution requests a
stop; the host stops the actual process and acknowledges `canceled`. A goal cannot
finish cancellation while another owned branch still needs acknowledgement.
`attempt abandon --confirmed-stopped --reason` is an operator assertion with an
audit trail, not a process-killing command.

Budget commands require an active execution; calling them on a draft returns
`GOAL_NOT_ACTIVE` and does not activate it. Choose the graph definition's budget
before activation, or explicitly adjust an already active goal. Once cancellation
is requested, neither budget can change or enable new work.

Each activation has three attempts by default. An operator can explicitly change
that budget with `goal retry-budget`. Retries create distinct run/attempt records
without becoming another graph visit. Claims and request IDs protect database
coordination; they cannot guarantee exactly-once external actions. External
payments, messages, deployments, and other effects need their own deduplication.

## Evidence and review

Completion policies are optional. A success report remains paused while required
evidence kinds or approval are missing. `attempt evidence` and `attempt review`
reevaluate pending completion. Once completion is pending, its result is frozen
and the attempt cannot resume running. Retry only after failure or rejection;
rejection or requested changes produces a failure
that can retry within budget. A join's packet includes the relevant predecessor
results and evidence, rather than assuming shared worker files.

Evidence is a host/operator report. Core does not run tests, authenticate a reviewer,
or independently verify the truth of a linked result. Approval does not itself
merge, deploy, purchase, or otherwise authorize an external side effect.

## Upgrade and operational boundaries

Back up the database and quiesce old writers before applying migrations. Old CLI
binaries do not implement the new contract. Migrations preserve existing history;
legacy state is reconciled on lifecycle access. Only versions that already existed
before the upgrade retain protocol 1 reporting compatibility. Every fresh seeded
example and newly published/imported workflow uses protocol 2: a registered claim,
preflight, and a distinct recorded worker session are required before execution
reports. A new goal explicitly using a preexisting legacy version retains that
version's protocol 1 contract. Republish a legacy definition to adopt the strict
contract. Old published nodes snapshot the
then-current agent instructions during upgrade because the original historical
publication instructions cannot be reconstructed. Fresh default templates snapshot
instructions at their initial seed. Ordinary initialization preserves user-edited
and renamed built-in agents and existing senderos; an explicitly requested custom
bootstrap import still intentionally upserts those supplied definitions. Ambiguous old active runs or
unassigned goals remain blocked rather than silently receiving a new route.

Use the same CLI build throughout a host session. During local development use the
checked-out CLI, rather than fetching a published version that lacks these changes.
Successful CLI output is JSON. Errors include `schemaVersion`, `code`, `retryable`,
and `nextAction`; retryable database contention exits 75, other errors exit 1.
Repeat a contested mutation with its original request ID and unchanged inputs.
Never expose claim tokens in public reports, screenshots, or logs.

## Verification

The [external-host acceptance matrix](external-host-acceptance.md) defines the
process-separated scenarios. The runnable example uses the public CLI, separate
controller/worker processes, and one local libSQL file without API keys. It does
not certify real harness integration, network partitions, remote libSQL operation,
or independent physical machines. Those require adapter/deployment tests.
