import type { Database } from "bun:sqlite";
import { randomId, now } from "../utils/common";
export function emitEvent(db: Database, eventType: string, entityType: string, entityId: string, payload: unknown) {
  db.prepare("insert into events (id,event_type,entity_type,entity_id,payload_json,created_at) values (?,?,?,?,?,?)")
    .run(randomId("event"), eventType, entityType, entityId, JSON.stringify(payload ?? {}), now());
}
