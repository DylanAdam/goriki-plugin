/**
 * `Stop` — THE SESSION CANNOT END SILENTLY OVER A PENDING CRITICAL. Story 8.4 · FR-35, AR15/AR32.
 *
 * D71, D82, D84-D86, D102, D103, D105, D128, D130.
 *
 * ── WHAT THIS RETIRES, AND WHEN (D41 — an addition names its retraction) ───────────────────────
 *
 * Until 2026-09-05 this file was Story 8.1's STUB. It drained stdin, exited 0, and its header said
 * why: *"the story that decides when Goriki holds a session back, and how many times, is Story 8.4,
 * and it carries its own migration for the counter. A stub that retained anything would ship that
 * decision early, without the counter that bounds it."* That sentence is spent — this IS 8.4, the
 * migration is `20260905120000_stop_block_once`, and the counter is `session_activity.stop_blocks`
 * on the server. Two of the stub's promises SURVIVE it whole and are the spine of this file:
 *
 *   · **D103, fail-open — applied to a CLOSING.** No address, no token, no network, a timeout, a
 *     revoked token, a lapsed plan, a 503, a body this hook cannot read: every one of them writes
 *     NOTHING and the session ends the way it would have ended with no plugin installed. A hold is
 *     never born from a failure;
 *   · **the hook holds no state.** Not a file, not a snapshot, not a marker, not a count. AD-14 is
 *     literal about it — *"a hook holds no state and a counter in the hook would reset with it"* —
 *     so this file is deliberately NOT in `STATEFUL_HOOKS`, and `stop-hook.test.ts` asserts that a
 *     real run leaves `$CLAUDE_PLUGIN_DATA` empty.
 *
 * ── THE SHAPE OF THE OUTPUT IS A MEASUREMENT, NOT A GUESS (T4a, 2026-08-01) ───────────────────
 *
 * The research measured a `Stop` hook on the certified client:
 * `{"decision":"block","reason":"…"}` — the two fields at the TOP LEVEL, not inside
 * `hookSpecificOutput` — and the agent's complete output was the phrase that `reason` instructed it
 * to say: *"the reason entered its context as an instruction it followed to the letter"*. Writing
 * nothing is the pass, and `{}` was the fixture's own shape for it.
 *
 * The same measurement stated the LIMIT this hook obeys: *"a hook that blocked without an exit
 * condition loops — the stop loop must be bounded server-side, not by the agent"*. It is: the server
 * counts, the server decides, and this file never learns the number.
 *
 * ── THE SIX THINGS THAT ARE NEVER WRITTEN HERE ────────────────────────────────────────────────
 *
 * `continue`, `stopReason`, `suppressOutput`, `systemMessage`, `terminalSequence` — the universal
 * fields — and `additionalContext`. A `continue` set to false **stops the agent altogether**, which
 * is the only outcome worse than a hold nobody decided. This hook has one thing to say and it says
 * it as the reason of one decision.
 *
 * The guard that holds this is in `plugin-files.test.ts` and it reads these very bytes, so the six
 * are named above WITHOUT their colon: a file may not carry the key shape it forbids, not even in a
 * sentence explaining that it forbids it. `freeze.mjs` learned the same lesson from the D135 walk.
 *
 * ── THE ORDER, AND EVERY STEP OF IT IS AN ACCEPTANCE CRITERION ────────────────────────────────
 *
 *   1. read the event; unreadable → write nothing;
 *   2. the install's address and token; either missing → write nothing (D103);
 *   3. ONE call to the counter. Any failure — the four causes are `unreachable`, `unauthorized`,
 *      `expired`, `timeout` → write nothing;
 *   4. `pass` → write nothing. That is BOTH the overflow (the server appended the terminal itself)
 *      and *"a session with nothing pending ends silently — no block, no message, no cost"*: the
 *      server does not move its counter when nothing is pending, so an ordinary session pays one
 *      request at its close and nothing at all enters the model's context;
 *   5. `block` → ONE line on stdout, whose reason is the sentence the shared composer builds.
 *
 * **Whether anything is pending is not this file's question to answer** (AR32, memo 84-1 (b)). The
 * server holds the membership rule — unsealed, not dismissed, not superseded, CRITICAL — because it
 * already holds it for the freeze, and a second copy inside a hook would be a second rule.
 *
 * ── THE ONE EXIT, AND ITS ARGUMENT IS `0` ─────────────────────────────────────────────────────
 *
 * A crash, a malformed payload or an unhandled rejection exiting non-zero would be this product
 * interfering with somebody's session for a reason nobody wrote. There is exactly one
 * `process.exit` in this file and its argument is the literal `0`; everything that could throw is
 * inside a `try`.
 */
import process from 'node:process';
// Imported rather than taken off the global: `Buffer` is a Node global at runtime and ESLint's
// `no-undef` reaches this shipped file. Naming the module it comes from is both the fix and the
// honest statement — this file runs on Node and says so. `pre-tool-use.mjs` measured it first.
import { Buffer } from 'node:buffer';

import { composeStopReminder, readStopAnswer } from './lib/session.mjs';
import { credentials, postStopBlock } from './lib/client.mjs';

/** Read the whole event off stdin. Answers `null` on anything that is not one JSON object. */
async function readEvent() {
  const chunks = [];
  try {
    for await (const chunk of process.stdin) chunks.push(chunk);
    const text = Buffer.concat(chunks).toString('utf8').trim();
    if (text === '') return null;
    const parsed = JSON.parse(text);
    // `typeof [] === 'object'` in JS — an array is valid JSON but never a `Stop` event, and letting
    // one through would ask `rule()` to hold a session over a payload shape this hook cannot see a
    // field in. `Array.isArray` is the one guard `typeof` cannot do on its own.
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    // Empty stdin, a broken pipe, a truncated write, something that is not JSON. One answer, and it
    // holds nothing: a hook that could not read the event has nothing to rule on.
    return null;
  }
}

/**
 * THE ONE SHAPE THAT HOLDS A SESSION — the measured form of T4a, and nothing beside it.
 *
 * `decision` and `reason` at the top level. No `hookSpecificOutput` (that is `PreToolUse`'s
 * envelope, measured on that event and not on this one), and none of the six fields above.
 */
function hold(pending) {
  process.stdout.write(
    `${JSON.stringify({ decision: 'block', reason: composeStopReminder(pending) })}\n`,
  );
}

/**
 * THE WHOLE DECISION. Writes at most one line on stdout, and returns.
 *
 * There is no *"let it close"* to write: writing nothing IS the close, and it is the only shape that
 * cannot interfere with a session this product was not asked to rule on.
 */
async function rule() {
  const { origin, token } = credentials();
  /*
   * No address or no token — this install was never able to ask, so it holds nobody. Nothing is
   * journaled either ([PROP-84-9] (a), memo 84-9): `freeze_gap` is the hole of a WRITE that crossed
   * a frozen zone, keyed by the packet it crossed, and a closing crossed no zone and names no
   * packet. Inventing a row here would be this product fabricating a fact (D82). The existing net is
   * the sixty-minute sweep (AD-16), which gives every silent session a terminal of its own; the hole
   * is named in the report and in the install legend's own clause.
   */
  if (origin === null || token === null) return;

  const response = await postStopBlock(origin, token);
  // The four causes D103 names, all ending the same way: THE SESSION CLOSES. This is the line the
  // whole story is judged on — nothing arriving over a wire, or failing to, can create a hold.
  if (!response.ok) return;

  const answer = readStopAnswer(response.body);
  if (answer === null || answer.decision !== 'block') return;

  hold(answer.pending);
}

async function main() {
  try {
    /*
     * READ FIRST, AND AN UNREADABLE EVENT HOLDS NOBODY — `pre-tool-use.mjs`'s own order.
     *
     * Draining stdin keeps the client's writer from meeting a broken pipe — the stub's one job, and
     * it does not stop being necessary because the hook grew a behaviour. But the read is also a
     * GATE: empty stdin, a truncated write, something that is not JSON at all means this process was
     * not handed a session event it understands, and a hook that would hold somebody anyway is a
     * hook ruling on conditions it cannot see. It writes nothing and the session closes — the same
     * direction every other failure in this file takes.
     *
     * No FIELD of the event is consulted, and that half is deliberate: the PAT names the Project,
     * the server resolves the open Session, and branching on the payload would be a decision made
     * from state this hook is forbidden to hold. `stop_hook_active` is not read for the same reason
     * — the bound is the server's counter, which is what D71 requires and what T4a measured the
     * need for.
     */
    const event = await readEvent();
    if (event !== null) await rule();
  } catch {
    /*
     * Nothing above should be able to reach this. If something does, the session closes and nobody
     * is told: a hold nobody decided is worse than a reminder that was missed once.
     */
  }
  process.exit(0);
}

void main();
