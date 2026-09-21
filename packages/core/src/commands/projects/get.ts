import { openRuntimeDb } from "../../db/client";
import { projects } from "../../db/schema";
import type { ProjectRecord } from "../../shared/types";
import { and, eq } from "drizzle-orm";
export async function getProject(
  id: string,
  home?: string,
  executionContextId?: string,
): Promise<ProjectRecord | null> {
  const db = openRuntimeDb(home);
  return (
    ((await db.select().from(projects).where(executionContextId
      ? and(eq(projects.id, id), eq(projects.executionContextId, executionContextId))
      : eq(projects.id, id)))[0] as
      | ProjectRecord
      | undefined) ?? null
  );
}
