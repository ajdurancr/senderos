/** Preserve Promise.all results/first failure, but finish every sibling before releasing owned resources. */
export async function completeTogether<T extends readonly unknown[]>(values: readonly [...T]): Promise<{ -readonly [P in keyof T]: Awaited<T[P]> }> {
  // Normalize once: a Drizzle thenable can execute again if awaited twice.
  const pending = values.map(value => Promise.resolve(value));
  try {
    return await Promise.all(pending) as { -readonly [P in keyof T]: Awaited<T[P]> };
  } finally {
    await Promise.allSettled(pending);
  }
}
