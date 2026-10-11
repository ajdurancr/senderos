---
title: Working Paths and Guardrails
description: "Grant portable workspace references and verify each host's actual local path."
---

Senderos does not create, mount, clone, synchronize, or inspect remote workspaces.
The project owner grants a host a portable workspace reference. The host verifies
its own filesystem, then declares that workspace available at its actual local
path using `host workspace`. Preflight rejects a missing grant or unavailable path.

`attempt start` records the verified executing path along with an independent
worker session and distinct parent. A laptop path is not automatically valid on a
VPS, and a previous attempt's path is not proof that another host can access it.
Instructions and predecessor results are in the execution packet; transfer large
artifacts explicitly through an authorized service when another host needs them.

The Senderos home is separate from the project workspace. It contains runtime
configuration, the default local database, logs, cache, and artifacts. Initialization
keeps its local database under that home. Multiple local contexts can initialize
separately and then select the shared database and register their contexts there;
see [host](../../cli/host).
