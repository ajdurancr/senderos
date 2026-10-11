# PR #26 local verification evidence

Local verification captured before publication of this implementation; this is not deployment or remote CI evidence. Synthetic projects, agents, workspaces, sessions, and goals were used in an isolated QA database. Chrome in the cloud validation environment exercised the real Node production server on port 5181, without a `NODE_PATH` workaround. The final screenshots below were inspected as pixels, not inferred from source or accessibility text.

## Order and source identity

- The CLI-first gate was completed and reported before Studio testing. After revision-fence changes, the refreshed Core/CLI/strict-host gate passed at 03:22 UTC on 2026-10-11; only then did final Studio checks resume.
- Backend frozen fingerprint: `2e018381bef369f771d2dbf558932f4c829ef0fc4304c0085c498bbfb9bf2c1a`. Its manifest contains 259 tracked/nonignored source and test files in `packages/core/`, `packages/cli/`, `scripts/`, and `examples/`, plus `package.json`, `bunfig.toml`, and `tsconfig.base.json`: a path-sorted compact JSON array of `{path,sha256}` records, then SHA-256 of that JSON.
- Final Studio fingerprint: `fa316e12a791d7c96642d03cb4dcbb51a174f50a3445cc295eebcefda39b8d0e`.
- Studio fingerprint command, run from the repository root: `git ls-files -co --exclude-standard -- apps/studio | sort -u | xargs sha256sum | sha256sum`.
- Each production rebuild was followed by a server restart and browser refresh. The final DOM-loaded asset names were checked against the built client assets. Automated test and production-smoke totals are reported separately in the PR verification report.

The [external-host simulator report](external-host-report.json) contains the token-free strict-host scenarios and counts. It complements, rather than substitutes for, the browser interactions below.

## Browser scenario results

| Scenario | Actions and observed result |
| --- | --- |
| Custom agents | Created a custom role with its own slug, description, and instructions; edited it and saved repeatedly. Explicit Cancel followed by Back/Forward restored saved values rather than discarded text. Ordinary navigation retained normal browser history behavior. |
| New/import Senderos | Created a draft in Studio and imported a six-node conditional fanout graph. Invalid JSON retained the supplied text and displayed an error without creating a definition. Cancel from both create and import modes cleared discarded form state when revisiting with Back. |
| Graph editing and publication | Added/removed a node and arc; changed budget, objectives, completion policy, required capabilities, and an explicit join. Cancel restored the saved draft. Dirty state disabled publication and layout changes. Saved the reviewed graph, then published it successfully. Repeated v2 publish → v3 draft/edit/save/publish → v4 draft in one tab without reloading; no render error. A separate browser-authored graph exercised outcome-conditioned completion and a revision backedge. |
| Concurrent draft safety | Two tabs held the same draft. A newer save made the older publish fail. A later stale save failed while retaining the local budget value and conflict guidance. Explicit Cancel loaded the current draft; refreshed save/publication succeeded. No silent overwrite occurred. |
| Scoped dispatch | With ready activations in both Alpha and Beta contexts, filtered Dispatch all submitted only the reviewed Alpha IDs. Public Core readback confirmed only those runs were added; Beta remained ready. A second stale tab rejected replay without adding runs. The exhausted Alpha plan and a separate empty context had no Dispatch all action. |
| Branch/cycle monitoring | Inspected Research visit 1, Review visit 1, Research visit 2, and the parallel Test visit. Node clicks selected the exact node/attempt even though all nodes reused one agent. Research visit 2 was Claimed/Not started; Test was Started. Objectives and next actions matched the selected activation. |
| Host/session safety | Inspected declared capabilities, recorded preflight, synthetic workspace, distinct parent/worker sessions, lease expiry, and unknown recovery. Expired lease text explicitly required session inspection and did not claim that expiry stopped a process. No claim credential field appeared in the inspected UI. |
| Missing selections and navigation | A foreign attempt under another goal showed an explicit mismatch warning and no stop/review/evidence mutation forms. Empty context showed zero projects/ready items. Context-only Now links resolved the real project and plan route. Definition node and arc links stayed in the selected Sendero despite existing goals. |
| Interrupted/repeated gestures | Escape and navigation/pagehide during a held drag restored the original position; Back no longer resurrected a cancelled preview. A completed drag persisted after reload. A stale layout save was rejected after another tab changed the draft. Repeated gestures and navigation remained usable. |
| Responsive/readability | At approximately 700 CSS pixels wide (698–718 in the checks), labelled Agents/Senderos navigation and the complete New goal button remained available. The page had no document-level horizontal overflow; graph canvases retain their own scrolling. Authoring button contrast and opposing-edge label overlap were checked after fixes. |

## Selected final screenshots

All eight captures below were taken after the final production restart on the fingerprint above (03:56–03:58 UTC), with `studio-C5mg-HWn.js` confirmed in the rendered document and the production build. Images are direct browser captures; compact region crops omit unrelated page space. IDs and filesystem paths shown are synthetic QA values.

- [Invalid import](import-error.jpg): malformed input retained, clear error, usable retry button (form-region crop).
- [Explicit join authoring](join-policy.jpg): custom agent, objective, review/evidence policy, required capabilities, and fork selection (field-group crop).
- [Stale edit conflict](stale-graph-conflict.jpg): local edits retained, explicit Cancel/reload guidance, publication still blocked (footer crop). The local budget remained 34 while the saved draft was 35; Cancel loaded 35.
- [Branch and cycle](branch-cycle.jpg): separate Research visits, parallel Test, completed Review, and a distinct curved backedge label.
- [Failed activation](failed-state.jpg): failed node border/state and retry guidance; unvisited sibling nodes stay unvisited.
- [Scoped dispatch review](scoped-dispatch.jpg): reviewed Alpha activation IDs, three proposed actions, reserve-only wording (tray crop; the third row is below the tray's internal scroll). Two new Alpha goals and one Alpha retry were reserved; both Beta activations remained ready. [Token-free readback](dispatch-readback.json) records the exact reviewed IDs and resulting runs. Stale replay added nothing.
- [Host lifecycle and recovery](host-lifecycle.jpg): capability/preflight snapshot, distinct sessions, expiry, unknown recovery, and explicit safety guidance (host-panel crop).
- [Narrow navigation](responsive-navigation.jpg): labelled authoring navigation, complete New goal button, and the two untouched Beta ready items; no document-level horizontal overflow.

## Limits

This is representative functional/visual QA, not an exhaustive accessibility audit or device/browser matrix. The browser did not launch real external workers; public Core operations prepared meaningful claimed, started, completed, branch/cycle, lease-expired, and recovery-unknown fixture states. Actual execution protocol behavior is covered separately by the CLI-first gate and strict-host simulator. Long graphs and host records require scrolling; the selected captures show relevant regions rather than every possible state.
