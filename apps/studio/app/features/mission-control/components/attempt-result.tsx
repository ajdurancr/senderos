/** Results are already part of safe attempt inspection; dispatch packets stay private. */
export function AttemptResult({ resultJson }: { resultJson: string }) {
  let result: Record<string, unknown> | undefined;
  try {
    const value: unknown = JSON.parse(resultJson);
    if (value && typeof value === 'object' && !Array.isArray(value)) result = value as Record<string, unknown>;
  } catch { /* Keep malformed retained text inspectable without inventing a result. */ }
  const empty = result && Object.keys(result).length === 0;
  return <section className="inspector-section" aria-label="Recorded result">
    <h3>Recorded result</h3>
    {empty ? <p>No result recorded for this attempt.</p> : <>
      <p>Host-reported content. Attempt status and review are shown separately.</p>
      {result ? <dl className="property-list">
        {typeof result.outcome === 'string' && <div><dt>Outcome</dt><dd style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{result.outcome}</dd></div>}
        {typeof result.summary === 'string' && <div><dt>Summary</dt><dd style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{result.summary}</dd></div>}
      </dl> : <p>The recorded result structure could not be read. Its original text is retained below.</p>}
      <details className="inspector-disclosure">
        <summary>Complete recorded result</summary>
        <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{result ? JSON.stringify(result, null, 2) : resultJson}</pre>
      </details>
    </>}
  </section>;
}
