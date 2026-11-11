import { completeTogether } from "../../shared/complete-together";
import { getSenderoGraph, listSenderos } from "../../commands/senderos";
import type { SenderoGraph } from "../../shared/types";

export async function listSenderoGraphs(home?: string) {
  const records = await listSenderos(home);
  const graphs = await completeTogether(
    records.map((item) => getSenderoGraph(item.id, undefined, home)),
  );
  return graphs.filter(Boolean) as SenderoGraph[];
}
