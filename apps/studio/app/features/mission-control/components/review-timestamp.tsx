import { type AttemptSnapshot, relativeTime } from "../model";

/** Evidence and review writes have their own times, independent of host activity. */
export function ReviewTimestamp({ snapshot, updatedAt, asOf }: { snapshot: AttemptSnapshot; updatedAt: string; asOf: number }) {
  const records = [
    ...(snapshot.evidence ?? []).map(item => ({ label: "Evidence added", at: item.createdAt })),
    { label: "Review recorded", at: snapshot.review?.reviewedAt },
  ];
  const latest = records.filter((record): record is { label: string; at: string } => !!record.at && Number.isFinite(Date.parse(record.at)))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
  const record = latest ?? { label: "Attempt updated", at: updatedAt };
  if (!Number.isFinite(Date.parse(record.at))) return <span>Time unavailable</span>;
  return <span>{record.label} <time dateTime={new Date(record.at).toISOString()}>{relativeTime(record.at, asOf)}</time></span>;
}
