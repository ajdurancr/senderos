import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const threshold = Number(process.argv[2] ?? '90');
const coverageDir = process.argv[3] ?? 'coverage';
const lcovPath = join(process.cwd(), coverageDir, 'lcov.info');
const lcov = readFileSync(lcovPath, 'utf8');

let foundFiles = 0;
let linesFound = 0;
let linesHit = 0;
let functionsFound = 0;
let functionsHit = 0;

for (const line of lcov.split('\n')) {
  if (line.startsWith('SF:')) foundFiles++;
  if (line.startsWith('LF:')) linesFound += Number(line.slice(3));
  if (line.startsWith('LH:')) linesHit += Number(line.slice(3));
  if (line.startsWith('FNF:')) functionsFound += Number(line.slice(4));
  if (line.startsWith('FNH:')) functionsHit += Number(line.slice(4));
}

const linePct = linesFound === 0 ? 100 : (linesHit / linesFound) * 100;
const functionPct = functionsFound === 0 ? 100 : (functionsHit / functionsFound) * 100;

console.log(
  JSON.stringify(
    {
      files: foundFiles,
      lines: { hit: linesHit, found: linesFound, pct: Number(linePct.toFixed(2)) },
      functions: {
        hit: functionsHit,
        found: functionsFound,
        pct: Number(functionPct.toFixed(2)),
      },
      threshold,
    },
    null,
    2
  )
);

if (linePct < threshold || functionPct < threshold) {
  process.exitCode = 1;
  throw new Error(
    `Coverage threshold not met. lines=${linePct.toFixed(2)}%, functions=${functionPct.toFixed(2)}%, threshold=${threshold}%`
  );
}
