/**
 * THE CLIENT HALF OF THE TERMINAL ENTRY — PURE, and pure so that it can be MEASURED (Story 8.8).
 *
 * ── WHY THERE IS A CLIENT HALF AT ALL ──────────────────────────────────────────────────────────
 *
 * The plugin ships as bare files on a builder's disk with NO `node_modules`, so it cannot import
 * `@goriki/shared` and cannot re-fold a map projection. Everything that needs the method, the
 * register or the pack happens on the SERVER, which answers TEXT; this module does the two things
 * that can only happen where the terminal is — reading the arguments the agent passed, and refusing
 * a response whose shape it does not recognise before anything is printed from it.
 *
 * **It re-spells no sentence of the product.** The questions, the waiting line, the refusals, the
 * relay and the contest sentence all arrive in the server's answer. What is written here is the
 * handful of lines about THIS SCRIPT's own failures — no configuration, an unreachable bridge, an
 * answer that is not JSON — which are facts about a process on a disk and have no other home.
 *
 * The pattern is 83-8's, the one 8.5's `rules-block-client.mjs` states: *"logique pure dans une lib,
 * importée par des tests Vitest"* — `packages/claude-plugin/src/start-project.test.ts` imports this
 * file directly, so every branch below is exercised without spawning anything.
 *
 * Nothing in this file touches a filesystem, a network or a clock. Its entry point does.
 */

/** The two things this script can be asked to do. Named, so a typo is a refusal and not a mode. */
export const ENTRY_MODES = ['questions', 'submit'];

/**
 * READ THE ARGUMENTS THE AGENT PASSED.
 *
 * `--questions` asks the bridge what to ask. Everything else is a SUBMIT, and a submit needs three
 * answers: what the builder wants to build, what it becomes if it works, and which option of the
 * routing question they chose. `--repo owner/name` is the fourth and it is optional, because most
 * projects do not have one.
 *
 * ── WHY THE OPTION TRAVELS AS A NUMBER ─────────────────────────────────────────────────────────
 *
 * The routing question's options are the METHOD's text, revised by the person who owns the method.
 * Sending the text back would make a corrected comma a failed interview; sending the position
 * cannot drift, because a position is not content. `--option 0` is the first option as the bridge
 * served it, and the bridge reads the same list in the same order.
 *
 * Anything unparseable is an ERROR OBJECT, never a guess: this script asks a bridge to spend a
 * generation, and a mis-read argument would spend it on the wrong answers.
 */
export function parseEntryArgs(argv) {
  const args = { mode: 'submit', idea: null, stakes: null, option: null, repo: null, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--questions') args.mode = 'questions';
    else if (flag === '--json') args.json = true;
    else if (flag === '--idea') {
      index += 1;
      args.idea = argv[index] ?? null;
    } else if (flag === '--stakes') {
      index += 1;
      args.stakes = argv[index] ?? null;
    } else if (flag === '--option') {
      index += 1;
      args.option = argv[index] ?? null;
    } else if (flag === '--repo') {
      index += 1;
      args.repo = argv[index] ?? null;
    }
  }
  return args;
}

/** The three answers a submit carries — checked HERE so nothing is spent on an incomplete one. */
export function submitBody(args) {
  const idea = typeof args.idea === 'string' ? args.idea.trim() : '';
  if (idea.length === 0) return { ok: false, reason: 'no-idea' };

  if (args.stakes !== 'toy' && args.stakes !== 'tool' && args.stakes !== 'product') {
    return { ok: false, reason: 'no-stakes' };
  }

  /*
   * `Number(null)` IS 0, AND THAT WAS A REAL DEFECT (measured 2026-09-02, first run of this file's
   * own suite): without the guard below, a submit with no `--option` at all answered option ZERO —
   * the first option of the routing question — and would have spent a generation on an answer
   * nobody gave. The same is true of `--option ""`. A missing answer is a refusal, never a default.
   */
  if (typeof args.option !== 'string' || args.option.trim().length === 0) {
    return { ok: false, reason: 'no-option' };
  }
  const option = Number(args.option);
  if (!Number.isInteger(option) || option < 0) return { ok: false, reason: 'no-option' };

  const body = { idea, stakes: args.stakes, option_index: option };
  if (typeof args.repo === 'string' && args.repo.trim().length > 0) {
    body.repo = args.repo.trim();
  }
  return { ok: true, body };
}

/**
 * THE SHAPE GUARD — 8.5's blocker B-1, applied on the first day rather than after it bit.
 *
 * Everything printed downstream trusts these fields. A 200 that is not the shape this script
 * expects is a DIFFERENT fact from an unreachable bridge — reached, and answered something else —
 * and it is refused by name rather than crashing past this file's one promise (exit 0, always) or
 * printing the literal string `undefined` at a builder.
 */
export function validateQuestionsPayload(payload) {
  if (payload === null || typeof payload !== 'object') return { ok: false, reason: 'not an object' };
  if (typeof payload.fillable !== 'boolean') return { ok: false, reason: 'no fillable flag' };
  if (typeof payload.waiting !== 'string' || payload.waiting.length === 0) {
    return { ok: false, reason: 'no waiting line' };
  }
  if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
    return { ok: false, reason: 'no questions' };
  }
  for (const question of payload.questions) {
    if (question === null || typeof question !== 'object') return { ok: false, reason: 'a question is not an object' };
    if (typeof question.text !== 'string' || question.text.length === 0) {
      return { ok: false, reason: 'a question has no text' };
    }
    if (!Array.isArray(question.options)) return { ok: false, reason: 'a question has no options' };
    /*
     * FOUR IS THE CEILING, AND IT IS CHECKED ON BOTH SIDES OF THE WIRE.
     *
     * The client's own question box carries two to four options (D128). A question served with five
     * cannot be asked as one question, and finding that out in front of a builder — half a dialogue
     * in, with a generation about to be spent — is finding it out too late. The server refuses to
     * compose one; this refuses to relay one.
     */
    if (question.options.length > 4) return { ok: false, reason: 'a question offers more than four options' };
    for (const option of question.options) {
      if (option === null || typeof option !== 'object' || typeof option.text !== 'string' || option.text.length === 0) {
        return { ok: false, reason: 'an option has no text' };
      }
    }
  }
  if (payload.fillable === false && (typeof payload.refusal !== 'string' || payload.refusal.length === 0)) {
    return { ok: false, reason: 'a refusal with no sentence' };
  }
  return { ok: true };
}

/** The same guard for the answer. `block` is what gets printed, so `block` is what is checked. */
export function validateAnswerPayload(payload) {
  if (payload === null || typeof payload !== 'object') return { ok: false, reason: 'not an object' };
  if (typeof payload.block !== 'string' || payload.block.length === 0) {
    return { ok: false, reason: 'no block' };
  }
  if (typeof payload.kata !== 'string' || payload.kata.length === 0) {
    return { ok: false, reason: 'no kata' };
  }
  if (typeof payload.map_url !== 'string' || payload.map_url.length === 0) {
    return { ok: false, reason: 'no map link' };
  }
  return { ok: true };
}

/**
 * THE QUESTIONS, LAID OUT FOR THE AGENT THAT WILL ASK THEM — one at a time, in order (D126).
 *
 * The agent reads this and puts each question to the builder with the client's own question box.
 * The NUMBERS matter and are the whole reason this is rendered rather than dumped: `--option N`
 * takes the position of the chosen option in the question whose id is `idea_route`, and a list
 * without indices is a list somebody counts by hand.
 *
 * No sentence here is this file's: every `text` is the server's, which is the pack's for two of the
 * four (AD-7).
 */
export function renderQuestions(payload) {
  const lines = [];
  for (const question of payload.questions) {
    lines.push(`${question.id}: ${question.text}`);
    question.options.forEach((option, index) => {
      lines.push(`  [${index}] ${option.text}`);
    });
    if (question.free_text === true) lines.push('  (an answer in their own words is fine here)');
  }
  return lines.join('\n');
}

/**
 * WHAT AN ERROR ENVELOPE SAYS, when it says anything.
 *
 * The server's refusals carry their own sentence — the cap's, the tier's, the one for a project that
 * already has a map — and every one of them is a sentence a person is meant to read (AD-23: one
 * phrase, two surfaces). So the message is relayed VERBATIM and never re-worded. `null` when the
 * body carries none, and the caller then says only what it knows: the status.
 */
export function envelopeMessage(payload) {
  if (payload === null || typeof payload !== 'object') return null;
  const error = payload.error;
  if (error === null || typeof error !== 'object') return null;
  return typeof error.message === 'string' && error.message.length > 0 ? error.message : null;
}
