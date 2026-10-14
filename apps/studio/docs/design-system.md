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

Manual evidence keeps kind `manual`; it does not satisfy a required `test` gate.
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
