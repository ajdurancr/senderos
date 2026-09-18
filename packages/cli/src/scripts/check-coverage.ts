import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const lcov = readFileSync(resolve(import.meta.dir, '../../coverage/lcov.info'), 'utf8');
const records = lcov.split('end_of_record').filter((record) => {
  const source = record.match(/^SF:(.+)$/m)?.[1]?.replaceAll('\\', '/');
  return Boolean(source?.startsWith('src/') && !source.includes('/integration/') && !source.includes('/scripts/'));
});

const totals = records.reduce((result, record) => {
  result.linesFound += Number(record.match(/^LF:(\d+)$/m)?.[1] ?? 0);
  result.linesHit += Number(record.match(/^LH:(\d+)$/m)?.[1] ?? 0);
  result.functionsFound += Number(record.match(/^FNF:(\d+)$/m)?.[1] ?? 0);
  result.functionsHit += Number(record.match(/^FNH:(\d+)$/m)?.[1] ?? 0);
  return result;
}, { linesFound: 0, linesHit: 0, functionsFound: 0, functionsHit: 0 });

console.log(JSON.stringify({ files: records.length, ...totals }, null, 2));
if (!records.length || totals.linesHit !== totals.linesFound || totals.functionsHit !== totals.functionsFound)
  throw new Error('CLI production source must maintain 100% line and function coverage.');
