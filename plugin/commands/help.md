---
description: What Goriki installed on this machine, and how to take it off again.
---

# What this plugin put here

Read this list out to the builder, then stop. Do not run anything.

One install registers the MCP server, four hooks (SessionStart · PreToolUse · Stop · PreCompact), the escalation skill and the commands — and offers you a status line to paste, without touching the one you already run.

**Installed by `goriki`, in one operation:**

- the MCP server, registered as `plugin:goriki:goriki`. Its tools answer to
  `mcp__plugin_goriki_goriki__<tool>` — for example `mcp__plugin_goriki_goriki__goriki_context`;
- 4 hooks: `SessionStart` · `PreToolUse` · `Stop` · `PreCompact`;
- the escalation skill — how to hand a binding choice over instead of making it;
- the managed-block skill — how to write the sealed Rules into the files your agents already read;
- the entry skill — run `/goriki:start` and a sentence about what you want to build becomes a plan, in five questions; the skill also opens on its own when what you want is clear;
- the phase skill — run `/goriki:phase` and the questions of the phase you are in get asked one at a time, in your terminal; the skill also opens on its own when the intention is clear;
- and it OFFERS a status line — `/goriki:statusline` prints the configuration to
  paste and writes nothing, so nothing of yours is replaced;
- the commands — this one.

SessionStart calls your Goriki at the start of every session and injects your sealed Rules and pending decisions before the first turn — and starts the session anyway if it cannot · PreToolUse refuses writes inside the zones your unsealed CRITICAL decisions froze, naming the decision and its link — and lets the write through if it cannot reach your Goriki · Stop reminds you once when a session tries to end over an unsealed CRITICAL — with the decision, its question and its link — then lets the session close and records it; and it holds nothing at all if it cannot reach your Goriki · PreCompact re-serves your sealed Rules into the session each time it is compacted — and lets the compaction through untouched if it cannot reach your Goriki.

It composes with hooks you already have: nothing of yours is replaced, reordered or disabled, and where both rule on the same event, a deny of yours is never overridden.

**The token.** It is held by Claude Code's own plugin configuration; this plugin writes it into no file of its own.

## Removing it

```
claude plugin uninstall goriki
```

Everything the plugin configured goes with it, whatever it grew to include. Nothing keeps running and nothing phones home. A status line you pasted yourself stays where you put it — it was never the plugin's to take.

Two things are yours to close, because they are not the plugin's: revoke the project token in Settings — the Connect Agent screen's "Revoke & re-mint" would hand you a new live one — and close out the managed block if you were given one.
