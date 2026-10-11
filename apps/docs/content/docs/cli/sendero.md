---
title: sendero
description: "Author, validate, and publish directed workflows with outcomes, backedges, fan-out, and explicit joins."
---

`senderos sendero` reads definitions by ID or stable slug and edits drafts.

```bash
senderos sendero create --slug research --name Research
senderos sendero import --file ./research.json
senderos sendero show research
senderos sendero publish research
senderos sendero draft research
senderos sendero show research --version 1
senderos sendero version list
```

Create a complete graph with import JSON:

```json
{
  "slug": "research",
  "name": "Research",
  "maxActivations": 20,
  "nodes": [
    { "key": "start", "kind": "start", "label": "Start" },
    { "key": "research", "kind": "agent", "label": "Research", "agentSlug": "researcher", "executionObjective": "Find the answer", "requirements": ["browser"] },
    { "key": "end", "kind": "end", "label": "End" }
  ],
  "edges": [
    { "source": "start", "target": "research" },
    { "source": "research", "target": "research", "condition": { "outcome": "needs_more" } },
    { "source": "research", "target": "end", "condition": { "outcome": "accepted" } }
  ]
}
```

An agent node owns its objective, `requirements` capability list, and optional
`completion: {"requireReview": true, "evidenceKinds": ["test"]}` policy.
Publication validates topology, outcomes, and budgets, and snapshots instructions.
Existing goals retain their published version and instructions. On upgrade, old
published nodes snapshot the instructions available at upgrade time; historical
publication instructions that were never stored cannot be recovered.

## Routing and joins

An absent or empty condition matches every successful completion. An outcome
condition matches `result.outcome` exactly. Every matching outgoing edge activates;
there is no implicit priority. Backedges create new activations and consume the
finite visit budget separately from retries. No match rejects the completion
report rather than silently choosing a route.

Ordinary convergence executes once per arrival. To aggregate branches, set the
join node's `joinForkNodeId` to its source fork's node key in imported JSON. The
join waits for activated descendants in that fork generation to arrive or exit
successfully; unselected paths are not awaited. A generation with no arrivals
does not invent a join execution. Nested forks and repeated cycles remain distinct.
Publication rejects entering a join again without its paired fork and rejects
crossed nested pairings: consume the inner join before the outer join. Successful
side exits to the end remain valid.

## Edit safely

```bash
senderos sendero draft research
senderos sendero replace research --file ./revised-graph.json --expected-version-id <draft-version-id> --expected-revision <reviewed-revision>
# Review the returned saved graph and its new revision before publication.
senderos sendero publish research --expected-version-id <draft-version-id> --expected-revision <saved-revision>
```

Graph reads return `revision`, a content fingerprint that also covers the live
agent definitions a draft would publish. The optional revision fences reject
same-draft edits or changed instructions since review; the version fence rejects
an unseen successor draft. Studio always supplies both. Automation that omits
these optional flags intentionally operates on the current draft. Replacement is
atomic and requires the draft version. A failed validation does not partially
replace topology. Node insertion/removal preserves the surviving node's
execution policies. Published executable definitions and labels are immutable; canvas coordinates
remain presentation-only metadata. Inspect command help for intent-level
agent and connection editing operations.
