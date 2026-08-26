---
name: goriki-escalation
description: Use when a choice in the work would bind the product — pricing, scope, a promise to a
  user, a decision the builder has not made yet — and the right move is to stop and hand it over
  rather than pick one. Also use when the builder says "escalate this", "ask Goriki", "hand this to
  Goriki", or asks what Goriki has already decided on a question.
---

# Escalation — hand the choice over instead of making it

A choice that binds the product is not yours to make. When you reach one, stop and hand it over.

## What a binding choice looks like

- it names a price, a limit, a promise, or a name the builder's customers will read;
- it settles something the builder has said nothing about, and a later change would cost work;
- it contradicts something already decided.

Everything else — how to write the loop, which file to touch, what to call the variable — is yours.

## How to hand it over

The bridge is the `goriki` MCP server, registered by this plugin. Read what has already been
decided before you ask anything: an answer that already exists is not a question.

- `goriki_context` — what this project is, which phase it is in, and what has been decided;
- `goriki_ask` — hand the choice over as a decision packet, with the options and what each one
  costs.

State the choice in the builder's words, name the options, and say what each one gives up. Do not
recommend one and do not proceed on a guess while you wait.

## What this skill does not do

It does not run tests, build anything, or judge your code. The bridge holds decisions; the work
stays yours.
