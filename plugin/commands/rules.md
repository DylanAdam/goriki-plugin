---
description: Write the sealed Rules into this repository as one managed block, or close the block.
---

# The managed block

The skill is the ordinary way in — it triggers on its own when the Rules have moved. This command is here for the times it did not.

The sealed Rules can be written into the files your agents already read, as one fenced block in CLAUDE.md — and in AGENTS.md or .cursor/rules/goriki.mdc when you already have them. The flow is one way: your agent writes the block on your machine, and Goriki holds no write key. Outside the fence nothing is ever touched.

## Write or refresh it

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/write-rules-block.mjs"
```

A block edited inside the fence is never overwritten. It becomes a question instead: a calm two-option one when the edit is yours, and the interrupting one when an agent made it in a session.

## Stop managing it

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/write-rules-block.mjs" --close
```

Stopping is one gesture and it removes nothing: the block closes with a dated line, and every word inside it stays. It is your file.

Read what the command prints back to the builder. When it reports a difference, put the question it hands you to the builder and wait — do not choose for them.
