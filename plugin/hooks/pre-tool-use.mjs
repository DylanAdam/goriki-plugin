/**
 * `PreToolUse` — THE FREEZE THAT READS, NEVER COMPUTES. Story 8.3 · FR-35, AR32.
 *
 * D71, D77, D82, D84-D86, D94, D102, D103, D105.
 *
 * ── WHAT THIS RETIRES, AND WHEN (D41 — an addition names its retraction) ───────────────────────
 *
 * Until 2026-08-28 this file was Story 8.1's STUB. It drained stdin, exited 0, and its header said
 * why: *"The registration is Story 8.1's; the behaviour — the frozen-path guardrail — is Story
 * 8.3's. Until then this hook returns no decision."* That sentence is now spent. Two of the stub's
 * own promises SURVIVE it whole and are the spine of this file:
 *
 *   · **D103, fail-open.** *"The guardrail this plugin will eventually carry must never stop work it
 *     cannot rule on."* Every failure below — no address, no token, no network, a timeout, a revoked
 *     token, a lapsed plan, an unreadable snapshot, a full disk — lets the write through;
 *   · **acceptance criterion 3 of 8.1, composition.** *"Where both rule on the same event, a deny is
 *     never overridden."* This hook emits a `deny` or it emits NOTHING. There is no `allow` anywhere
 *     in it, so a `deny` a builder's own hook returned can never be overturned by this one.
 *
 * The matcher stays `*`, which is also the stub's decision and its argument: *"It is not a narrower
 * matcher chosen to make the stub cheap."* A matcher of `Edit|Write|Bash` would let a writing tool
 * nobody listed cross a frozen zone without this hook ever running. With `*`, an unknown tool
 * reaches `WRITER_TOOL_NAMES`, is not on it, and is allowed — the same outcome, except the product
 * can see it. The cost is one `node` spawn per tool call, MEASURED (annexe A3, a `spawnSync` bench —
 * not the `claude -p` smoke session itself) and reported.
 *
 * ── THE ORDER, AND EVERY STEP OF IT IS AN ACCEPTANCE CRITERION ─────────────────────────────────
 *
 *   1. not a writing tool, or no path in the call → **exit 0, no disk, no network**;
 *   2. a FRESH snapshot and no glob matches → **exit 0, ZERO network**. The common case, and AC-2
 *      read literally: *"it passes untouched … and zero tokens burn waiting"*;
 *   3. a glob matches → **ONE confirmation**. Still pending ⇒ `deny`. Unreachable, revoked, lapsed,
 *      timed out or unreadable ⇒ **allow**, and the hole is queued for the next call that succeeds;
 *   4. no fresh snapshot → refresh first, then 2 or 3 over the answer.
 *
 * **The network can only LIFT a refusal, never create one** (memo 83-1 (c)). That is the literal
 * shape of *"telemetry NEVER conditions the refusal"*: nothing arriving over a wire can turn an
 * allowed write into a refused one — only a zone already on this machine can do that, and only after
 * the server has confirmed it is still unsealed. AC-3 falls out for free: the confirmation SEES the
 * seal, so the zone is freed the instant it is sealed rather than at the next session.
 *
 * ── THE ONE EXIT, AND ITS ARGUMENT IS `0` ─────────────────────────────────────────────────────
 *
 * Exit code 2 is the BLOCKING code on this event, with stderr as the reason. A crash, a full disk, a
 * malformed payload or an unhandled rejection exiting non-zero would therefore become a REFUSAL this
 * product never decided, in words nobody wrote. There is exactly one `process.exit` in this file and
 * its argument is the literal `0`; everything that could throw is inside a `try`.
 */
import process from 'node:process';
// Imported rather than taken off the global: `Buffer` is a Node global at runtime and ESLint's
// `no-undef` reaches this shipped file (measured on 2026-08-28, `npm run lint`). Naming the module
// it comes from is both the fix and the honest statement — this file runs on Node and says so.
import { Buffer } from 'node:buffer';

import { composeRefusal, decideFreeze, writeIntent } from './lib/freeze.mjs';
import { credentials, fetchZones, postGaps } from './lib/client.mjs';
import { clearGaps, queueGap, readGaps, readSnapshot, writeSnapshot } from './lib/store.mjs';

/** Read the whole event off stdin. Answers `null` on anything that is not one JSON object. */
async function readEvent() {
  const chunks = [];
  try {
    for await (const chunk of process.stdin) chunks.push(chunk);
    const text = Buffer.concat(chunks).toString('utf8').trim();
    if (text === '') return null;
    const parsed = JSON.parse(text);
    return parsed !== null && typeof parsed === 'object' ? parsed : null;
  } catch {
    // Empty stdin, a broken pipe, a truncated write, something that is not JSON. One answer, and it
    // freezes nothing: a hook that could not read the event has nothing to rule on.
    return null;
  }
}

/**
 * Ask the server, and post the queue on the way through — *"the hole is journaled ON RETURN"*.
 *
 * The flush happens on a call that SUCCEEDED, which is what *on return* means: the first moment this
 * machine can reach the register again. The queue is cleared only if the register accepted it, so a
 * hole survives a half-restored network and goes out next time.
 */
async function refresh(origin, token) {
  const answer = await fetchZones(origin, token);
  if (!answer.ok) return answer;

  const gaps = readGaps();
  if (gaps.length > 0 && (await postGaps(origin, token, gaps))) clearGaps();

  writeSnapshot(answer.zones);
  return answer;
}

/**
 * One hole, in the payload shape the register stores. `packet_id` is the zone the write crossed —
 * which is why a hole is recorded only when a snapshot named one.
 *
 * `at` is this machine's clock, reported as a fact. It orders nothing: the register's order is `seq`,
 * and `freeze-events.ts` says so where the payload is declared.
 */
function gapOf(hit, reason) {
  return {
    packet_id: hit.zone.packet_id,
    path: hit.path,
    tool: hit.tool,
    at: new Date().toISOString(),
    reason,
  };
}

/** The one shape that refuses a write: `deny`, its sentence, and nothing else. */
function refuse(hit) {
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: composeRefusal({
          reference: hit.zone.reference ?? null,
          question: hit.zone.question ?? null,
          deepLink: hit.zone.deep_link ?? '',
          glob: hit.glob,
          tool: hit.tool,
        }),
      },
    })}\n`,
  );
}

/**
 * THE WHOLE DECISION. Writes at most one line on stdout, and returns.
 *
 * It never returns *"allow"* because there is nothing to return: writing nothing IS the pass, and it
 * is the only shape that cannot overturn somebody else's refusal.
 */
async function rule(event) {
  /*
   * STEP 1 — is this even a write? Asked BEFORE the disk is opened.
   *
   * A tool that is not on `WRITER_TOOL_NAMES`, or a call that names no path, is not something this
   * hook has anything to say about: it returns having read no file and constructed no request. On a
   * matcher of `*` this is most tool calls in a session, so it is also where nearly all of the
   * spawn's cost has to stop.
   */
  if (writeIntent(event) === null) return;

  const snapshot = readSnapshot();

  // A path a CACHED zone freezes. `null` when the cache is stale, absent, or names nothing that bit.
  const cachedHit =
    snapshot.fresh && snapshot.zones !== null ? decideFreeze(event, snapshot.zones) : null;

  /*
   * STEP 2 — AC-2, literally: a fresh snapshot that freezes nothing this call touches ends HERE. No
   * request is constructed, no address is read, no token is touched. The overwhelmingly common case
   * for a builder working outside their frozen zones, and the whole reason the cache exists.
   *
   * **Unless this machine still owes the register something.** A queued hole is a fact the builder
   * has not been told yet, and *"journaled on return"* means the first moment this machine can reach
   * the register — not the first moment it happens to want something. So a non-empty queue costs one
   * request at the next write, which is rare by construction: the queue is empty on every ordinary
   * run, and this branch is the only thing that makes the promise true rather than eventual.
   */
  if (snapshot.fresh && cachedHit === null && readGaps().length === 0) return;

  const { origin, token } = credentials();
  if (origin === null || token === null) {
    /*
     * No address or no token — this install was never able to ask. It is the `unreachable` cause, and
     * it is recorded like the others WHEN a cached zone named the packet. When nothing did, this
     * machine does not know a zone existed and **nothing is journaled**: a row invented for a
     * decision nobody identified would be this product fabricating a freeze (D82). The hole in the
     * journal is named in the report rather than filled with a guess.
     */
    if (cachedHit !== null) queueGap(gapOf(cachedHit, 'unreachable'));
    return;
  }

  const answer = await refresh(origin, token);
  if (!answer.ok) {
    // AC-4's four causes — unreachable, unauthorized, expired, timeout — all ending the same way:
    // THE WRITE PASSES. This is the line the whole story is judged on.
    if (cachedHit !== null) queueGap(gapOf(cachedHit, answer.reason));
    return;
  }

  /*
   * The confirmation, re-matched against the server's CURRENT list — and that is AC-3.
   *
   * The same `decideFreeze`, the same globs, the same paths: ONE matching implementation, exercised
   * by the same tests. A decision sealed since the snapshot is no longer on this list, so the zone is
   * free and this returns having written nothing — *"deny while pending, pass after seal"*, inside
   * one session rather than at the next one.
   */
  const hit = decideFreeze(event, answer.zones);
  if (hit !== null) refuse(hit);
}

async function main() {
  try {
    const event = await readEvent();
    if (event !== null) await rule(event);
  } catch {
    /*
     * Nothing above should be able to reach this. If something does, the write goes through and the
     * session is not told: the alternative on THIS event is an exit code that means *blocked*, and a
     * refusal nobody wrote is worse than a guardrail that missed one call.
     */
  }
  process.exit(0);
}

void main();
