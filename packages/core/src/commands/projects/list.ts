import { openRuntimeDb } from "../../db/client";
import { projects } from "../../db/schema";
import type { ProjectRecord } from "../../shared/types";
import { asc, eq } from "drizzle-orm";
export async function listProjects(home?: string, executionContextId?: string): Promise<ProjectRecord[]> {
  const db = openRuntimeDb(home);
  const query = db.select().from(projects);
  return (await (executionContextId
    ? query.where(eq(projects.executionContextId, executionContextId)).orderBy(asc(projects.createdAt))
    : query.orderBy(asc(projects.createdAt)))) as ProjectRecord[];
}
