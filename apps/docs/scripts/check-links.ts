import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputRoot = join(scriptDirectory, '..', 'dist');
const deploymentBase = '/senderos';
const origin = 'https://senderos.docs.local';

function collectFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? collectFiles(path) : [path];
  });
}

function routeForFile(file: string) {
  const outputPath = relative(outputRoot, file).split(sep).join('/');
  const route = outputPath === 'index.html'
    ? '/'
    : `/${outputPath.replace(/index\.html$/, '')}`;
  return `${deploymentBase}${route}`;
}

function withoutEmbeddedCode(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
}

function targetFileForPath(pathname: string) {
  if (pathname !== deploymentBase && !pathname.startsWith(`${deploymentBase}/`)) {
    return null;
  }

  const relativePath = decodeURIComponent(pathname.slice(deploymentBase.length))
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  const exact = join(outputRoot, relativePath);
  const candidates = extname(relativePath)
    ? [exact]
    : [exact, `${exact}.html`, join(exact, 'index.html')];

  return candidates.find((candidate) => existsSync(candidate) && !statSync(candidate).isDirectory()) ?? null;
}

function hasFragment(file: string, fragment: string) {
  if (!fragment) return true;
  const decoded = decodeURIComponent(fragment);
  const html = readFileSync(file, 'utf8');
  return html.includes(`id="${decoded}"`) || html.includes(`name="${decoded}"`);
}

if (!existsSync(outputRoot)) {
  throw new Error(`Documentation output not found at ${outputRoot}. Run the build first.`);
}

const htmlFiles = collectFiles(outputRoot).filter((file) => file.endsWith('.html'));
const failures: string[] = [];
let checkedLinks = 0;

for (const sourceFile of htmlFiles) {
  const sourceRoute = routeForFile(sourceFile);
  const html = withoutEmbeddedCode(readFileSync(sourceFile, 'utf8'));
  const hrefs = [...html.matchAll(/\bhref=(?:"([^"]*)"|'([^']*)')/gi)]
    .map((match) => match[1] ?? match[2] ?? '');

  for (const href of hrefs) {
    if (!href || /^(?:mailto:|tel:|data:|javascript:)/i.test(href)) continue;

    const target = new URL(href, `${origin}${sourceRoute}`);
    if (target.origin !== origin) continue;
    checkedLinks += 1;

    const targetFile = targetFileForPath(target.pathname);
    if (!targetFile) {
      failures.push(`${sourceRoute} -> ${href} (resolved to missing ${target.pathname})`);
      continue;
    }

    if (!hasFragment(targetFile, target.hash.slice(1))) {
      failures.push(`${sourceRoute} -> ${href} (fragment not found)`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Found ${failures.length} broken documentation link(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Validated ${checkedLinks} internal links across ${htmlFiles.length} generated pages.`);
