import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { minimumCoverage } from './coverage-policy';

const lineThreshold = Number(process.argv[2] ?? minimumCoverage);
const functionThreshold = Number(process.argv[3] ?? minimumCoverage);
const perFileThreshold = Number(process.argv[4] ?? minimumCoverage);
const packageRoot = process.cwd();
const sourceRoot = resolve(packageRoot, 'src');
const lcovPath = resolve(packageRoot, 'coverage/lcov.info');

for (const [name, value] of Object.entries({
  lineThreshold,
  functionThreshold,
  perFileThreshold,
})) {
  if (!Number.isFinite(value) || value < minimumCoverage || value > 100) {
    throw new Error(
      `${name} must be between ${minimumCoverage} and 100; received ${value}.`,
    );
  }
}

if (!existsSync(lcovPath)) {
  throw new Error(`Coverage report not found: ${lcovPath}`);
}

const excludedSource = /(^|\/)(integration|scripts|test-support)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$|\.d\.ts$/;
const sourceGlob = new Bun.Glob('**/*.{ts,tsx,js,jsx,mts,mjs,cts,cjs}');
const sourceFiles = new Set(
  [...sourceGlob.scanSync({ cwd: sourceRoot, onlyFiles: true })]
    .map((file) => file.replaceAll('\\', '/'))
    .filter((file) => !excludedSource.test(file)),
);

type FileCoverage = {
  linesFound: number;
  linesHit: number;
  functionsFound: number;
  functionsHit: number;
};

const coveredFiles = new Map<string, FileCoverage>();
let currentFile: string | undefined;

for (const line of readFileSync(lcovPath, 'utf8').split('\n')) {
  if (line.startsWith('SF:')) {
    const reportPath = line.slice(3).replaceAll('\\', '/');
    const absolutePath = resolve(packageRoot, reportPath);
    const sourcePath = relative(sourceRoot, absolutePath).replaceAll('\\', '/');
    currentFile = sourceFiles.has(sourcePath) ? sourcePath : undefined;
    if (currentFile) {
      coveredFiles.set(currentFile, {
        linesFound: 0,
        linesHit: 0,
        functionsFound: 0,
        functionsHit: 0,
      });
    }
    continue;
  }

  if (!currentFile) continue;
  const coverage = coveredFiles.get(currentFile);
  if (!coverage) continue;
  if (line.startsWith('LF:')) coverage.linesFound = Number(line.slice(3));
  if (line.startsWith('LH:')) coverage.linesHit = Number(line.slice(3));
  if (line.startsWith('FNF:')) coverage.functionsFound = Number(line.slice(4));
  if (line.startsWith('FNH:')) coverage.functionsHit = Number(line.slice(4));
}

const missingFiles = [...sourceFiles].filter((file) => !coveredFiles.has(file));
const totals = [...coveredFiles.values()].reduce(
  (result, coverage) => ({
    linesFound: result.linesFound + coverage.linesFound,
    linesHit: result.linesHit + coverage.linesHit,
    functionsFound: result.functionsFound + coverage.functionsFound,
    functionsHit: result.functionsHit + coverage.functionsHit,
  }),
  { linesFound: 0, linesHit: 0, functionsFound: 0, functionsHit: 0 },
);

const percentage = (hit: number, found: number) =>
  found === 0 ? 100 : (hit / found) * 100;
const lineCoverage = percentage(totals.linesHit, totals.linesFound);
const functionCoverage = percentage(
  totals.functionsHit,
  totals.functionsFound,
);
const undercoveredFiles = [...coveredFiles.entries()].filter(([, coverage]) =>
  percentage(coverage.linesHit, coverage.linesFound) < perFileThreshold ||
  percentage(coverage.functionsHit, coverage.functionsFound) < perFileThreshold
);

console.log(JSON.stringify({
  sourceFiles: sourceFiles.size,
  coveredFiles: coveredFiles.size,
  missingFiles,
  lines: Number(lineCoverage.toFixed(2)),
  functions: Number(functionCoverage.toFixed(2)),
  thresholds: {
    minimum: minimumCoverage,
    lines: lineThreshold,
    functions: functionThreshold,
    perFile: perFileThreshold,
  },
}, null, 2));

if (
  missingFiles.length ||
  lineCoverage < lineThreshold ||
  functionCoverage < functionThreshold ||
  undercoveredFiles.length
) {
  throw new Error(
    [
      'Coverage policy failed.',
      missingFiles.length ? `missing=${missingFiles.join(', ')}` : '',
      `lines=${lineCoverage.toFixed(2)}%`,
      `functions=${functionCoverage.toFixed(2)}%`,
      undercoveredFiles.length
        ? `undercovered=${undercoveredFiles.map(([file]) => file).join(', ')}`
        : '',
    ].filter(Boolean).join(' '),
  );
}
