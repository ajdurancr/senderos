export class LifecycleError extends Error {
  constructor(public code: string, message: string, public retryable = false, public nextAction?: string) {
    super(message);
    this.name = "LifecycleError";
  }
}
export function requireLifecycle(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new LifecycleError(code, message);
}
