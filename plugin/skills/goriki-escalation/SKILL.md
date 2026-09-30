---
name: goriki-escalation
description: Use mid-task, when work is under way and the next step would settle something that
  binds the product — the stack, the data model, a price or a limit, an outside service, a cut
  that cannot be walked back — or would move away from what the builder already decided, so that
  choosing it for the builder would commit them to it. Use it
  to tell an ordinary implementation choice, which is yours, from a binding one, which is theirs.
  Also use when the builder says "escalate this", "ask Goriki", "hand this to Goriki", or asks
  what Goriki has already decided.
---

# Escalation — the choice that is not yours to make

Work is under way and a choice appears that the builder has not made. Most of those are yours.
A few are theirs, and picking one of those on their behalf is how a product ends up somewhere
nobody chose. Two questions tell the two apart.

## When a choice is not yours

**Who pays if this is wrong?** If a wrong answer costs you a rewrite, it is yours. If it costs the
builder money, it is theirs. It is also theirs if it costs a promise to someone who paid them, or
an explanation they have to give to a user.

**What does going back cost?** If going back is a rename, a deleted file, or a different library,
do it and keep moving. If going back means migrating data that already exists, telling a user that
something they rely on changed, honouring or refunding what was charged, or unwinding an agreement
with something outside this repository, stop there.

Where that line usually falls, as illustration and never as trigger words: the stack the work
stands on; the data model once real rows exist; anything carrying a price or a limit; taking on an
outside service the builder now depends on; a cut that cannot be walked back.

Read them as consequences. "Migration" is the same word for a column added with a default and a
column dropped: the first is yours, the second is not. The word settles nothing — the two questions
do.

Price going back at the choice, not the step. When the options would give something on that
list different shapes, the first step toward one, however small, is the builder's pick.
A record answers it only if it names that choice; one that settled something nearby has not. An
addition that changes no shape stays yours.

## What stays with you

Everything the two questions leave below that line, which is nearly all of the work: how the code
is laid out, what things are named, which file something lives in, control flow, error handling,
tests, how you refactor, how you retry, what you log, which of two equivalent libraries you reach
for, the order you do things in. Decide, keep going, and say what you decided in your own summary,
so the builder sees it without having to answer for it.

Following a record nothing points away from is never a question, nor is work inside it that gives
nothing a new shape — in a file it names, on the model it fixes.

A packet is for a choice your task puts to you. Anything else you leave as it is, even a record you
doubt outside your task, goes in your summary.

Silence is the ordinary outcome here, and it is the right one. Stopping too often is the faster way
to fail: a builder interrupted over a variable name learns to wave interruptions through, and the
one that mattered goes through with them.

Do not:

- hand over a choice that has already been decided — read first. Moving away from it is not
  that: when the request, the repository, or your own judgment points away from the record, the
  disagreement is the builder's, even if you would keep the record. Hand it over, both sides named,
  and settle it in neither direction yourself;
- hand the same choice over twice — though a request to change a record is a new choice: it
  says what the builder wants; only their answer to a packet records it. Two binding choices in
  one task are two packets;
- hand a choice over because it feels large; hand it over because a wrong answer is expensive for
  somebody who is not you.

Being told to pick moves nothing across the line: below it the choice was already yours; above it
you prepare the options and the builder picks.

When a reversible call is genuinely close, take it, name it in your summary, and let the builder
correct it cheaply.

Hand it over before you touch the area it covers. While one is outstanding, keep working on
everything that does not depend on it: a question waiting on a human is not a stopped session.

## How to hand it over

- `goriki_context` — what this project is, where it stands, and what has already been decided. An
  answer that exists is not a question while nothing points elsewhere, so read before you ask
  or act.
- `goriki_ask` — hand the choice over as a decision packet: the question in the builder's words and
  short enough to read in one breath; two to four sentences of what you are grounding it on, plus
  `grounds` — one to eight short citations naming the artifact, file, or line range each of those
  sentences actually rests on, because a paragraph with nothing named under it is an assertion, not a
  grounding; and two to four options.

Each option carries a `key` first: a short, stable, lowercase name — starting with a letter or
digit, then any mix of letters, digits, `-`, `_`, no spaces. Your recommendation points at it
below, and a sealed decision references it forever, so pick one you would still recognise on
re-read, never a sentence. It also names what it gives up in
your own words, and carries an `effect` — the one word for what taking it does to the work: `proceed`
keeps this path going as planned, `amend-spec` changes the plan itself, `defer` parks it while you
keep working elsewhere, `abort` stops this path here.

An option can carry a `cost`, but only next to a `source` — a short label and the date you checked
it, written `YYYY-MM-DD`. A cost without a dated source will not reach the builder, so leave the
number off rather than attach one nobody can stand behind.

CRITICAL is for a choice the work cannot honestly continue past in that area, and it is the only
severity that carries a `frozen_paths` zone. It comes back as a pending ticket, and it resolves when
the builder answers — never by waiting on the call. PREFERENCE is for one the work can continue
either way; it carries no `frozen_paths` at all, it seals as it is sent, and comes straight back as
a rule — so moving away from a record is CRITICAL, whatever it carried: what depends on
which side wins cannot continue. Name your recommendation by the key of the option you would take — it has to be one you
actually offered — say in a sentence why, in your own reasoning, that is the one to take, and how
serious the whole question is — then wait for the answer instead of proceeding on it.

## The zone that waits — `frozen_paths`

A CRITICAL packet carries the zone that depends on the answer, proposed at the moment you ask and
never bolted on afterwards.

- repo-relative globs written with forward slashes: no leading `/`, no `..`, no backslashes, no
  drive letters;
- the zone this decision touches, never the repository. Sixty-four globs is the ceiling, and a list
  that long is the whole repository spelled the long way;
- an empty list is legal, and it comes back to the builder as "this decision freezes nothing". Say
  that, rather than leave the field out.

What you name here is what is refused to you while the answer is outstanding, so name it the size
it really is. A zone wide enough to stop the work is a hostage, and the builder is the one who pays
to get it back. Ordinary work inside it waits; it is not a new question.

## What this skill does not do

It does not run tests, build anything, or judge the work. It writes nothing on this machine and it
decides nothing for you. Goriki holds what the builder has decided; the work stays yours.
