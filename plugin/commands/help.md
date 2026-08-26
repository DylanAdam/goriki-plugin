---
description: What Goriki installed on this machine, and how to take it off again.
---

# What this plugin put here

Read this list out to the builder, then stop. Do not run anything.

**Installed by `goriki`, in one operation:**

- **the MCP server `goriki`** — the bridge to their project. Its tools appear under the plugin's
  own prefix, not under a bare `goriki` name;
- **three hooks** — `SessionStart`, `PreToolUse`, `Stop`. They compose with hooks the builder
  already had: nothing of theirs was replaced, reordered, or disabled;
- **the escalation skill** — how to hand a binding choice over instead of making it;
- **the commands** — this one.

**The token** was given at install time and is held by Claude Code's own plugin configuration.
Nothing in this plugin writes it into a file.

**To take it all off:** `claude plugin uninstall goriki`. Hooks, the MCP registration, the skill
and the commands go with it. The project token is separate — revoke it on the Connect Agent screen,
where it was minted.
