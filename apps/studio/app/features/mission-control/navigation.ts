export type StudioLocation = {
  view: string;
  projectId?: string;
  goalId?: string;
  agentId?: string;
  attemptId?: string;
  transitionId?: string;
  create: boolean;
};

const encode = encodeURIComponent;

export function projectPath(projectId: string | undefined, view = "canvas") {
  if (!projectId) return `/${view}`;
  return `/projects/${encode(projectId)}/${view}`;
}

export function goalPath(projectId: string, goalId: string) {
  return `${projectPath(projectId)}/goals/${encode(goalId)}`;
}

export function canvasEntityPath(input: {
  projectId: string;
  goalId: string;
  transitionId?: string;
  attemptId?: string;
}) {
  let path = goalPath(input.projectId, input.goalId);
  if (input.transitionId) path += `/transitions/${encode(input.transitionId)}`;
  if (input.attemptId) path += `/attempts/${encode(input.attemptId)}`;
  return path;
}

export function canvasAgentPath(projectId: string, goalId: string, agentId: string) {
  return `${goalPath(projectId, goalId)}/agents/${encode(agentId)}`;
}

export function attemptPath(projectId: string | undefined, attemptId: string) {
  return `${projectPath(projectId, "runs")}/attempts/${encode(attemptId)}`;
}

export function parseStudioPath(pathname: string): StudioLocation {
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] !== "projects") {
    const view = parts[0] ?? "canvas";
    return {
      view,
      attemptId: parts[1] === "attempts" ? parts[2] : undefined,
      create: view === "goals" && parts[1] === "new",
    };
  }
  const projectId = parts[1];
  const view = parts[2] ?? "canvas";
  const valueAfter = (key: string) => {
    const index = parts.indexOf(key);
    return index >= 0 ? parts[index + 1] : undefined;
  };
  return {
    view,
    projectId,
    goalId: valueAfter("goals"),
    agentId: valueAfter("agents"),
    transitionId: valueAfter("transitions"),
    attemptId: valueAfter("attempts"),
    create: view === "goals" && parts[3] === "new",
  };
}
