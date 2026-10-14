import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rmSync } from 'node:fs';

const runtime = process.env.STUDIO_E2E_RUNTIME;
if (!runtime) throw new Error('Playwright must supply an isolated runtime');
const initialized = Bun.spawnSync([process.execPath, 'e2e/runtime.ts', 'init'], { stdout: 'pipe', stderr: 'inherit' });
if (initialized.exitCode !== 0) throw new Error('Failed to create E2E prerequisites');
const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: process.env.STUDIO_E2E_PORT ?? '4179', SENDEROS_DATABASE_URL: `file:${join(runtime, 'senderos.db')}` };
delete env.SENDEROS_DATABASE_AUTH_TOKEN;
delete env.NODE_PATH;
const servePackage = fileURLToPath(import.meta.resolve('@react-router/serve/package.json'));
const child = spawn('node', [join(dirname(servePackage), 'bin.cjs'), './build/server/index.js'], { env, stdio: 'inherit' });
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { rmSync(runtime, { recursive: true, force: true }); process.exit(code ?? 0); });
