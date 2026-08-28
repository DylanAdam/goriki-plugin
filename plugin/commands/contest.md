---
description: Say that a frozen zone is too wide. It files one entry in the register and changes nothing else.
argument-hint: GRK-12
---

# Frozen zones — contest one

Run this, report its output to the builder, and stop. Do not run anything else.

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/contest.mjs" $ARGUMENTS
```

It files ONE entry in the register, for the builder to read. It is not an override: it changes no zone, it unblocks nothing, and a write that was refused is still refused. Only a decision changes a zone — sealing the decision is what frees the paths it froze.

If Goriki is unreachable, this token is revoked, or your plan lapses, frozen zones fail open — the gap is journaled.
