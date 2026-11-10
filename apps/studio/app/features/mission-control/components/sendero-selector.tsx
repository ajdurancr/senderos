import { useClientReady } from "../../../hooks/use-client-ready";
import { useLocation, useNavigate } from "react-router";
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
        disabled={!clientReady}
        aria-label="Sendero"
        value={senderoId}
        onChange={(event) =>
          navigate(`${senderoPath(event.target.value)}${location.search}`)
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
