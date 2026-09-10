import { DurableLink as Link } from "../components/durable-link";
import { CommandPalette } from "../features/mission-control/components/command-palette";
import { Icon, SenderosMark } from "../features/mission-control/components/icons";
import type { MissionControlData } from "../features/mission-control/server";
import { projectPath, senderoPath, type StudioLocation } from "../features/mission-control/navigation";

const navigation = [
  ["now", "Now", "inbox"],
  ["canvas", "Canvas", "nodes"],
  ["goals", "Goals", "target"],
  ["runs", "Runs", "activity"],
  ["reviews", "Reviews", "check"],
  ["agents", "Agents", "spark"],
  ["senderos", "Senderos", "nodes"],
  ["events", "Events", "clock"],
] as const;

export function StudioLayout({
  children,
  data,
  pending,
  route,
}: {
  children: React.ReactNode;
  data: MissionControlData;
  pending: boolean;
  route: StudioLocation;
}) {
  const view = route.view;
  const projectId = route.projectId ?? data.projects[0]?.id ?? "";
  const project = data.projects.find((item) => item.id === projectId) ?? data.projects[0];

  return (
    <main className="studio-shell">
      <aside className="global-sidebar">
        <Link className="studio-brand" to={projectPath(project?.id)}>
          <SenderosMark />
          <span><strong>Senderos</strong><small>Studio</small></span>
        </Link>
        <nav className="primary-navigation" aria-label="Studio navigation">
          <p>Workspace</p>
          {navigation.map(([key, label, icon]) => (
            <Link
              className={view === key ? "active" : ""}
              key={key}
              to={key === "senderos" && data.senderoGraphs[0] ? senderoPath(data.senderoGraphs[0].sendero.id) : projectPath(project?.id, key)}
            >
              <Icon name={icon} /><span>{label}</span>
              {key === "reviews" && data.queue.reviews.length > 0 && <em>{data.queue.reviews.length}</em>}
            </Link>
          ))}
          <p className="manage-label">Manage</p>
          <Link className={view === "settings" ? "active" : ""} to={projectPath(project?.id, "settings")}>
            <Icon name="settings" /><span>Settings</span>
          </Link>
        </nav>
        <div className="runtime-card">
          <span className="health-dot" />
          <div><strong>Database connected</strong><small>{pending ? "Applying change…" : data.runtime.database.endpoint}</small></div>
        </div>
      </aside>

      <section className="studio-workspace">
        <header className="project-header">
          <div className="project-context">
            <div className="project-symbol">{project?.name?.slice(0, 1).toUpperCase() ?? "S"}</div>
            <div>
              <select
                aria-label="Project"
                value={project?.id ?? ""}
                onChange={(event) => {
                  window.location.assign(projectPath(event.target.value, view));
                }}
              >
                {data.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <span><Icon name="branch" /> {project?.targetBranch ?? "No project"}</span>
            </div>
          </div>
          <div className="header-tools">
            <CommandPalette data={data} projectId={project?.id} />
            <Link className="icon-button" to={projectPath(project?.id, "events")} aria-label="Activity"><Icon name="clock" /></Link>
            <Link className="new-goal-button" to={`${projectPath(project?.id, "goals")}/new`}><Icon name="plus" /> New goal</Link>
          </div>
        </header>
        {pending && <div className="pending-bar" />}
        {children}
      </section>
    </main>
  );
}
