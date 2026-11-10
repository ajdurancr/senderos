import { useClientReady } from "../hooks/use-client-ready";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { DurableLink as Link } from "../components/durable-link";
import { CommandPalette } from "../features/mission-control/components/command-palette";
import { Icon, SenderosMark } from "../features/mission-control/components/icons";
import { projectPath, senderoPath, type StudioLocation } from "../features/mission-control/navigation";
import { filterMissionControlData } from "../features/mission-control/scope-filters";
import type { MissionControlData } from "../features/mission-control/server";

const navigation = [
  ["now", "Now", "inbox"],
  ["canvas", "Workflow progress", "nodes"],
  ["goals", "Goals", "target"],
  ["runs", "Runs", "activity"],
  ["reviews", "Reviews", "check"],
] as const;

export function StudioLayout({ children, data, pending, route, search }: {
  children: React.ReactNode;
  data: MissionControlData;
  pending: boolean;
  route: StudioLocation;
  search: URLSearchParams;
}) {
  const navigate = useNavigate();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const clientReady = useClientReady();
  const view = route.view;
  const inSettings = ["settings", "agents", "senderos", "events"].includes(view);
  const contextId = search.get("context") ?? "";
  const projectId = search.get("project") ?? route.projectId ?? "";
  const availableProjects = data.projects.filter((item) => !contextId || item.executionContextId === contextId);
  const project = availableProjects.find((item) => item.id === projectId);
  const context = data.executionContexts.find((item) => item.id === contextId);
  const scopedData = useMemo(() => filterMissionControlData(data, contextId || undefined, projectId || undefined), [data, contextId, projectId]);

  // Carry only hierarchy filters between workspaces, never a stale selection or dispatch plan.
  const navigationSearch = new URLSearchParams();
  if (contextId) navigationSearch.set("context", contextId);
  if (projectId) navigationSearch.set("project", projectId);
  const withScope = (path: string) => `${path}${navigationSearch.size ? `?${navigationSearch}` : ""}`;
  const newGoalPath = withScope(`${projectPath(project?.id, "goals")}/new`);
  const closeNavigation = () => setNavigationOpen(false);
  const updateFilters = (nextContext: string, nextProject: string) => {
    const next = new URLSearchParams();
    if (nextContext) next.set("context", nextContext);
    if (nextProject) next.set("project", nextProject);
    // A scope change exits entity detail routes so no hidden selection can leak into the new scope.
    navigate(`/${view}${next.size ? `?${next}` : ""}`);
  };

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const desktop = window.matchMedia("(min-width: 901px)");
    const closeOnDesktop = () => { if (desktop.matches) setNavigationOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!navigationOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      // Keep global shortcuts from opening a second modal behind this drawer.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setNavigationOpen(false);
      }
      if (event.key !== "Tab") return;
      const focusable = sidebar.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select:not([disabled]), [tabindex="0"]');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !sidebar.current?.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !sidebar.current?.contains(document.activeElement))) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener("keydown", handleKey, true);
    return () => {
      document.removeEventListener("keydown", handleKey, true);
      document.body.style.overflow = previousOverflow;
      menuButton.current?.focus();
    };
  }, [navigationOpen]);

  return (
    <div className={`studio-shell${navigationOpen ? " navigation-open" : ""}`} data-client-ready={clientReady}>
      <a className="skip-link" href="#studio-content">Skip to content</a>
      {navigationOpen && <div className="navigation-backdrop" onClick={closeNavigation} aria-hidden="true" />}
      <aside ref={sidebar} id="studio-navigation" className="global-sidebar" role={navigationOpen ? "dialog" : undefined} aria-modal={navigationOpen || undefined} aria-label={navigationOpen ? "Studio menu" : undefined}>
        <div className="sidebar-brand-row">
          <Link className="studio-brand" aria-label="Senderos Studio" to={withScope("/now")} onClick={closeNavigation}>
            <SenderosMark /><span><strong>Senderos</strong><small>Studio</small></span>
          </Link>
          <button ref={closeButton} className="icon-button mobile-menu-close" type="button" aria-label="Close navigation" onClick={closeNavigation}><Icon name="x" /></button>
        </div>
        <div className="mobile-navigation-context">
          <span>{context?.name ?? "All execution contexts"}</span>
          <strong>{project?.name ?? "All projects"}</strong>
        </div>
        <Link className="button button-primary mobile-new-goal" to={newGoalPath} onClick={closeNavigation}><Icon name="plus" /> New goal</Link>
        <nav className="primary-navigation" aria-label="Studio navigation">
          <p>Workspace</p>
          <div className="daily-navigation">
            {navigation.map(([key, label, icon]) => (
              <Link key={key} className={view === key ? "active" : ""} aria-label={label} title={label} aria-current={view === key ? "page" : undefined} to={withScope(key === "canvas" ? projectPath(project?.id) : `/${key}`)} onClick={closeNavigation}>
                <Icon name={icon} /><span>{label}</span>
                {key === "reviews" && scopedData.queue.reviews.length > 0 && <em>{scopedData.queue.reviews.length}</em>}
              </Link>
            ))}
          </div>
          <Link className={`settings-link${inSettings ? " active" : ""}`} aria-label="Settings" title="Settings" aria-current={inSettings ? "page" : undefined} to={withScope("/settings")} onClick={closeNavigation}>
            <Icon name="settings" /><span>Settings</span>
          </Link>
        </nav>
        <div className="runtime-card" title={data.runtime.database.endpoint}>
          <span className="health-dot" /><div><strong>{data.runtime.database.remote ? "Database connected" : "Local database connected"}</strong>{pending && <small role="status">Applying change…</small>}</div>
        </div>
      </aside>

      <section className="studio-workspace" inert={navigationOpen}>
        <header className="project-header">
          <div className="mobile-brand-row">
            <button ref={menuButton} disabled={!clientReady} className="icon-button mobile-menu-trigger" type="button" aria-label="Open navigation" aria-expanded={navigationOpen} aria-controls="studio-navigation" onClick={() => setNavigationOpen(true)}>
              <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <Link to={withScope("/now")} className="mobile-brand">Senderos Studio</Link>
          </div>
          <div className="project-context scope-filters">
            <div className="project-symbol" aria-hidden="true">S</div>
            <div className="scope-selectors">
              <label><span className="visually-hidden">Execution context</span><select disabled={!clientReady} value={contextId} onChange={(event) => updateFilters(event.target.value, "")}>
                <option value="">All execution contexts</option>
                {data.executionContexts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select></label>
              <label><span className="visually-hidden">Project</span><select disabled={!clientReady} value={project?.id ?? ""} onChange={(event) => updateFilters(contextId, event.target.value)}>
                <option value="">All projects</option>
                {availableProjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select></label>
            </div>
          </div>
          <div className="header-tools">
            <CommandPalette data={scopedData} projectId={project?.id} />
            <Link className="icon-button activity-link" to={withScope("/events")} aria-label="Diagnostics and activity" title="Diagnostics and activity"><Icon name="clock" /></Link>
          </div>
        </header>
        <main id="studio-content" tabIndex={-1}>
          {inSettings && <div className="settings-heading">
            <header className="view-header"><div><h1>Settings</h1><p>Configure your project, agents, workflows, and system settings.</p></div></header>
            <nav className="settings-navigation" aria-label="Settings navigation">
              {([
                ["settings", "Project & database", "/settings"],
                ["agents", "Agents", "/agents"],
                ["senderos", "Senderos", data.senderoGraphs[0] ? senderoPath(data.senderoGraphs[0].sendero.id) : "/senderos"],
                ["events", "Diagnostics", "/events"],
              ] as const).map(([key, label, href]) => <Link key={key} to={withScope(href)} className={view === key ? "active" : ""} aria-current={view === key ? "page" : undefined}>{label}</Link>)}
            </nav>
          </div>}
          {pending && <div className="pending-bar" role="progressbar" aria-label="Applying change" />}
          {children}
        </main>
      </section>
    </div>
  );
}
