export function now() {
  return new Date().toISOString();
}
export function randomId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}
import { randomUUID } from 'node:crypto';
