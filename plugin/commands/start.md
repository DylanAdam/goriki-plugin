---
description: Start a project from an idea, in five questions.
---

# Start a project

This is the way in when the skill did not open by itself. Run the first command, put the questions to the builder one at a time, then run the second.

Say what you want to build and answer at most five short questions. The plan comes back drawn, with the reason it took that shape written beside it — and if that is not the shape of the work, saying so puts your objection on the record.

## Ask what to ask

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/start-project.mjs" --questions
```

Put the questions it prints to the builder one at a time, in the order they came, with the options it numbered. The words are the method’s: do not rewrite them, and do not add one of your own.

## Send the answers

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/start-project.mjs" --idea "<their words>" --stakes <their answer> --option <the number they chose>
```

Nothing is written on your machine and no code is read: the questions and the plan travel over the same bridge everything else does, and what comes back is text your agent prints.

Print what it prints back to the builder and stop there. The plan that comes back is theirs to read, and the next move is theirs to make.
