import { openRuntimeDb } from "../../db/client";
import { projects } from "../../db/schema";
import type { ProjectRecord } from "../../shared/types";
import { asc } from "drizzle-orm";
export async function listProjects(home?: string): Promise<ProjectRecord[]> {
  const db = openRuntimeDb(home);
  return (await db
    .select()
    .from(projects)
    .orderBy(asc(projects.createdAt))) as ProjectRecord[];
}
