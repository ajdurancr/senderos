import { getRunAttempt } from "../attempts/get";
export async function resumeAttempt(id: string, home?: string) {
  const attempt = await getRunAttempt(id, home);
  if (!attempt) throw new Error(`Run attempt not found: ${id}`);
  return { attempt, resumeCommand: attempt.resumeCommand };
}
