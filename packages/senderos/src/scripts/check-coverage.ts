import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const threshold = Number(process.argv[2] ?? '90');
const coverageDir = process.argv[3] ?? 'coverage';
const perFileThreshold = Number(process.argv[4] ?? String(threshold));
const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, '..', '..');
const lcovPath = join(packageRoot, coverageDir, 'lcov.info');
const lcov = readFileSync(lcovPath, 'utf8');

let foundFiles = 0;
let linesFound = 0;
let linesHit = 0;
let functionsFound = 0;
let functionsHit = 0;
let currentFile: string | undefined;
const files = new Map<string, { linesFound: number; linesHit: number; functionsFound: number; functionsHit: number }>();

for (const line of lcov.split('\n')) {
  if (line.startsWith('SF:')) {
    foundFiles++;
    currentFile = line.slice(3);
    files.set(currentFile, { linesFound: 0, linesHit: 0, functionsFound: 0, functionsHit: 0 });
  }
  if (line.startsWith('LF:')) linesFound += Number(line.slice(3));
  if (line.startsWith('LH:')) linesHit += Number(line.slice(3));
  if (line.startsWith('FNF:')) functionsFound += Number(line.slice(4));
  if (line.startsWith('FNH:')) functionsHit += Number(line.slice(4));
  if (currentFile && line.startsWith('LF:')) files.get(currentFile)!.linesFound = Number(line.slice(3));
  if (currentFile && line.startsWith('LH:')) files.get(currentFile)!.linesHit = Number(line.slice(3));
  if (currentFile && line.startsWith('FNF:')) files.get(currentFile)!.functionsFound = Number(line.slice(4));
  if (currentFile && line.startsWith('FNH:')) files.get(currentFile)!.functionsHit = Number(line.slice(4));
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
      perFileThreshold,
      lcovPath,
    },
    null,
    2
  )
);

const undercoveredFiles = [...files.entries()].filter(([, metrics]) => {
  const fileLinePct = metrics.linesFound === 0 ? 100 : (metrics.linesHit / metrics.linesFound) * 100;
  const fileFunctionPct = metrics.functionsFound === 0 ? 100 : (metrics.functionsHit / metrics.functionsFound) * 100;
  return fileLinePct < perFileThreshold || fileFunctionPct < perFileThreshold;
});

if (linePct < threshold || functionPct < threshold || undercoveredFiles.length) {
  throw new Error(
    `Coverage threshold not met. lines=${linePct.toFixed(2)}%, functions=${functionPct.toFixed(2)}%, threshold=${threshold}%, perFileThreshold=${perFileThreshold}%, undercovered=${undercoveredFiles.map(([file]) => file).join(', ')}`
  );
}
