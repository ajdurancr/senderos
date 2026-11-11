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

Dirty graph edits have a common navigation boundary. Scope changes and browser
history offer Stay here or Leave editor in a labeled native modal with focus
restoration and Escape cancellation. Document navigation uses the browser's
native unsaved-change prompt. A pending or unconfirmed save must not claim the
database was unchanged; retain inputs and revision checks for recovery.

Draft goal preparation uses explicit label associations and the same dirty-draft
navigation boundary as graph authoring. Save/cancel preparation precedes lifecycle
actions. Clearly distinguish assigning a published version to a draft from the
immutable version pinned after activation. Missing workflow choices guide the
operator to publication; they never offer an executable start without a version.

Run history uses a labeled native list and scope-preserving pagination links.
Selection is identified with `aria-current`; selecting a row focuses the attempt
detail anchor, which matters when the mobile layout stacks detail below the list.
History links focus the page heading. Keep scope totals distinct from page size
and preserve recorded evidence and recovery detail for exact older links.

Goal detail separates current visits from settled visit history. Keep every
unresolved branch visible; a failed activation can still require intervention.
Settled cards use native links, a named history navigation, persistent scoped
positions, selected-link semantics and a focusable history heading. Pagination
must preserve original visit numbers, pinned graph labels, parent/fork details
and selected-attempt records. Reuse the existing history spacing and surfaces.

Attempt detail exposes direct persisted retry links in both Runs and the canvas
inspector. Keep previous-attempt and retry links scoped to the same goal and
activation (the same step for legacy records). Label the viewed attempt explicitly;
its evidence and host records must not inherit the latest retry's decision. Goal
summary guidance remains separately labeled. Missing predecessors show an
unavailable state; never guess a relationship from timestamps or walk a cycle.

Project settings retain the project-ID remount boundary. Dirty configuration
requires confirmation before scope, page or history navigation; Stay here and
Escape preserve inputs. Discard changes restores the selected project's loaded
values without writing. Disable the configuration fieldset during a save, and
clear the dirty boundary only after confirmed success. A lost response retains
inputs with guidance to inspect saved settings before submitting again; settings
do not advertise revision checks that their update API does not provide.

Registration forms freeze their identity fields while a save is pending. An
unconfirmed response preserves the form and explains that registration may have
committed. Direct the operator to reload and inspect the scope selectors before
submitting again; do not imply the database stayed unchanged or retry silently.
