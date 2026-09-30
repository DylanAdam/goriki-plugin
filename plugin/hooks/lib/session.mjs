/**
 * THE STOP REMINDER, AS PURE FUNCTIONS — Story 8.4 · FR-35, AR15/AR32 · D71, D82, D84-D86, D103, D130.
 *
 * ── WHY THIS FILE IS `.mjs` AND NOT COMPILED FROM TYPESCRIPT (memo 83-8, applied again) ────────
 *
 * `plugin/` is DATA. It is copied onto a user's disk verbatim, there is no `node_modules` beside it
 * and there is no build on their machine, so this file cannot `import` from `@goriki/shared` and
 * cannot be transpiled on the way in. The sentences are therefore spelled out here, and
 * `stop-hook.test.ts` imports THESE BYTES and compares them to
 * `packages/shared/src/contracts/session-events.ts`. Change one without the other and the gate says
 * which line moved. It is `lib/freeze.mjs`'s answer to the identical problem, one hook over.
 *
 * ── AND NOTHING HERE DECIDES ANYTHING (AR32, AD-14) ───────────────────────────────────────────
 *
 * There is no counter in this file, no threshold, and no digit. *"The block counter lives
 * server-side, keyed on the session, never in the hook — a hook holds no state and a counter in the
 * hook would reset with it"* (AD-14). What the hook receives is a `decision`; what this file does is
 * turn three SERVED strings into one sentence. It reads nothing, writes nothing, and could not tell
 * you how many times a session has been held.
 *
 * ── WHAT THE SENTENCE MAY NOT CONTAIN, AND THE GUARD READS THESE BYTES ────────────────────────
 *
 * No fraction, no tally, no rating, and no measuring instrument of any kind — D82 is *calculated or
 * absent*, and a reminder that counted the holds out loud would be exactly the dial it forbids.
 * Nothing here claims this product inspected, ran or judged anything (D84-D86); the word *agent*
 * never names Goriki (D85); the brand D135 names appears nowhere in this tree. `plugin-files.test.ts`
 * greps every shipped byte for all of it, which is why the forbidden shapes are DESCRIBED above
 * rather than typed out: a sentence saying this product does not do a thing may not use that thing's
 * own word or its own form, and the guard is right to be blunt about it.
 */

/**
 * THE SENTENCES — spelled out, and compared to `STOP_COPY` by a gate.
 *
 * The person reading them has decided to stop. So it is three lines and not seven, it asks for ONE
 * gesture rather than two, and **the way out is in the same sentence as the link** — D130's own
 * words: *"le rappel porte le lien ET la sortie dans la même phrase, puis il lâche"*. A reminder
 * that named the seal and left the exit to be guessed would be a hold with no stated end, which is
 * the hostage shape D103 exists to forbid.
 */
const COPY = {
  UNSEALED: 'is still unsealed',
  HELD_ONCE: 'This session is being held back once, so you see it before you go.',
  SEAL_OR_GO: 'Seal it at',
  SEAL_OR_GO_TAIL:
    '— or ask to stop again and the session will close with the decision still pending, which the ' +
    'register will record.',
};

/**
 * THE REMINDER — the same composition as `composeStopReminder`, and a gate proves it byte for byte.
 *
 * It drops the segment it was not served and never fills one: no `GRK-null`, no question this
 * product wrote on a builder's behalf (D82), no orphan punctuation where a name would have been.
 *
 * Three lines, in the reading order of somebody who has just been kept from leaving: WHICH decision
 * and what it asks, WHY they are still here, then the gesture and the way out in a single sentence.
 * `composeRefusal` in `freeze.mjs` made the same choice about one fact per line and for the same
 * measured reason — a terminal wraps a paragraph at whatever width it has, and the link ends up
 * buried mid-prose.
 */
export function composeStopReminder(input) {
  const named =
    input.reference === null ? 'A pending CRITICAL decision' : `${input.reference} (CRITICAL)`;
  const asked = input.question === null ? '.' : `: “${input.question}”.`;

  return [
    `${named} ${COPY.UNSEALED}${asked}`,
    COPY.HELD_ONCE,
    `${COPY.SEAL_OR_GO} ${input.deepLink} ${COPY.SEAL_OR_GO_TAIL}`,
  ].join('\n');
}

/**
 * IS THIS AN ANSWER THIS HOOK MAY ACT ON? — `{decision, pending}`, or `null`.
 *
 * The server's answer is `{decision, holds, limit, pending}` and the hook needs two of the four. A
 * body that is not that shape answers `null`, which the hook treats exactly as it treats an
 * unreachable bench: it writes nothing and the session closes (D103). *"An answer I could not read"*
 * and *"nothing is pending"* are different facts, and only one of them may ever hold somebody.
 *
 * A `block` with no `pending` is REFUSED here rather than printed with a hole in it. The reminder
 * D130 requires carries a link; a block this hook cannot compose a sentence for is an answer it
 * cannot act on, and the fail-open direction is to let the session end.
 */
export function readStopAnswer(body) {
  if (body === null || typeof body !== 'object') return null;
  const decision = body.decision;
  if (decision !== 'block' && decision !== 'pass') return null;
  if (decision === 'pass') return { decision, pending: null };

  const pending = body.pending;
  if (pending === null || typeof pending !== 'object') return null;
  if (typeof pending.deep_link !== 'string' || pending.deep_link === '') return null;
  const reference = typeof pending.reference === 'string' && pending.reference !== '' ? pending.reference : null;
  const question = typeof pending.question === 'string' && pending.question !== '' ? pending.question : null;
  return { decision, pending: { reference, question, deepLink: pending.deep_link } };
}
