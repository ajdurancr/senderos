Feature: Bootstrap the Senderos monorepo

  @s1
  Scenario: The repository is Bun-first and TypeScript-only
    Given the initial scaffold is complete
    When a human inspects the root workspace and app sources
    Then the monorepo uses Bun workspaces and app source code is TypeScript only

  @s2
  Scenario: The monorepo contains the first two apps
    Given the initial scaffold is complete
    When a human inspects the apps directory
    Then both `senderos` and `studio` exist as separate apps
