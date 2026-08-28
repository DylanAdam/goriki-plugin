---
name: goriki-rules
description: Use after a decision has just been sealed, or when the builder asks to write the
  sealed Rules into this repository, refresh the managed block, check whether the block is current,
  or stop managing it. Also use when they say "write the rules block", "update CLAUDE.md from
  Goriki", "sync the sealed decisions", or ask what the fenced Goriki block in their file is.
---

# The managed block — write it, never overwrite it

The sealed Rules can live in the files this repository's agents already read, as one fenced block.
The flow is one way: the bridge renders the bytes, and you write them here, on this machine. Goriki
holds no write key — you are the scribe.

## When to run it

- right after a decision has been sealed in this session;
- when the builder asks for it, in any of the words above.

Never on a timer, and never as a habit at the start of a session. This writes into somebody's
repository; it happens because something changed or because they asked.

## How to run it

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/write-rules-block.mjs"
```

It prints one line per file. `identical` means it wrote nothing at all, which is the ordinary
answer when the register has not moved. `created` and `updated` mean the block was written.

**Read what it prints back to the builder and stop there.** Do not edit the block by hand, do not
add anything of your own inside the fence, and do not touch a line outside it.

## When it reports a difference

The block was edited inside the fence, so nothing was overwritten. What comes next depends on who
edited it, and the command tells you which case it is.

- **Calm — the edit is the builder's.** Put two options to them, at the terminal, and wait for an
  answer: re-seal their edit, dated · restore the sealed block. Confirm the choice before acting.
  Do not raise anything, do not escalate, and do not describe their edit as a problem.
  - re-seal → hand the edited text over with `goriki_ask` so it becomes a sealed decision, then run
    the command again;
  - restore → run the command again with `--restore`.
- **Interrupting — an agent edited it in this session.** Hand it over with `goriki_ask`, CRITICAL,
  with the three options the command names: adopt the edit as a sealed decision · discard it and
  rewrite the block · stop managing this file.

In both cases the choice is the builder's. Do not pick one and do not proceed while you wait.

## Stopping

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/write-rules-block.mjs" --close
```

The block closes with a dated line and every word inside it stays. Nothing is deleted, the file is
the builder's, and a later run does not reopen a closed block.

## What this skill does not do

It does not run tests, build anything, or judge the work. It writes one block between two markers,
and outside those markers it changes nothing.
