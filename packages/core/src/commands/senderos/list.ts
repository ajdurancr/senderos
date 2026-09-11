import { asc, desc } from "drizzle-orm";

import { openRuntimeDb } from "../../db/client";
import { senderos } from "../../db/schema";
import type { SenderoRecord } from "../../shared/types";

export async function listSenderos(home?: string): Promise<SenderoRecord[]> {
  return (await openRuntimeDb(home)
    .select()
    .from(senderos)
    .orderBy(desc(senderos.isDefault), asc(senderos.slug))) as SenderoRecord[];
}
