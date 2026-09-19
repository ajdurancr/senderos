import { getRunAttempt } from "../attempts/get";
export async function getAttempt(id: string, home?: string, executionContextId?: string) {
  return getRunAttempt(id, home, executionContextId);
}
