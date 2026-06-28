import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const threshold = Number(process.argv[2] ?? '90');
const coverageDir = process.argv[3] ?? 'coverage';
const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, '..');
const lcovPath = join(packageRoot, coverageDir, 'lcov.info');
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
      lcovPath,
    },
    null,
    2
  )
);

if (linePct < threshold || functionPct < threshold) {
  throw new Error(
    `Coverage threshold not met. lines=${linePct.toFixed(2)}%, functions=${functionPct.toFixed(2)}%, threshold=${threshold}%`
  );
}
