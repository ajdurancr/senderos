export type NavItem = {
  slug: string;
  title: string;
  description: string;
  section: string;
};

export const SITE = {
  title: 'Senderos',
  description:
    'The durable control plane for agent-driven software delivery. Turn intent into planned, auditable, and verifiable engineering work.',
  repoUrl: 'https://github.com/ajdurancr/senderos',
  docsUrl: 'https://ajdurancr.github.io/senderos/',
  version: 'v0.1 · active development',
};

export const NAVIGATION: { section: string; items: NavItem[] }[] = [
  {
    section: 'Start here',
    items: [
      { slug: 'introduction', title: 'What is Senderos?', description: 'The product, the problem, and the boundary.', section: 'Start here' },
      { slug: 'getting-started/setup', title: 'Install & configure', description: 'Run Senderos from source and initialize it.', section: 'Start here' },
      { slug: 'getting-started/quickstart', title: 'Quickstart', description: 'Take one goal from intent to execution.', section: 'Start here' },
      { slug: 'why-senderos', title: 'Why Senderos', description: 'Why coordination—not generation—is the bottleneck.', section: 'Start here' },
    ],
  },
  {
    section: 'Understand',
    items: [
      { slug: 'core/how-senderos-works', title: 'How it works', description: 'The end-to-end operating loop.', section: 'Understand' },
      { slug: 'concepts/domain-model', title: 'Domain model', description: 'Projects, goals, runs, attempts, and agents.', section: 'Understand' },
      { slug: 'core/architecture', title: 'Architecture', description: 'Runtime, CLI, Studio, storage, and host agents.', section: 'Understand' },
      { slug: 'core/reconciliation-and-dispatch', title: 'Planning & dispatch', description: 'How Senderos decides what can run next.', section: 'Understand' },
      { slug: 'core/verification', title: 'Verification', description: 'Evidence, reviews, tests, and quality gates.', section: 'Understand' },
    ],
  },
  {
    section: 'Operate',
    items: [
      { slug: 'studio/mission-control', title: 'Mission Control', description: 'Use Studio to review and operate active work.', section: 'Operate' },
      { slug: 'agents/skills-and-harnesses', title: 'Agents & harnesses', description: 'Connect OpenClaw, Codex, or Claude Code.', section: 'Operate' },
      { slug: 'automation/worker-and-scheduling', title: 'Automation', description: 'Drive the loop from a host scheduler.', section: 'Operate' },
      { slug: 'operations/persistence-and-state', title: 'Persistence', description: 'Local and remote libSQL runtime state.', section: 'Operate' },
      { slug: 'operations/safety-and-confirmations', title: 'Safety boundaries', description: 'What Senderos owns and what it refuses to own.', section: 'Operate' },
      { slug: 'operations/working-paths-and-guardrails', title: 'Working paths', description: 'Execution directories and filesystem guardrails.', section: 'Operate' },
    ],
  },
  {
    section: 'CLI reference',
    items: [
      { slug: 'cli/overview', title: 'Command overview', description: 'The complete machine-readable CLI surface.', section: 'CLI reference' },
      { slug: 'cli/init', title: 'init', description: 'Preview and create a runtime home.', section: 'CLI reference' },
      { slug: 'cli/bootstrap-agent-skill', title: 'bootstrap-agent-skill', description: 'Generate a host-agent operator skill.', section: 'CLI reference' },
      { slug: 'cli/doctor', title: 'doctor', description: 'Validate runtime and harness readiness.', section: 'CLI reference' },
      { slug: 'cli/config', title: 'config', description: 'Inspect and update configuration.', section: 'CLI reference' },
      { slug: 'cli/project', title: 'project', description: 'Register repository boundaries.', section: 'CLI reference' },
      { slug: 'cli/goal', title: 'goal', description: 'Create and manage durable outcomes.', section: 'CLI reference' },
      { slug: 'cli/agent', title: 'agent', description: 'Inspect persisted executor definitions.', section: 'CLI reference' },
      { slug: 'cli/transition', title: 'transition', description: 'Define and inspect agent handoffs.', section: 'CLI reference' },
      { slug: 'cli/plan', title: 'plan', description: 'Find dispatchable work without mutating state.', section: 'CLI reference' },
      { slug: 'cli/run', title: 'run', description: 'Dispatch, inspect, and cancel logical runs.', section: 'CLI reference' },
      { slug: 'cli/attempt', title: 'attempt', description: 'Track concrete external executions.', section: 'CLI reference' },
      { slug: 'cli/status', title: 'status', description: 'Inspect current runtime truth.', section: 'CLI reference' },
    ],
  },
  {
    section: 'Project',
    items: [
      { slug: 'project/status-and-roadmap', title: 'Status & roadmap', description: 'What works today and what comes next.', section: 'Project' },
      { slug: 'contributing/engineering-guide', title: 'Contributing', description: 'Change Senderos without breaking its contracts.', section: 'Project' },
    ],
  },
];

export const FLAT_NAV = NAVIGATION.flatMap((group) => group.items);

export function getNeighbors(slug: string) {
  const index = FLAT_NAV.findIndex((item) => item.slug === slug);
  return {
    previous: index > 0 ? FLAT_NAV[index - 1] : null,
    next: index >= 0 && index < FLAT_NAV.length - 1 ? FLAT_NAV[index + 1] : null,
  };
}
