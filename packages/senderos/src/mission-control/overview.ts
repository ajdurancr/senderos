import { listGoals } from '../commands/goals/list';
import { listProjects } from '../commands/projects/list';
import { listRuns } from '../commands/runs/list';
import { status } from '../commands/system/status';

export function missionControlOverview(home?: string) {
  return { status: status(home), projects: listProjects(home), goals: listGoals(home), runs: listRuns(home) };
}
