---
title: transition
description: "Create and inspect the directed handoffs that planning uses."
---

`senderos transition` manages agent transitions: the allowed handoffs through
which a goal can be dispatched.

```bash
senderos transition create \
  --source-agent-id <agent-id> \
  --target-agent-id <agent-id> \
  --name "Implementation handoff" \
  --objective "Implement the approved goal"
senderos transition list
senderos transition list --agent-id <agent-id>
senderos transition show <transition-id>
```
