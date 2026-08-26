---
description: What Goriki installed on this machine, and how to take it off again.
---

# What this plugin put here

Read this list out to the builder, then stop. Do not run anything.

One install registers the MCP server, three hooks (SessionStart · PreToolUse · Stop), the escalation skill and the commands. The hooks are registered and silent for now — they are the places the guardrail will run, not the guardrail.

**Installed by `goriki`, in one operation:**

- the MCP server, registered as `plugin:goriki:goriki`. Its tools answer to
  `mcp__plugin_goriki_goriki__<tool>` — for example `mcp__plugin_goriki_goriki__goriki_context`;
- three hooks: `SessionStart` · `PreToolUse` · `Stop`;
- the escalation skill — how to hand a binding choice over instead of making it;
- the commands — this one.

It composes with hooks you already have: nothing of yours is replaced, reordered or disabled, and where both rule on the same event, a deny of yours is never overridden.

**The token.** It is held by Claude Code's own plugin configuration; this plugin writes it into no file of its own.

## Removing it

```
claude plugin uninstall goriki
```

Everything the plugin configured goes with it: hooks, the MCP registration, the skill and the commands. Nothing keeps running and nothing phones home.

Two things are yours to close, because they are not the plugin's: revoke the project token in Settings — the Connect Agent screen's "Revoke & re-mint" would hand you a new live one — and close out the managed block if you were given one.
