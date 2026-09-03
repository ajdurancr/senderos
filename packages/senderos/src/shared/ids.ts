export function now() { return new Date().toISOString(); }
export function randomId(prefix: string) { return `${prefix}-${Math.random().toString(36).slice(2, 10)}`; }
