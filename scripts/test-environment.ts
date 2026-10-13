/** Build test subprocess environments without reading inherited database credentials. */
export function testEnvironment(
  overrides: NodeJS.ProcessEnv = {},
  inherited: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of Object.keys(inherited)) {
    if (key === 'SENDEROS_DATABASE_URL' || key === 'SENDEROS_DATABASE_AUTH_TOKEN' || key === 'BUN_OPTIONS') continue;
    env[key] = inherited[key];
  }
  // Bun subprocesses, including installed shebangs, must not reload operator
  // settings from .env files after the inherited credentials were removed.
  return { ...env, NO_COLOR: '1', ...overrides, BUN_OPTIONS: '--no-env-file' };
}
