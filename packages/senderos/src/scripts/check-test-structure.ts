import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const sourceRoot = resolve(import.meta.dir, '..');
const sourceFiles: string[] = [];

function collect(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collect(path);
    else if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts') &&
      !path.includes('/scripts/') &&
      !path.includes('/test-support/')
    ) sourceFiles.push(path);
  }
}

collect(sourceRoot);

const missingSiblingTests = sourceFiles.filter((sourceFile) => {
  const source = readFileSync(sourceFile, 'utf8');
  const hasFunctions = /\b(?:export\s+)?(?:async\s+)?function\s+\w+|\bexport\s+const\s+\w+\s*=\s*(?:async\s*)?\(/.test(source);
  if (!hasFunctions) return false;
  const siblingTest = sourceFile.replace(/\.ts$/, '.test.ts');
  const directoryTest = join(resolve(sourceFile, '..'), 'index.test.ts');
  return !existsSync(siblingTest) && !existsSync(directoryTest);
});

const relativeMissingTests = missingSiblingTests.map((file) => relative(sourceRoot, file));
console.log(JSON.stringify({ sourceFiles: sourceFiles.length, missingSiblingTests: relativeMissingTests }, null, 2));

if (relativeMissingTests.length) {
  throw new Error(`Implementation files with functions require sibling tests: ${relativeMissingTests.join(', ')}`);
}
