# goriki

One install registers the MCP server, three hooks (SessionStart · PreToolUse · Stop), the escalation skill and the commands. The hooks are registered and silent for now — they are the places the guardrail will run, not the guardrail.

## Install — three steps

### 1. Mint a project token

Create your account, create your Project, and mint a project token on the Connect Agent
screen. That screen prints step 3 with your own address and token already in it — copy it from
there. The token is shown once.

### 2. Add the plugin marketplace

```
claude plugin marketplace add DylanAdam/goriki-plugin
```

### 3. Install it with your token

```
claude plugin install goriki@goriki-plugin --config goriki_url=<your Goriki address>/mcp --config goriki_pat=<YOUR-TOKEN>
```

You are done when the Connect Agent screen's line flips to "Last call: {tool} · {age}".

## What it registers

- the MCP server, registered as `plugin:goriki:goriki`. Its tools answer to
  `mcp__plugin_goriki_goriki__<tool>` — for example `mcp__plugin_goriki_goriki__goriki_context`;
- three hooks: `SessionStart` · `PreToolUse` · `Stop`;
- the escalation skill;
- the commands.

## It composes with what you already have

It composes with hooks you already have: nothing of yours is replaced, reordered or disabled, and where both rule on the same event, a deny of yours is never overridden.

Already added it by hand? Remove that entry first — it holds the same address, and a manual entry takes precedence over a plugin's, so the plugin's bridge would be masked in silence.

## Windows

On Windows, install the plugin rather than writing config by hand: the plugin brings its own .mcp.json and resolves its own file paths, so none is ever typed. The measured trap is in hand-written config — a path written C:/… and read C:\… leaves a server registered, never loaded, and silent. This bridge is an address rather than a program, so its by-hand form carries no path either.

## Removing it

```
claude plugin uninstall goriki
```

Everything the plugin configured goes with it: hooks, the MCP registration, the skill and the commands. Nothing keeps running and nothing phones home.

Two things are yours to close, because they are not the plugin's: revoke the project token where you minted it, and close out the managed block if you were given one.

## The two values the install carries

- `goriki_url` — your bridge's address. This product has no single address: it
  is wherever your Goriki runs, and the Connect Agent screen knows;
- `goriki_pat` — your project token. It is held by Claude Code's own plugin
  configuration; this plugin writes it into no file of its own.
