export type NavItem = {
  slug: string;
  title: string;
  section: string;
};

export const SITE = {
  title: 'Senderos Docs',
  description:
    'Senderos is a local-first orchestration system for agent-driven software delivery: specs, queued work, coding runs, and durable status in one place.',
  repoUrl: 'https://github.com/ajdurancr/senderos'
};

export const NAVIGATION: { section: string; items: NavItem[] }[] = [
  {
    section: 'Overview',
    items: [
      { slug: 'introduction', title: 'Introduction', section: 'Overview' },
      { slug: 'why-senderos', title: 'Why Senderos Exists', section: 'Overview' }
    ]
  },
  {
    section: 'Core',
    items: [
      { slug: 'core/how-senderos-works', title: 'How Senderos Works', section: 'Core' },
      { slug: 'core/architecture', title: 'Architecture', section: 'Core' }
    ]
  },
  {
    section: 'Concepts',
    items: [
      { slug: 'concepts/domain-model', title: 'Domain Model', section: 'Concepts' }
    ]
  },
  {
    section: 'CLI',
    items: [
      { slug: 'cli/overview', title: 'CLI Overview', section: 'CLI' },
      { slug: 'cli/commands', title: 'Command Surface', section: 'CLI' }
    ]
  },
  {
    section: 'Agents',
    items: [
      { slug: 'agents/skills-and-harnesses', title: 'Skills and Harnesses', section: 'Agents' }
    ]
  },
  {
    section: 'Automation',
    items: [
      { slug: 'automation/worker-and-scheduling', title: 'Worker and Scheduling', section: 'Automation' }
    ]
  },
  {
    section: 'Operations',
    items: [
      { slug: 'operations/persistence-and-state', title: 'Persistence and State', section: 'Operations' },
      { slug: 'operations/safety-and-confirmations', title: 'Safety and Confirmations', section: 'Operations' }
    ]
  },
  {
    section: 'Getting Started',
    items: [
      { slug: 'getting-started/setup', title: 'Setup and First Run', section: 'Getting Started' }
    ]
  }
];

export const FLAT_NAV = NAVIGATION.flatMap((group) => group.items);

export function getNeighbors(slug: string) {
  const index = FLAT_NAV.findIndex((item) => item.slug === slug);
  return {
    previous: index > 0 ? FLAT_NAV[index - 1] : null,
    next: index >= 0 && index < FLAT_NAV.length - 1 ? FLAT_NAV[index + 1] : null
  };
}
