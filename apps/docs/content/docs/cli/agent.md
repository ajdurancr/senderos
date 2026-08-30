---
title: agent
description: "Inspect the persisted agent definitions used by planning and dispatch."
---

`senderos agent` is a read-only inspection surface.

```bash
senderos agent list
senderos agent show <agent-id>
```

Agents are runtime records. A plan selects an agent through an active agent
transition; inspecting an agent does not launch work.
