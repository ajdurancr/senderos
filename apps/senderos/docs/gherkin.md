# Gherkin

Executable scenarios are the approval contract for SDD work.

## Structure

```gherkin
Feature: <purpose>

  @s1
  Scenario: <observable behavior>
    Given ...
    When ...
    Then ...
```

## Rules

- Stable scenario tags: `@s1`, `@s2`, ...
- Observable outcomes only
- Error cases count as first-class behavior
