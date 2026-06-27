---
title: Command Surface
description: "A practical command map for feature orchestration, agent sessions, scheduling, and operations."
---

## Core command groups

### Discovery and setup

```bash
senderos init
senderos doctor
senderos capability list --json
senderos config get
senderos config set
senderos auth status
```

### Sources

```bash
senderos source add
senderos source list
senderos source test
senderos source sync
senderos source update
```

### Features and specs

```bash
senderos feature create
senderos feature list
senderos feature show <feature-id>
senderos feature approve <feature-id>
senderos feature kickoff <feature-id>
senderos spec start <feature-id>
senderos gherkin generate <feature-id>
```

### Runs and sessions

```bash
senderos run list
senderos run show <run-id>
senderos run retry <run-id>
senderos session list
senderos session status <session-id>
senderos session resume <session-id>
senderos session logs <session-id>
```

### Queue, worker, and scheduling

```bash
senderos queue list
senderos worker tick
senderos worker reconcile
senderos schedule list
senderos schedule add
senderos schedule update
```

### Repo and maintenance

```bash
senderos repo status
senderos repo cleanup <workspace-id>
senderos event list
senderos report stale
senderos backup
```

## Example: spec to implementation

```bash
senderos feature create
senderos spec start feature-101
senderos feature approve feature-101
senderos gherkin generate feature-101
senderos feature kickoff feature-101
senderos feature status feature-101
```

## Example: operator asking for current truth

```bash
senderos run list --active
senderos session list --stale
senderos report blocked
senderos queue list
```

## A note on command design

The command surface should provide **full operational access** to Senderos, but always under policy and permission boundaries. Full access does not mean reckless access.
