---
title: sendero
description: "Inspect versioned Senderos and update their node or edge configuration."
---

`senderos sendero` exposes the business operations for managing Sendero
definitions. Read operations accept either a Sendero ID or its stable slug.

```bash
senderos sendero list
senderos sendero show software-delivery
senderos sendero show software-delivery --version 1
senderos sendero versions
```

Node and edge changes are grouped by the entity they manage:

```bash
senderos sendero node update <node-id> --label "Clarify intent"
senderos sendero edge update <edge-id> \
  --name "ready for implementation" \
  --description "The specification is approved." \
  --objective "Implement the approved specification." \
  --status active
```

Canvas coordinates are not part of this command family. They are presentation
state owned by Mission Control and are persisted through its dedicated API.
