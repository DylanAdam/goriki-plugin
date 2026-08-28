---
description: Show the Goriki status line configuration for this machine — and change nothing.
---

# The status line

The status line reads a snapshot your session already fetched and renders one row: the phase, how many decisions are waiting, and the frozen zone when there is one. It reaches no network of its own and counts nothing — every value in it was served.

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/statusline-offer.mjs"
```

A settings file holds exactly one status line, so turning this one on would replace whatever you already run. That is yours to decide, not ours — the plugin never writes to your settings, and removing it therefore leaves nothing of ours behind and takes nothing of yours.

Run it, show the builder exactly what it printed, and stop. Do not edit any settings file yourself, and do not paste the configuration for them — deciding what sits in their status bar is theirs.
