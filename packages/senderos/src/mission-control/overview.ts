import { listGoals } from '../commands/goals';
import { listProjects } from '../commands/projects';
import { listRuns } from '../commands/runs/execution';
import { status } from '../commands/status';

export function missionControlOverview(home?: string) {
  return { status: status(home), projects: listProjects(home), goals: listGoals(home), runs: listRuns(home) };
}
