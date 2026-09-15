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
senderos sendero version list
```

The mutation surface describes intent rather than database records:

```bash
senderos sendero agent add software-delivery incident-responder --label "Respond"
senderos sendero connect software-delivery \
  --from mutation-tester \
  --to incident-responder \
  --name "escalate" \
  --objective "Respond to the discovered issue."
senderos sendero disconnect software-delivery \
  --from mutation-tester \
  --to incident-responder
senderos sendero agent remove software-delivery incident-responder
```

References may be agent slugs, agent IDs, node IDs, labels, or the `start` and
`end` boundary names. Removing an agent also removes its incident connections.
Canvas coordinates and raw node/edge updates are not exposed by this CLI.
