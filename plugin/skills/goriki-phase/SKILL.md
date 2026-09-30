---
name: goriki-phase
description: Use when the builder is ready to work through the current phase of a project that
  already has a plan — "open the phase", "ask me the questions", "work through this phase", "let's
  do the next phase", "write the document for this phase" — and the questions of that phase have
  not been put to them yet. Use it to ask those questions one at a time and turn the answers into
  the phase's document. Do not use it to start a project from an idea, and do not use it for a
  choice that comes up in the middle of other work.
---

# The phase, one question at a time

A project already has a plan, and the builder is ready to work through the phase they are in. The
bridge holds the questions and the order; you ask them, one at a time, and write down nothing they
did not say.

## When this is the wrong skill

This is for a project that ALREADY HAS A PLAN and a phase to work through. It is not the way in from
an idea — a builder saying what they want to build for the first time is a different situation, with
its own skill, and nothing here runs before a plan exists. It is not for a fork in the middle of the
work either: a choice that comes up mid-task is something to hand over, not a phase to open.

If there is no plan yet, the first command below says so and stops. Read that out and stop with it.

## How to run it

Ask the bridge what to ask:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/phase-dialogue.mjs" --questions
```

It prints the phase, the document the answers will build, the questions in the order to ask them,
and the ones that are already settled. **The words are the method's, not yours.** Do not rewrite
them, shorten them, merge two into one, or add one of your own. If it prints a refusal instead, read
that out and stop there.

## Asking

Put the questions to the builder ONE AT A TIME, with the client's own question box, in the order
they came. Wait for each answer before asking the next.

- **Reflect back before moving on.** One short sentence saying what you understood, in their words.
  It is a restitution, not a rewrite: if you find yourself improving the sentence, you have stopped
  reflecting.
- **Never ask the same thing twice.** Anything the bridge printed as already settled is NOT asked
  again — say out loud that it was answered already and where, then move to the next question. A
  silent skip and a spoken one look the same to a machine and opposite to a person.
- **On a question marked as their own words only: offer NOTHING.** No options, no suggestions, no
  "would something like this work?". Free text or nothing. An answer you supplied is not a weaker
  answer, it is a different one wearing theirs.
- **Never answer for them, ever.** Not to save time, not because the answer seems obvious from what
  they said earlier, not to fill a gap in the document. If you did not hear it, it was not said.
- **If the question box is not available here, ask in plain text and say so out loud.** A question
  that cannot be rendered is asked in words; it is never left hanging.

## Skipping, which is allowed and never silent

If they skip a question, say so and move on:

> Noted as skipped. The draft will guess this one and mark the guess, so you can correct it later.

Every skipped question becomes one marked guess in the document, and the Gate says how many each
document still carries. That is the whole deal: skipping costs nothing except a mark somebody can
come back to.

**If the questions cannot be put to them at all** — no question box, no answer coming back, a
session that is not interactive — do not re-ask, do not wait, and do not answer for them. Skip the
phase in one gesture, and say the sentence the script prints when you do:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/phase-dialogue.mjs" --skip-all
```

A question that does not come back is not asked again. It is skipped, said, and marked.

## Sending the answers

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/phase-dialogue.mjs" --answer <question>=<what they said> --skip <question>
```

`--answer` takes the question's id, an equals sign, and their sentence exactly as they said it. Pass
one `--answer` per question they answered and one `--skip` per question they skipped. Say the
waiting line the first command printed before you run this one — it takes several seconds, and a
person watching a silent terminal has no way to know that is normal.

## What comes back, and what to do with it

One short block: the document, how many guesses it still carries, and where to read it.

**Print it exactly as it comes and stop.** Do not re-draw it, do not summarise it, do not add a plan
of your own underneath it, and do not start writing code because a document now exists. Print it as
plain text, never inside a code fence — it is a message to the builder. The next move is theirs.

## If they want to go deeper

The first command may say that more questions are available. **Offer the number, never the list**,
and only once: "there are three more that would sharpen this — want them?". If they say yes, ask
those the same way, one at a time. If they say no, that is the end of it; do not ask again.

There is also a short menu of moves for the document, and it has a command of its own because it
belongs AFTER the document, not before it. **That menu exists only if they ask for it** — "what else
can I do with this?" — never before, and never on your own initiative:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/phase-dialogue.mjs" --moves
```

Offer what came back one at a time, and applying one is their decision, never yours.

## If they say the questions do not fit

Take it seriously and hand it over as a question — `goriki_ask`, open, in their words, with an empty
`frozen_paths` and that emptiness stated. Their objection goes on the record; what happens to it is
theirs to settle.

## What this skill does not do

It does not run tests, build anything, or judge the work. It writes nothing on this machine, holds
no key to this repository, and reads no code. It does not decide what goes in the document — that
comes back from the bridge, written from what the builder said.
