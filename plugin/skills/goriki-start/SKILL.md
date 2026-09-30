---
name: goriki-start
description: Use at the very start, when the builder says what they want to build — an idea stated
  in plain language, "I want to build", "I have an idea for", "let's start a project", "help me
  start" — and no map exists yet for it. Use it to open the short interview that turns that
  sentence into a plan, rather than beginning to write code from it. Do not use it once work is
  under way; a choice that comes up mid-task is a different situation and a different skill.
---

# Starting — four questions, and the work has a shape

Somebody has just said what they want to build. Before any of it is written, four short questions
settle what kind of work this is, and the plan comes back drawn. You ask the questions; the bridge
holds the method and does the arithmetic. You do not decide what kind of project this is.

## When this is the wrong skill

This is for the SENTENCE THAT STARTS SOMETHING — an intent to build, stated before there is a plan.
It is not for a fork in the middle of the work. When work is already under way and the next step
would settle something binding, that is a choice to hand over, not a project to start, and there is
a separate skill for it. The two do not overlap: nothing here runs once a map exists, and nothing
about escalating a mid-task choice belongs in this conversation.

If a map already exists for this project, the first command below says so and names where a new
project is started instead. Read that out and stop.

## How to run it

Ask the bridge what to ask:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/start-project.mjs" --questions
```

It prints the questions in the order to ask them, each with its options numbered from zero. **The
words are the method's, not yours.** Do not rewrite them, shorten them, merge two into one, or add
a fifth of your own. If it prints a refusal instead, read that out and stop there.

Then put them to the builder, ONE AT A TIME, with the client's own question box, two to four
options each, in the order they came. Wait for each answer before asking the next.

- **Reflect back before moving on.** One short sentence saying what you understood, in their words.
- **Never ask the same thing twice.** If an answer is already in what they said, do not ask it —
  say what you took from their sentence and move to the next question.
- **If the question box is not available here, ask in plain text and say so out loud.** A question
  that cannot be rendered is asked in words; it is never left hanging and never answered for them.
- The repository question takes `owner/name` if they have one, and nothing if they do not.
- The last question is about who is on the other side of this work. It is theirs to answer and it
  changes how carefully you stop later; nothing is recorded from it, so keep it in mind for the rest
  of the session rather than looking for it anywhere else.

Then send the answers:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/start-project.mjs" --idea "<what they want to build, their words>" --stakes <their answer> --option <the number they chose> --repo <owner/name if they gave one>
```

`--option` is the NUMBER printed beside the answer they picked on the second question. `--stakes` is
`toy`, `tool` or `product`, matching the option they picked on the first.

Say the waiting line the first command printed before you run this one — it takes several seconds,
and a person watching a silent terminal has no way to know that is normal.

## What comes back, and what to do with it

One block of text: how the answers added up, the plan as a tree, a link to the same plan in a
browser, and one sentence inviting the builder to disagree.

**Print it exactly as it comes and stop.** Do not re-draw the tree, do not summarise it, do not add
a plan of your own underneath it, and do not start writing code because a plan now exists. Print it
as plain text, never inside a code fence — it is a message to the builder, not a block of code. The
next move is the builder's.

## If they say it does not fit

Take it seriously and hand it over as a question — `goriki_ask`, open, in their words, with an empty
`frozen_paths` and that emptiness stated. Nothing here is a menu: do not offer them other ways of
working, do not name one, and do not pick a different one yourself. Their objection goes on the
record; what happens to it is theirs to settle.

## What this skill does not do

It does not run tests, build anything, or judge the work. It writes nothing on this machine and it
decides nothing about the shape of the project — that comes back from the bridge, already worked
out, with the reason attached.
