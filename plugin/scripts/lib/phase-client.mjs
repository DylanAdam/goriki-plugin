/**
 * THE CLIENT HALF OF THE GUIDED PHASE DIALOGUE — PURE, and pure so that it can be MEASURED
 * (Story 8.12 · FR-10 · D118, D125, D126, D129, D135).
 *
 * ── WHY THERE IS A CLIENT HALF AT ALL ──────────────────────────────────────────────────────────
 *
 * The plugin ships as bare files on a builder's disk with NO `node_modules`, so it cannot import
 * `@goriki/shared` and cannot read a method pack. Everything that needs the method, the register or
 * the pack happens on the SERVER, which answers TEXT; this module does the two things that can only
 * happen where the terminal is — reading the arguments the agent passed, and refusing a response
 * whose shape it does not recognise before anything is printed from it.
 *
 * **It re-spells no question and no sentence of the method.** Every `text` arrives in the server's
 * answer. What is written here is the handful of lines about THIS SCRIPT's own failures, plus the
 * two sentences the product owns about skipping and about a dialogue that could not be held — and
 * those two are pinned BYTE FOR BYTE against `PLUGIN_COPY` by a Vitest, because a script that cannot
 * import a constant is a script whose copy drifts (motif 82-7).
 *
 * The pattern is 83-8's, the one 8.5's `rules-block-client.mjs` states: *"logique pure dans une lib,
 * importée par des tests Vitest"* — `packages/claude-plugin/src/phase-dialogue.test.ts` imports this
 * file directly, so every branch below is exercised without spawning anything.
 *
 * Nothing in this file touches a filesystem, a network or a clock. Its entry point does.
 */

/** The two things this script can be asked to do. Named, so a typo is a refusal and not a mode. */
export const PHASE_MODES = ['questions', 'moves', 'submit'];

/**
 * THE TWO SENTENCES THIS SCRIPT SAYS THAT ARE THE PRODUCT'S AND NOT ITS OWN.
 *
 * They cannot be imported (no `node_modules` on a builder's disk), so they are written here and
 * pinned byte for byte against `PLUGIN_COPY.PHASE_SKIP_SAID` and `PLUGIN_COPY.PHASE_FALLBACK` by a
 * test in this repository. That brace is 82-7's, and it exists because the alternative — a sentence
 * typed twice, in two languages, in two release cadences — is a sentence that will one day be two.
 */
export const SKIP_SAID =
  'Noted as skipped. The draft will guess this one and mark the guess, so you can correct it later.';
export const FALLBACK_SAID =
  'The questions could not be put to you here, so nothing was asked and nothing was answered for ' +
  'you: every one of them is being skipped, and the draft marks each as a guess you can correct.';

/**
 * THE OFFER OF THE RESERVE QUESTIONS — a THIRD sentence pinned byte for byte, added round 4.
 *
 * `PLUGIN_COPY.PHASE_RESERVE_OFFER`/`PHASE_RESERVE_UNCALIBRATED` had NO production consumer before
 * this round — `renderPhaseQuestions` printed two sentences written by hand instead
 * (*"Optional, only if they ask for more: N further questions are available."* /
 * *"(what this project is for was never recorded, so this is the smallest offer)"*), and only their
 * own test in `packages/shared` ever read them. Adam would have relit a sentence at NEEDS-ADAM
 * that nothing displayed, while `PHASE_SKIP_SAID` and `PHASE_FALLBACK` sat pinned. These two close
 * that gap the same way: exported here, pinned against `PLUGIN_COPY` by
 * `packages/claude-plugin/src/phase-dialogue.test.ts`, and it is these two — not the old hand-typed
 * lines — that `renderPhaseQuestions` now prints.
 */
/**
 * ── CORR-6, 2026-09-06 · D140 ⑤ (D135 ②) — IT TAKES THE TRANCHES NOW, NOT THEIR SUM ────────────
 *
 * SUPERSEDES `RESERVE_OFFER(count)`. The wire has always carried `reserve.tranches[{bank,
 * questions}]` and this script added the lengths up before printing, so three banks of the pack
 * arrived as one number. The argument is `[{ bank, count }]` now — the bank name straight off the
 * wire, never spelled here (AD-7) — and the sentence is still pinned byte for byte against
 * `PLUGIN_COPY.PHASE_RESERVE_OFFER` by `packages/claude-plugin/src/phase-dialogue.test.ts`.
 *
 * One tranche renders the sentence it always rendered: a breakdown of one is not a breakdown.
 */
export const RESERVE_OFFER = (tranches) => {
  const total = tranches.reduce((sum, tranche) => sum + tranche.count, 0);
  const opening =
    total === 1
      ? 'There is one more question that would sharpen this'
      : `There are ${total} more questions that would sharpen this`;
  const closing = total === 1 ? 'Want it?' : 'Want them?';
  if (tranches.length < 2) return `${opening}. ${closing}`;
  const breakdown = tranches.map((tranche) => `${tranche.count} ${tranche.bank}`).join(', ');
  return `${opening}, in ${tranches.length} tranches: ${breakdown}. ${closing}`;
};
export const RESERVE_UNCALIBRATED =
  'What this project is for was never recorded, so this is the smallest offer rather than a ' +
  'judgement about how deep to go.';

/**
 * READ THE ARGUMENTS THE AGENT PASSED.
 *
 * `--questions` asks the bridge what to ask. Everything else is a SUBMIT, and a submit carries the
 * answers the builder gave and the questions they skipped:
 *
 *     --answer <question_id>=<what they said>     (repeatable)
 *     --skip <question_id>                        (repeatable)
 *     --skip-all                                  (the whole phase, at once)
 *
 * ── WHY `--skip-all` IS AN ARGUMENT AND NOT A DETECTED MODE ([PROP-812-9](a), memo 812-9) ──────
 *
 * A skill cannot ask its client whether a question box exists. The one thing that IS measured — MCP
 * elicitation, cancelled in 13 ms outside an interactive session — is a different mechanism, and
 * depending on an unmeasured environment variable is forbidden (D81). A timer that decided on a
 * person's behalf would be the 240 s D128 closed.
 *
 * So the fallback is not a MODE: it is the SAME gesture of skipping, reached explicitly. The skill's
 * conduct carries the rule that leads here — *a question that does not come back is not re-asked; it
 * is skipped, said, and marked* — and the sentence that announces it is `FALLBACK_SAID`.
 *
 * `--answer` takes `id=text`. The FIRST `=` separates them, so an answer containing an equals sign
 * survives intact; an argument with no `=` at all is a malformed answer and is reported rather than
 * guessed at, because this script asks a bridge to spend a generation.
 */
export function parsePhaseArgs(argv) {
  const args = { mode: 'submit', answers: [], skipped: [], skipAll: false, json: false, malformed: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--questions') args.mode = 'questions';
    /*
     * `--moves` IS A THIRD MODE AND NOT A FLAG ON THE FIRST, and the sealed clause is the reason:
     * *"A move is CHOSEN — from a post-artifact menu, on the builder's own request"*. POST-artifact.
     * The questions are asked BEFORE the document exists; the menu is offered AFTER it does, and only
     * because somebody asked for it. Printing both from one call would put the menu in front of an
     * agent at the one moment the clause says it must not be there.
     */
    else if (flag === '--moves') args.mode = 'moves';
    else if (flag === '--json') args.json = true;
    else if (flag === '--skip-all') args.skipAll = true;
    else if (flag === '--answer') {
      index += 1;
      const pair = argv[index] ?? '';
      const at = pair.indexOf('=');
      if (at <= 0 || at === pair.length - 1) {
        args.malformed.push(pair);
        continue;
      }
      args.answers.push({ question_id: pair.slice(0, at), said: pair.slice(at + 1) });
    } else if (flag === '--skip') {
      index += 1;
      const id = argv[index] ?? '';
      if (id.length === 0) {
        args.malformed.push(id);
        continue;
      }
      args.skipped.push(id);
    }
  }
  return args;
}

/**
 * THE BODY OF A SUBMIT — checked HERE so nothing is spent on a dialogue that says nothing.
 *
 * `draftId` is generated by the caller (`crypto.randomUUID`) and passed in, because this module has
 * no clock and no randomness: a pure function that minted an id would be a pure function with a
 * different answer every time, and its test could only assert the shape.
 *
 * ── THE FOUR REFUSALS, EACH ONE A MEASURED CLASS ───────────────────────────────────────────────
 *
 *   · a malformed `--answer` — reported by name; a submit carrying one is refused whole, because
 *     the alternative is dropping a person's sentence silently;
 *   · nothing at all — no answers, no skips, no `--skip-all`: there is no dialogue to record and a
 *     generation would be spent on an empty exchange;
 *   · an empty answer (`id=`) — already refused by the parser, and refused again here for a caller
 *     that built the object by hand;
 *   · the same question ANSWERED and SKIPPED — the two are opposite facts about one question, and
 *     writing both would put two rows in an append-only log that argue with each other.
 *
 * `--skip-all` carries NO ids: the SERVER knows which questions this phase still asks, and a client
 * that enumerated them would be a client holding the method. It travels as the flag it is.
 */
export function phaseSubmitBody(args, draftId) {
  if (args.malformed.length > 0) return { ok: false, reason: 'malformed-answer' };
  if (typeof draftId !== 'string' || draftId.length === 0) return { ok: false, reason: 'no-draft-id' };

  const answers = args.answers.filter((answer) => answer.said.trim().length > 0);
  if (answers.length !== args.answers.length) return { ok: false, reason: 'empty-answer' };

  if (!args.skipAll && answers.length === 0 && args.skipped.length === 0) {
    return { ok: false, reason: 'nothing-to-record' };
  }

  const answeredIds = new Set(answers.map((answer) => answer.question_id));
  const clash = args.skipped.find((id) => answeredIds.has(id));
  if (clash !== undefined) return { ok: false, reason: 'answered-and-skipped' };

  return {
    ok: true,
    skipAll: args.skipAll,
    /*
     * `skip_all` CROSSES THE WIRE. It used to stop here, and the bench measured what that cost
     * (2026-09-05): the route received an empty `skipped[]`, skipped nothing, wrote no tag and no
     * row, while the terminal had already said the fallback sentence out loud. A no-op wearing the
     * words of a gesture is worse than a refusal. The SERVER expands it, because the server is what
     * knows which questions are still open.
     */
    body: { draft_id: draftId, answers, skipped: [...args.skipped], skip_all: args.skipAll },
  };
}

/**
 * THE SHAPE GUARD ON WHAT THE BRIDGE SERVES — 8.5's blocker B-1, applied on the first day.
 *
 * Everything printed downstream trusts these fields. A 200 that is not the shape this script expects
 * is a DIFFERENT fact from an unreachable bridge — reached, and answered something else — and it is
 * refused by name rather than crashing past this file's one promise (exit 0, always) or printing the
 * literal string `undefined` at a builder.
 *
 * FOUR OPTIONS IS THE CEILING and it is checked on both sides of the wire (D128), exactly as the
 * entry's guard checks it: a question served with five cannot be asked as one question, and finding
 * that out in front of a builder is finding it out too late.
 */
export function validatePhasePayload(payload) {
  if (payload === null || typeof payload !== 'object') return { ok: false, reason: 'not an object' };
  if (typeof payload.phase_label !== 'string' || payload.phase_label.length === 0) {
    return { ok: false, reason: 'no phase' };
  }
  if (!Array.isArray(payload.ask)) return { ok: false, reason: 'no questions' };
  if (!Array.isArray(payload.carried)) return { ok: false, reason: 'no carried list' };
  if (typeof payload.waiting !== 'string' || payload.waiting.length === 0) {
    return { ok: false, reason: 'no waiting line' };
  }
  for (const question of payload.ask) {
    if (question === null || typeof question !== 'object') {
      return { ok: false, reason: 'a question is not an object' };
    }
    if (typeof question.id !== 'string' || question.id.length === 0) {
      return { ok: false, reason: 'a question has no id' };
    }
    if (typeof question.text !== 'string' || question.text.length === 0) {
      return { ok: false, reason: 'a question has no text' };
    }
    if (!Array.isArray(question.options)) return { ok: false, reason: 'a question has no options' };
    if (question.options.length > 4) return { ok: false, reason: 'a question offers more than four options' };
    /*
     * A VERBATIM QUESTION WITH OPTIONS IS REFUSED HERE TOO (D129 ②).
     *
     * The server composes none and the pack declares none, so this can only be reached by a bridge
     * that has drifted. A fabricated verbatim is a FORGERY — *"not a weaker answer, a different
     * artifact wearing the answer's clothes"* — and the client refuses to relay one rather than
     * trusting that the other end still agrees.
     */
    if (question.verbatim === true && question.options.length > 0) {
      return { ok: false, reason: 'a verbatim question arrived with options' };
    }
  }
  if (payload.reserve === null || typeof payload.reserve !== 'object') {
    return { ok: false, reason: 'no reserve offer' };
  }
  if (!Array.isArray(payload.reserve.tranches)) return { ok: false, reason: 'no reserve tranches' };
  if (typeof payload.reserve.calibrated !== 'boolean') return { ok: false, reason: 'no calibration flag' };
  if (!Array.isArray(payload.moves)) return { ok: false, reason: 'no moves' };
  if (payload.moves.length > 5) return { ok: false, reason: 'more than five moves' };
  return { ok: true };
}

/** The same guard for the answer. `block` is what gets printed, so `block` is what is checked. */
export function validatePhaseAnswerPayload(payload) {
  if (payload === null || typeof payload !== 'object') return { ok: false, reason: 'not an object' };
  if (typeof payload.block !== 'string' || payload.block.length === 0) {
    return { ok: false, reason: 'no block' };
  }
  if (!Number.isInteger(payload.hypotheses) || payload.hypotheses < 0) {
    return { ok: false, reason: 'no count' };
  }
  return { ok: true };
}

/**
 * THE QUESTIONS, LAID OUT FOR THE AGENT THAT WILL ASK THEM — one at a time, in order (D126).
 *
 * The agent reads this and puts each question to the builder with the client's own question box. The
 * IDS matter and are the whole reason this is rendered rather than dumped: `--answer <id>=<text>`
 * takes the id, and an agent that guessed one would record an answer against the wrong question.
 *
 * No sentence here is this file's: every `text` is the server's, which is the pack's (AD-7).
 *
 * ── THE THREE MARKS, AND WHY EACH ONE IS ON THE PAGE ───────────────────────────────────────────
 *
 *   · `(their own words only — do not offer options)` on a VERBATIM question. The conduct is in the
 *     `SKILL.md` and the mark is here as well, because an agent reads what is in front of it.
 *   · the CARRIED list, with its reason. A question answered at the entry or in an earlier session
 *     is not silently dropped — it is named, and the skill says so out loud. That is K2 being proved
 *     on screen rather than promised in a document.
 *   · the reserve OFFER as a count and a question, never as a list of questions. The clause is
 *     sealed: *"a reserve is SERVED … one at a time, never listed"*.
 */
export function renderPhaseQuestions(payload) {
  const lines = [];
  lines.push(`Phase: ${payload.phase_label}`);
  if (payload.drafts !== null && payload.drafts !== undefined) {
    lines.push(`Writes: ${payload.drafts.label}`);
  }
  lines.push('');

  if (payload.carried.length > 0) {
    lines.push('Already settled — say so, do not ask again:');
    for (const carried of payload.carried) {
      const because =
        carried.because === 'entry' ? 'answered when this project started' : 'answered in an earlier session';
      lines.push(`  ${carried.id}: ${carried.text}`);
      lines.push(`    (${because})`);
    }
    lines.push('');
  }

  if (payload.ask.length === 0) {
    lines.push('Nothing left to ask in this phase.');
  } else {
    lines.push('Ask these, one at a time, in this order:');
    for (const question of payload.ask) {
      lines.push(`  ${question.id}: ${question.text}`);
      question.options.forEach((option, index) => {
        lines.push(`    [${index}] ${option.text}`);
      });
      if (question.verbatim === true) {
        lines.push('    (their own words only — do not offer options, and do not rephrase what they say)');
      }
    }
  }

  /*
   * ── THE TRANCHES SURVIVE THE RENDER — CORR-6, 2026-09-06 · D140 ⑤ (D135 ②) ─────────────────
   *
   * SUPERSEDES the `reduce` that summed every tranche's questions into one `offered` count before
   * printing. The wire carries `[{ bank, questions[] }]` and the sentence now carries the same
   * division: a tranche with a name and a number each, in the order the bridge served them.
   *
   * An EMPTY tranche is dropped rather than printed as *"0 <bank>"* — a bank with nothing in it is
   * not an offer, and naming it would be a shape with no content behind it. A tranche whose
   * `questions` is not an array counts zero and is dropped by the same filter, which is what this
   * script does everywhere with a field the bridge did not shape as promised: no throw, no guess.
   *
   * A tranche with no usable `bank` is dropped THE SAME WAY (CORR-6, round 4) — quick-fix, review
   * round 3. `validatePhaseQuestionsPayload` only checks that `tranches` is an array; it never opens
   * one, so a bridge that shaped a tranche without its name would reach `RESERVE_OFFER` and print
   * *"13 undefined"* rather than a bank. The server's own schema requires `bank: z.string().min(1)`,
   * which is why this was never SEEN rather than never POSSIBLE — the guard matches every other one
   * in this function: a field that did not arrive as promised drops its tranche, it does not throw.
   */
  const tranches = payload.reserve.tranches
    .filter((tranche) => typeof tranche.bank === 'string' && tranche.bank.length > 0)
    .map((tranche) => ({
      bank: tranche.bank,
      count: Array.isArray(tranche.questions) ? tranche.questions.length : 0,
    }))
    .filter((tranche) => tranche.count > 0);
  if (tranches.length > 0) {
    lines.push('');
    lines.push(RESERVE_OFFER(tranches));
    if (payload.reserve.calibrated === false) {
      lines.push(`  (${RESERVE_UNCALIBRATED})`);
    }
  }
  return lines.join('\n');
}

/**
 * WHAT AN ERROR ENVELOPE SAYS, when it says anything.
 *
 * The server's refusals carry their own sentence and every one of them is meant to be read by a
 * person (AD-23: one phrase, two surfaces). So the message is relayed VERBATIM and never re-worded.
 * `null` when the body carries none, and the caller then says only what it knows: the status.
 */
export function phaseEnvelopeMessage(payload) {
  if (payload === null || typeof payload !== 'object') return null;
  const error = payload.error;
  if (error === null || typeof error !== 'object') return null;
  return typeof error.message === 'string' && error.message.length > 0 ? error.message : null;
}

/**
 * THE MENU, RENDERED ALONE — the PULLED half of the sealed clause (D135 · [PROP-812-5]).
 *
 * Reached only through `--moves`, which the skill's conduct runs only when the builder asks *"what
 * else can I do with this?"* after a document exists. At most five arrive (the route caps them and
 * the shape guard refuses a sixth), and they are printed to be SERVED ONE AT A TIME — the line under
 * the list says so, because a list handed over whole is a list an agent reads out whole.
 *
 * An artifact the method has no move for prints an honest nothing rather than a substitute.
 */
export function renderPhaseMoves(payload) {
  if (payload.moves.length === 0) {
    return 'The method has no further move for this document.';
  }
  const lines = ['Offer these one at a time, and only because they asked. Applying one is their decision:'];
  for (const move of payload.moves) {
    lines.push(`  ${move.id}: ${move.name}`);
    lines.push(`    ${move.description}`);
    lines.push(`    shape: ${move.pattern}`);
  }
  return lines.join('\n');
}
