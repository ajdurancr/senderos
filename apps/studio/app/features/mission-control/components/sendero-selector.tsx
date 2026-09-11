import { senderoPath } from "../navigation";
import type { MissionControlData } from "../server";
import { Icon } from "./icons";

export function SenderoSelector({
  data,
  senderoId,
}: {
  data: MissionControlData;
  senderoId: string;
}) {
  const selectedIndex = data.senderoGraphs.findIndex(
    (graph) => graph.sendero.id === senderoId,
  );

  return (
    <label className="sendero-selector">
      <span>
        <Icon name="nodes" /> Trail {selectedIndex + 1} of{" "}
        {data.senderoGraphs.length}
      </span>
      <select
        aria-label="Sendero"
        value={senderoId}
        onChange={(event) =>
          window.location.assign(senderoPath(event.target.value))
        }
      >
        {data.senderoGraphs.map((graph) => (
          <option key={graph.sendero.id} value={graph.sendero.id}>
            {graph.sendero.name} · v{graph.version.version}
          </option>
        ))}
      </select>
    </label>
  );
}
