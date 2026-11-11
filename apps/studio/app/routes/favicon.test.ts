import { afterEach, expect, it, vi } from 'vitest';
import { loader } from './favicon';

afterEach(() => vi.unstubAllEnvs());

it('redirects legacy icon requests without requiring a database connection', () => {
  vi.stubEnv('SENDEROS_DATABASE_URL', undefined);
  vi.stubEnv('SENDEROS_DATABASE_AUTH_TOKEN', undefined);
  const response = loader();
  expect(response.status).toBe(302);
  expect(response.headers.get('Location')).toBe('/favicon.svg');
  expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400');
});
