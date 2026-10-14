import { StatusBadge } from '../../../components/status-badge';
import { type AttemptSnapshot, relativeTime } from '../model';

/** Only web links are actionable. Imported evidence may contain arbitrary text. */
function evidenceUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}

export function EvidenceRecords({ snapshot, asOf }: { snapshot: AttemptSnapshot; asOf?: number }) {
  return <>
    <div className="evidence-list">
      {snapshot.evidence?.map(item => {
        const url = evidenceUrl(item.url);
        return <article key={item.id}><div>
          <strong>{item.label}</strong><span>{item.kind}</span>
          {item.summary && <p>{item.summary}</p>}
          {url && <a href={url} target="_blank" rel="noopener noreferrer">Open evidence: {item.label}</a>}
          {item.createdAt && <small>{relativeTime(item.createdAt, asOf)}</small>}
        </div></article>;
      })}
      {!snapshot.evidence?.length && <p>No evidence recorded for this attempt.</p>}
    </div>
    {snapshot.review && <section className="review-record" aria-label="Recorded review">
      <h3>Recorded review</h3><StatusBadge value={snapshot.review.status} />
      {snapshot.review.rationale && <p>{snapshot.review.rationale}</p>}
      <small>{snapshot.review.reviewer ?? 'Reviewer not recorded'}{snapshot.review.reviewedAt && ` · ${relativeTime(snapshot.review.reviewedAt, asOf)}`}</small>
    </section>}
  </>;
}
