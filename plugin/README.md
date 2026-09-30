# goriki

One install registers the MCP server, four hooks (SessionStart · PreToolUse · Stop · PreCompact), the escalation skill and the commands — and offers you a status line to paste, without touching the one you already run.

## Install — three steps

It needs Node on your machine: the hooks are small Node scripts and Claude Code does not ship a runtime of its own. `node --version` is the whole of the check.

### 1. Mint a project token

Create your account, create your Project, and mint a project token on the Connect Agent screen. That screen prints step 3 with your own address and token already in it — copy it from there. The token is shown once.

### 2. Add the plugin marketplace

```
claude plugin marketplace add DylanAdam/goriki-plugin
```

### 3. Install it with your token

```
claude plugin install goriki@goriki-plugin --config goriki_url="<your Goriki address>/mcp" --config goriki_pat="<YOUR-TOKEN>"
```

You are done when the line under the three steps stops saying "Waiting for the first call…" and starts with "Last call:". What follows it is how long ago that call was, preceded by the name of the tool that made it when the session reports one.

## What it registers

- the MCP server, registered as `plugin:goriki:goriki`. Its tools answer to
  `mcp__plugin_goriki_goriki__<tool>` — for example `mcp__plugin_goriki_goriki__goriki_context`;
- 4 hooks: `SessionStart` · `PreToolUse` · `Stop` · `PreCompact`;
- the escalation skill — how to hand a binding choice over instead of making it;
- the managed-block skill — how to write the sealed Rules into the files your agents already read;
- the entry skill — run `/goriki:start` and a sentence about what you want to build becomes a plan, in five questions; the skill also opens on its own when what you want is clear;
- the phase skill — run `/goriki:phase` and the questions of the phase you are in get asked one at a time, in your terminal; the skill also opens on its own when the intention is clear;
- and it OFFERS a status line — `/goriki:statusline` prints the configuration to
  paste and writes nothing, so nothing of yours is replaced;
- the commands.

SessionStart calls your Goriki at the start of every session and injects your sealed Rules and pending decisions before the first turn — and starts the session anyway if it cannot · PreToolUse refuses writes inside the zones your unsealed CRITICAL decisions froze, naming the decision and its link — and lets the write through if it cannot reach your Goriki · Stop reminds you once when a session tries to end over an unsealed CRITICAL — with the decision, its question and its link — then lets the session close and records it; and it holds nothing at all if it cannot reach your Goriki · PreCompact re-serves your sealed Rules into the session each time it is compacted — and lets the compaction through untouched if it cannot reach your Goriki.

## Your own hooks

It composes with hooks you already have: nothing of yours is replaced, reordered or disabled, and where both rule on the same event, a deny of yours is never overridden.

A refusal from this hook replaces nobody else’s verdict: it is one hook’s answer among the ones you already have, and it never overrides or cancels a decision of yours.

Already added it by hand? Remove that entry first — it holds the same address, and a manual entry takes precedence over a plugin's, so the plugin's bridge would be masked in silence.

## Frozen zones

While a CRITICAL decision is unsealed, writes touching the paths that decision froze are refused with the decision, its question and its link. Everything else is untouched, and nothing waits on a round trip. The zone comes from the decision itself: goriki does not compute it, widen it or guess it, and the only thing that changes a zone is a decision.

If Goriki is unreachable, this token is revoked, or your plan lapses, frozen zones fail open — the gap is journaled.

What it does not see: a path a shell command builds from a variable, a heredoc or `find -exec`, or a path naming somewhere outside this project. Those are read literally or not at all, on purpose — guessing at them would mean refusing work nobody asked to have refused.

If a zone looks too wide, `/goriki:contest GRK-12` files one entry in the register for the builder to read. It is not an override: it changes no zone, and it unblocks nothing by itself. Only a decision changes a zone.

## Windows

On Windows, install the plugin rather than writing config by hand: the plugin brings its own .mcp.json and resolves its own file paths, so none is ever typed. The measured trap is in hand-written config — a path written C:/… and read C:\… leaves a server registered, never loaded, and silent. This bridge is an address rather than a program, so its by-hand form carries no path either.

## Removing it

```
claude plugin uninstall goriki
```

Everything the plugin configured goes with it, whatever it grew to include. Nothing keeps running and nothing phones home. A status line you pasted yourself stays where you put it — it was never the plugin's to take.

Two things are yours to close, because they are not the plugin's: revoke the project token in Settings — the Connect Agent screen's "Revoke & re-mint" would hand you a new live one — and close out the managed block if you were given one.

## The two values the install carries

- `goriki_url` — your bridge's address. This product has no single address: it
  is wherever your Goriki runs, and the Connect Agent screen knows;
- `goriki_pat` — your project token.
  It is held by Claude Code's own plugin configuration; this plugin writes it into no file of its own.
