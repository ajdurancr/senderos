# Studio interface conventions

`app/app.css` is the shared visual vocabulary. Keep colors, spacing, type sizes,
control roles, and responsive behavior there instead of adding page-specific
copies or inline visual overrides.

## Structure

- Daily navigation: Now, Workflow progress, Goals, Runs, Reviews.
- Configuration: Settings, with Project & database, Agents, Senderos, Diagnostics.
- `StudioLayout` owns scope, navigation, the mobile drawer, and command search.
- `DurableLink` preserves execution context/project when navigating. Entity routes
  use their actual project identity; do not reconstruct paths in view components.
- `EvidenceRecords` and `HostExecutionRecords` expose recorded facts consistently
  in the attempt inspector and run history. `StatusBadge` supplies shared status
  roles. Dense identities belong in technical detail/disclosure sections.

## Visual roles

Use the navy surface tokens for chrome, controls, canvas, cards, and raised areas.
Teal identifies the main action and focus; blue, amber, and rose communicate
information, warnings, and destructive actions. Status always includes text.

- `.button.button-primary`: the next durable action, such as create/save/dispatch.
- `.button.button-secondary`: navigation, cancel, layout, and secondary actions.
- `.button.button-danger`: cancellation or destructive intent.
- `.icon-button`: a labeled compact action; always give it an accessible name.
- Shared labels, help text, validation, pending states, and disabled controls
  apply to every form. Avoid ambiguous icon-only actions and color-only meaning.

The spacing/type tokens form a small scale. Layouts use flexible grid tracks and
local scrolling for graphs/history rather than forcing page-wide overflow.
Below the desktop breakpoint, the navigation becomes a keyboard-trapped modal
with Escape, backdrop dismissal, and focus restoration. Settings tabs remain a
separate horizontally scrollable configuration navigation.

## State and lifecycle

A Studio Start activates a goal without reserving a run. Review dispatch shows
all ready activations in the selected scope; submission validates their exact
identities and revisions atomically. Reservation is distinct from external host
claim/session start. Stop requests cancellation for the entire goal, including
parallel branches, and owned sessions remain live until host acknowledgement.

Evidence entry defaults to `manual`; manual observations do not satisfy a required
`test` gate. Operators may explicitly record test, CI, pull-request or artifact proof
with an optional summary. The selected kind describes the supplied evidence;
recording it does not execute tests or verify the linked content.
Completion-pending attempts show only unmet evidence and review prerequisites
from Core's pinned policy. Keep ordinary pauses, cancellation and terminal history
distinct; missing prerequisite facts never imply successful completion.
Review decisions belong to the exact attempt. Terminal evidence and rationale
remain visible and read-only. Never derive execution completion from UI state.

`useClientReady` disables JS-only controls until their handlers are attached.
Loader `asOf` is the common clock for server/client relative times, preventing
hydration mismatches. Project forms remount by durable project ID to prevent
unsaved values from one project being submitted to another.

## Verification

Use component tests for accessible navigation, focus, forms, and missing states;
real-database integration tests for durable identities and lifecycle invariants;
and production-browser journeys for complete operator workflows. See the Studio
README for browser test setup. New UI actions must have visible feedback and a
persisted-state assertion, including their invalid/cancel/pending paths.

Evidence review cards label the source of their age: “Evidence added” or “Review recorded” comes from the latest valid proof or review timestamp. Legacy records without those dates explicitly show “Attempt updated”; invalid fallback dates show “Time unavailable”. Use a semantic `time` element for valid dates. Host heartbeat and execution times remain distinct.

Evidence and review form drafts belong to the selected attempt. Changing attempts resets both forms, including decision and evidence-kind selections. Same-attempt loader refreshes and rejected submissions preserve the operator’s inputs. Selection changes do not write evidence or review decisions.

The Sendero selector pauses workflow switching while graph edits are unsaved. Associate the disabled selector with visible save-or-cancel guidance, and restore it after either action. This protects explicit workflow selection; it does not promise draft recovery after unrelated page navigation or browser closure.
