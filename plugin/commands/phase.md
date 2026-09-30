---
description: Work through the questions of the phase you are in, one at a time.
---

# Work through this phase

This is the way in when the skill did not open by itself. Run the first command, put the questions to the builder one at a time, then run the second.

The phase you are in has a short list of questions. They are asked one at a time, in your own terminal, and what you answer is written into the document in your words. Skipping is allowed and it is not silent: every question you skip is marked in the document as a guess, and the Gate says how many each document still carries.

## Ask what to ask

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/phase-dialogue.mjs" --questions
```

Put the questions it prints to the builder one at a time, in the order they came. The words are the method’s: do not rewrite them, and do not add one of your own. On a question marked as their own words only, offer nothing at all — free text or nothing.

## Send the answers

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/phase-dialogue.mjs" --answer <question>=<what they said> --skip <question>
```

Noted as skipped. The draft will guess this one and mark the guess, so you can correct it later.

## If they ask what else they can do with the document

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/phase-dialogue.mjs" --moves
```

Only when they ask, and only after the document exists. Offer what comes back one at a time; applying one is their decision, never yours.

## If the questions cannot be put to them at all

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/phase-dialogue.mjs" --skip-all
```

The questions could not be put to you here, so nothing was asked and nothing was answered for you: every one of them is being skipped, and the draft marks each as a guess you can correct.

Nothing is written on your machine and no code is read: the questions and the document travel over the same bridge everything else does, and what comes back is text your agent prints.

Print what it prints back to the builder and stop there. The document that comes back is theirs to read, and the next move is theirs to make.
