import type { MissionControlData } from "../server";
import { completionActions } from "../model";

type Prerequisites = NonNullable<MissionControlData["decisions"][number]["completion"]>;

/** Read-only facts supplied by the pinned Core policy, never a UI gate decision. */
export function CompletionPrerequisites({ completion }: { completion: Prerequisites }) {
  return <section className="review-record" aria-label="Completion prerequisites">
    <h3>Completion prerequisites</h3>
    <p>Execution has reported completion. Finish the remaining workflow requirements:</p>
    <ul>
      {completionActions(completion).map(action => <li key={action}>{action}</li>)}
    </ul>
    {!completion.missingEvidenceKinds.length && !completion.missingReview && <p>No unmet prerequisites are recorded. Refresh status before taking another action.</p>}
  </section>;
}
