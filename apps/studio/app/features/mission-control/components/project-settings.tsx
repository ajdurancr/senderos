import { useState } from "react";
import { Form, useNavigation } from "react-router";
import { StatusBadge } from "../../../components/status-badge";
import type { MissionControlData } from "../server";
import { Icon } from "./icons";

export function ProjectSettings({ project }: { project: MissionControlData["projects"][number] }) {
  const pending = useNavigation().state !== "idle";
  const [integrationMode, setIntegrationMode] = useState(project.integrationMode);
  const branchRequired = integrationMode !== "none";
  return <Form className="settings-section" method="post">
    <input type="hidden" name="intent" value="update-project" />
    <input type="hidden" name="projectId" value={project.id} />
    <header><div><Icon name="target" /><span><h2>Project</h2><p>Project identity and repository integration behavior.</p></span></div><StatusBadge value={project.status} /></header>
    <div className="settings-fields">
      <label>Name<input name="name" required defaultValue={project.name} /><small>Human-readable project identity.</small></label>
      <label>Repository<input value={project.githubOwner && project.githubRepo ? `${project.githubOwner}/${project.githubRepo}` : "No repository configured"} disabled /><small>Canonical GitHub repository.</small></label>
      <label>Integration mode<select name="integrationMode" value={integrationMode} onChange={event => setIntegrationMode(event.target.value as typeof integrationMode)}>
        <option value="github_pr">GitHub pull request</option>
        <option value="local_merge">Local merge</option>
        <option value="none">No repository integration</option>
      </select><small>How completed outcomes integrate.</small></label>
      <label>Target branch<input name="targetBranch" required={branchRequired} defaultValue={project.targetBranch} aria-describedby={`branch-help-${project.id}`} /><small id={`branch-help-${project.id}`}>{branchRequired ? "Required for repository integration. Enter the base branch for planned delivery." : "Optional while repository integration is disabled. You can leave this empty or retain a branch for later."}</small></label>
    </div>
    <footer><span>Changes update persisted project configuration.</span><button className="button button-primary" disabled={pending}>{pending ? "Saving…" : "Save project"}</button></footer>
  </Form>;
}
