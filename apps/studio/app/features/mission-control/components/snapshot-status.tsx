import { useEffect, useState } from 'react';
import { useClientReady } from '../../../hooks/use-client-ready';

/** Local time only ages the observation; it never updates host or lease facts. */
export function SnapshotStatus({ asOf, pending, refreshing = false, error = false, onRefresh }: { asOf?: number; pending: boolean; refreshing?: boolean; error?: boolean; onRefresh?: () => void }) {
  const clientReady = useClientReady();
  const [stale, setStale] = useState(false);
  const valid = typeof asOf === 'number' && Number.isFinite(asOf) && Math.abs(asOf) <= 8.64e15;
  useEffect(() => {
    const update = () => setStale(!valid || Date.now() - asOf! >= 60_000);
    update();
    const timer = window.setInterval(update, 15_000);
    return () => window.clearInterval(timer);
  }, [asOf, valid]);
  const timestamp = valid ? new Date(asOf).toISOString() : null;
  return <section className={`snapshot-status${stale ? ' snapshot-stale' : ''}`} aria-label="Snapshot freshness" aria-busy={refreshing}>
    <div>
      <p>{timestamp ? <>Snapshot loaded <time dateTime={timestamp}>{timestamp.slice(0, 19).replace('T', ' ')} UTC</time></> : 'Snapshot time unavailable'}</p>
      <p aria-live="polite">{stale ? 'Status may have changed. Refresh before acting on host or recovery information.' : 'Host and recovery information reflects this snapshot.'}</p>
      {error && <p role="alert">Status could not be refreshed. The previous snapshot and your edits are kept. Try Refresh status again.</p>}
    </div>
    <button type="button" className="button button-secondary" disabled={!clientReady || pending} aria-disabled={refreshing} onClick={() => { if (!refreshing) onRefresh?.(); }}>{refreshing ? 'Refreshing status…' : 'Refresh status'}</button>
  </section>;
}
