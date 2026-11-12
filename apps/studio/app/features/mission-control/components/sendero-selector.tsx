import { useClientReady } from "../../../hooks/use-client-ready";
import { useLocation, useNavigate } from "react-router";
import { senderoPath } from "../navigation";
import type { MissionControlData } from "../server";
import { Icon } from "./icons";

export function SenderoSelector({
  data,
  senderoId,
  hasUnsavedGraph = false,
}: {
  data: MissionControlData;
  senderoId: string;
  hasUnsavedGraph?: boolean;
}) {
  const clientReady = useClientReady();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedIndex = data.senderoGraphs.findIndex(
    (graph) => graph.sendero.id === senderoId,
  );

  return (
    <label className="sendero-selector">
      <span>
        <Icon name="nodes" /> Sendero {selectedIndex + 1} of{" "}
        {data.senderoGraphs.length}
      </span>
      <select
        disabled={!clientReady || hasUnsavedGraph}
        aria-describedby={hasUnsavedGraph ? "sendero-selection-help" : undefined}
        aria-label="Sendero"
        value={senderoId}
        onChange={(event) =>
          !hasUnsavedGraph && navigate(`${senderoPath(event.target.value)}${location.search}`)
        }
      >
        {data.senderoGraphs.map((graph) => (
          <option key={graph.sendero.id} value={graph.sendero.id}>
            {graph.sendero.name} · {graph.sendero.slug} · v{graph.version.version}
          </option>
        ))}
      </select>
      {hasUnsavedGraph && <small id="sendero-selection-help">Save or cancel graph edits before switching Senderos.</small>}
    </label>
  );
}
