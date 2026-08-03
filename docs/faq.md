# FAQ

## Is this just documentation with extra steps?

Documentation is written for humans to read in full. This is written to be traversed:
your agent gets the requirement, the decision that governs it and the rule that
constrains it — and nothing else. On a 4,200-entity project a task still compiles to
about 160 tokens.

## Does `COMPLETE` mean the agent has everything it needs?

**No, and this matters.** `COMPLETE` means the required kinds are present: a
requirement, a feature, a component. It does not check that the decisions and rules
governing them exist.

We measured this: on our benchmark corpus, **24% of the knowledge can be deleted —
including every rule — and all 24 contexts still report `COMPLETE`**. Read it as
"structurally sound", not "sufficient".

## What if I write knowledge that is wrong?

It stays wrong until someone corrects it, exactly like a comment or a wiki. Annona
validates structure, not truth: it catches a task implementing nothing, not a
requirement that misstates the business rule.

What it does give you is a small, reviewable diff in the same commit as the code, which
is a better chance of catching it than a wiki page nobody opens.

## How much work is keeping it up to date?

Measured on this repository: about **one line of knowledge per nine lines of code**, and
after a milestone, seventeen manual edits to resync statuses and relations — which is
why `annona done` exists. It is not free. It is also not the main cost of the workflow.

Long-term drift is unmeasured. Two milestones is not a trend.

## Can I use it on an existing codebase?

Yes, but expect a cold start. Annona will not infer architecture from code — that is the
point — so until the area you work in is modelled, contexts return `MISSING_CONTEXT`.

Model the feature you are touching, not the system. Four entities makes one task
compilable.

## Does it work with my agent?

Any agent that reads a file and runs a command. `annona compile` generates `CLAUDE.md`,
`AGENTS.md`, `CODEX.md` and `GEMINI.md` from one template — they differ only in the
filename. There is also an MCP server with seven read-oriented tools if your agent
speaks MCP.

Switching agents is a different file being read. There is no vendor code anywhere.

## Does it integrate with Jira / GitHub / Confluence?

No, and not by accident. Nothing is built that no observed usage has asked for. Paste
the ticket into the conversation, or let your agent fetch it with whatever tool it has,
and put the key in the task's `tags`.

## Can the AI write the knowledge for me?

It writes the entity files after interviewing you and showing you what it concluded —
split into confirmed, inferred and unknown — and you confirm before anything is written.

What it must never do is invent knowledge to fill a gap. If a decision does not exist,
the correct outcome is `MISSING_CONTEXT` and a question, not a plausible-sounding ADR.

## What happens if I delete `.annona/`?

Nothing, except you lose your local telemetry history. Everything else rebuilds with
`annona compile`. That is the design: if deleting it lost knowledge, it would be a
defect.

## Why not embeddings or semantic search?

Because determinism is the product. The same task yields byte-identical context every
run, so a bad agent run is reproducible and two contexts can be diffed. With similarity
search you get a different context each time and no way to debug it — at which point
this is a RAG pipeline with extra vocabulary.

## Does it slow me down?

The tool costs nothing measurable: 0.8 ms to compile a context, 0.09 ms cached. The
workflow costs a conversation — an interview, a brief to confirm, a plan to approve.

Whether that trade is worth it for your team is genuinely unproven. If a step feels like
bureaucracy, that is a product defect and worth reporting, not something to absorb.

## Is it production ready?

The tool is small, tested and deterministic. The **claim** is not proven: nobody has yet
measured whether an agent produces better work with compiled context than without it.
Use it if the idea appeals and you can tolerate that uncertainty.

## Which Node version?

22 or newer — it uses the built-in `node:sqlite`, so there is nothing to compile at
install time. The runtime needs a filesystem that supports file locking; network shares
and some FUSE mounts do not, and you will get a clear error if so.
