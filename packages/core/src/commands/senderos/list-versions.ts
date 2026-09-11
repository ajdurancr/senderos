import { asc } from "drizzle-orm";

import { openRuntimeDb } from "../../db/client";
import { senderoVersions } from "../../db/schema";
import type { SenderoVersionRecord } from "../../shared/types";

export async function listSenderoVersions(
  home?: string,
): Promise<SenderoVersionRecord[]> {
  return (await openRuntimeDb(home)
    .select()
    .from(senderoVersions)
    .orderBy(asc(senderoVersions.createdAt))) as SenderoVersionRecord[];
}
