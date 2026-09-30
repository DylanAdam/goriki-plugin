/**
 * THE HOOK'S OWN STATE — the ONE thing it is allowed to write. Story 8.3 · D84-D86, D103.
 *
 * ── WHAT MAY BE WRITTEN, AND WHERE, AND NOWHERE ELSE ──────────────────────────────────────────
 *
 * D84-D86: Goriki never writes code, never runs a test or a build, and holds no write key on a
 * builder's repository. The one exception the story's own brief states is this: *"its only permitted
 * write is its own state under `${CLAUDE_PLUGIN_DATA}`"* — the directory the client hands each
 * plugin for exactly this. `PLUGIN_NAME` in the contracts carries the full shape of that path and
 * why the name is short; it is not repeated here, because a guard in `plugin-files.test.ts` reads
 * every shipped byte for a home-relative path and is right to refuse one even inside a comment.
 *
 * So every path in this file is composed from that variable, and a run with the variable unset
 * writes NOTHING and says so by answering `null`. There is no fallback to a temp directory, no
 * directory of this plugin's own choosing, no file beside the user's own sources. A guardrail
 * that scattered state through somebody's repository would be a guardrail they were right to
 * distrust.
 *
 * ── AND NOTHING HERE THROWS ───────────────────────────────────────────────────────────────────
 *
 * A read that fails answers `null`; a write that fails answers `false`. A disk that is full, a
 * directory somebody removed mid-session, a file another process is holding, a JSON that was
 * truncated by a crash — every one of them is a state this hook meets by carrying on. The freeze is
 * fail-open, and a `PreToolUse` hook that crashed would exit non-zero, which on this event is the
 * BLOCKING code: a broken disk would become a refusal this product never decided.
 */
import process from 'node:process';
import { appendFileSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** The snapshot, and the queue of holes waiting for a call that succeeds. Two files, one directory. */
const SNAPSHOT_FILE = 'freeze-snapshot.json';
const GAPS_FILE = 'freeze-gaps.json';

/**
 * AND THE LOCK THE QUEUE IS MODIFIED UNDER — a DIRECTORY, and it lives beside the two files.
 *
 * `mkdir` is the one create-if-absent primitive that is atomic on every filesystem this plugin runs
 * on, NTFS included: the call either creates the entry or fails with `EEXIST`, with no window in
 * between for a second process to win the same race. There is no `O_EXCL` to reach for from this
 * file's small vocabulary and no dependency to add (a plugin ships without `node_modules`), so the
 * directory IS the mutex. It exists only while a call holds it — every path below releases it in a
 * `finally`, and a run that leaves one behind would be caught by the guard in
 * `pre-tool-use-hook.test.ts` that asserts this directory holds exactly the two files and nothing
 * else.
 */
const GAPS_LOCK_DIR = 'freeze-gaps.lock';

/**
 * SIXTY SECONDS, and the figure is borrowed on purpose.
 *
 * It is the window this product already prints on frame 7i beside the fail-open guarantee —
 * *"Revocation takes effect within 60 seconds"*. A snapshot older than that is refreshed before it
 * is trusted, so the longest a zone SEALED elsewhere can go on being matched against is the same
 * minute a revoked token can go on working, and a builder has one number to hold rather than two.
 *
 * Staleness is safe in the DENY direction and only there: a cached zone that matches is always
 * confirmed against the server before anything is refused, so a stale snapshot can never produce a
 * refusal. What the TTL bounds is the other direction — a zone created since the last refresh is not
 * enforced until one happens, which is a hole that closes by itself within a minute.
 */
export const SNAPSHOT_TTL_MS = 60_000;

/**
 * HOW MANY HOLES ARE KEPT. `FREEZE_GAP_BATCH_MAX` in the contracts, and the route refuses more.
 *
 * A machine that spent a week offline inside a frozen zone does not get to post a thousand rows into
 * an append-only log on its first successful request. The overflow is dropped OLDEST FIRST — the
 * newest gaps are the ones a builder can still act on — and the guide says so, because a bound
 * nobody wrote down is a surprise rather than a bound.
 */
export const GAPS_MAX = 20;

/** The plugin's own directory, or `null` when the client did not name one. Never invented. */
function dataDir() {
  const dir = process.env.CLAUDE_PLUGIN_DATA;
  return typeof dir === 'string' && dir.trim() !== '' ? dir.trim() : null;
}

/** Parsed JSON from one of this plugin's own files, or `null`. Every failure is `null`. */
function readJson(name) {
  const dir = dataDir();
  if (dir === null) return null;
  try {
    return JSON.parse(readFileSync(join(dir, name), 'utf8'));
  } catch {
    // Absent, unreadable, truncated by a crash, or holding something that is not JSON. One answer.
    return null;
  }
}

/** Write one of this plugin's own files. `false` on any failure, and nothing is reported anywhere. */
function writeJson(name, value) {
  const dir = dataDir();
  if (dir === null) return false;
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, name), `${JSON.stringify(value)}\n`, 'utf8');
    return true;
  } catch {
    return false;
  }
}

/**
 * THE CACHED ZONES, and whether they are still fresh — read in one step so a caller cannot ask the
 * second question without the first.
 *
 * `zones` is `null` when there is no usable snapshot at all, which is a DIFFERENT state from an
 * empty list: *"this machine has never been told"* is not *"nothing is frozen"*, and only the second
 * one may be acted on. The caller uses the distinction to decide whether it knows enough to journal
 * a gap — a hole it cannot name is a hole it does not record, rather than a row invented about a
 * decision nobody identified.
 */
export function readSnapshot(now = Date.now()) {
  const stored = readJson(SNAPSHOT_FILE);
  if (stored === null || typeof stored !== 'object') return { zones: null, fresh: false };
  const { fetched_at: fetchedAt, zones } = stored;
  if (!Array.isArray(zones) || typeof fetchedAt !== 'number') return { zones: null, fresh: false };
  return { zones, fresh: now - fetchedAt < SNAPSHOT_TTL_MS && now >= fetchedAt };
}

/** Replace the snapshot with what the server just said. A failure to write costs one round trip. */
export function writeSnapshot(zones, now = Date.now()) {
  return writeJson(SNAPSHOT_FILE, { fetched_at: now, zones });
}

/**
 * ── B-83-2, CORRECTED 2026-08-28: THE QUEUE WAS A READ-MODIFY-WRITE ON ONE FILE ───────────────────
 *
 * `queueGap` used to be `writeJson(GAPS_FILE, [...readGaps(), gap].slice(-GAPS_MAX))` — a hook is
 * ONE PROCESS PER TOOL CALL, and Claude Code routinely fires several tool calls in one turn, so
 * several `pre-tool-use.mjs` processes can run this at once. Each one reads the file, appends IN
 * MEMORY, and overwrites it — the classic lost-update race. MEASURED: 8 concurrent fail-open writes,
 * each queuing its own hole, recorded 2 of 8 (`83-rev1-conc.cjs`). AC-4 says the hole is *"journaled
 * ON RETURN, so the user learns what went unguarded"* — a register that kept a quarter of what
 * happened is not that.
 *
 * The fix: one hole is one `appendFileSync` — opened, written, closed, never held across a read. Two
 * processes appending never overwrite each other's bytes; the worst a lost race can do is interleave
 * two writes' *characters* if the OS did not serialize the underlying `write()` calls, and a
 * corrupted LINE is read back as one skipped entry (`readGaps` below), never as data loss for every
 * OTHER line. `GAPS_MAX` moves from an eager trim on every write to a ceiling this file SCANS: what
 * matters is that a queue nobody has flushed in a long time still answers in bounded time, not that
 * the write path ever has to read before it appends.
 */
const GAP_LINE_SEPARATOR = '\n';

/** One line of `GAPS_FILE`, parsed — or `null` for a blank line or one a concurrent write half-wrote. */
function parseGapLine(line) {
  if (line.trim() === '') return null;
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

/**
 * ── THE LOCK, AND WHAT IT IS ALLOWED TO COST (B-83-2, ROUND 3 · 2026-09-02 · D103) ────────────────
 *
 * Two numbers and a staleness bound, and each of them is chosen against the same rule: this runs
 * INSIDE a `PreToolUse` hook, on the critical path of somebody's tool call. A guardrail that made a
 * builder wait would be a guardrail they turn off.
 *
 * - **BUDGET, 250 ms total.** The whole point of the wait is to survive the ordinary case — a
 *   handful of hook processes from one turn, each holding the lock for one `appendFileSync` or one
 *   read-and-rewrite of a file bounded at `GAPS_MAX` lines. That is microseconds of held time, so a
 *   quarter of a second is many turns' worth of queueing. Past it the caller FAILS OPEN rather than
 *   waits longer: see `queueGap` and `clearGaps` below for what each one does instead.
 * - **SPIN, 5 ms.** Requested, not guaranteed — a timer on Windows rounds up to its own tick, which
 *   makes the real spin coarser and the budget a ceiling on attempts rather than a promise of them.
 *   Sleeping is `Atomics.wait` on a private buffer nobody else can see: the one way to pause a
 *   SYNCHRONOUS function without burning a core, and no import.
 * - **STALE, 2 s.** A hook that was killed mid-call — the client shut down, the machine slept, the
 *   user hit escape — leaves its directory behind, and a lock nobody will ever release would freeze
 *   this queue permanently. Two seconds is far longer than any call here can legitimately hold it
 *   and far shorter than a person notices. Breaking a stale lock CAN, in principle, hand the queue
 *   to two processes at once (the owner comes back from a two-second stall and finishes). SUPERSEDED
 *   2026-09-02 (D41): "a duplicate line, never a lost one" is not quite the cost this file accepts
 *   everywhere else any more — measured, one path is a genuine loss rather than a duplicate (see the
 *   supersessions on `queueGap` and `clearGaps` below), reached only when a peer holds this same lock
 *   past its own budget, and kept rather than closed for the reason those two give: the alternative
 *   is making a fail-open append wait.
 */
const GAPS_LOCK_BUDGET_MS = 250;
const GAPS_LOCK_SPIN_MS = 5;
const GAPS_LOCK_STALE_MS = 2_000;

/** Pause this synchronous call without spinning a core. A private buffer: nothing else waits on it. */
function pause(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    // A runtime that refuses to block here loses only the pause, never the caller's budget check.
  }
}

/** Remove a lock whose owner is plainly gone. Any failure means somebody else got there first. */
function breakStaleGapsLock(lock) {
  try {
    if (Date.now() - statSync(lock).mtimeMs > GAPS_LOCK_STALE_MS) rmSync(lock, { recursive: true, force: true });
  } catch {
    // It vanished between the `mkdir` that failed and this `stat`, or it cannot be read. Either way
    // the next attempt of the loop is the answer, not an error anybody hears about.
  }
}

/**
 * TAKE THE LOCK, or answer `false` — and the difference between those two answers is the whole
 * fail-open guarantee, so the failures are told apart rather than lumped together.
 *
 * `EEXIST` is the ONLY failure that means *"somebody else holds it"*, and it is the only one worth
 * waiting on. `ENOENT` (the directory the client named does not exist and could not be made) and
 * `EACCES` (it exists and refuses us) are states where every subsequent attempt fails identically:
 * spinning on them would spend the budget to reach the same answer, and — worse — a directory that
 * cannot be created would read as *"held by another process"* forever. `dataDir()` deliberately does
 * not create anything, so the creation happens HERE, before the lock, on every call.
 */
function acquireGapsLock(dir) {
  const lock = join(dir, GAPS_LOCK_DIR);
  const deadline = Date.now() + GAPS_LOCK_BUDGET_MS;
  for (;;) {
    try {
      mkdirSync(dir, { recursive: true });
      mkdirSync(lock);
      return true;
    } catch (error) {
      if (error?.code !== 'EEXIST') return false;
    }
    breakStaleGapsLock(lock);
    if (Date.now() >= deadline) return false;
    pause(GAPS_LOCK_SPIN_MS);
  }
}

/** Give it back. In a `finally`, always, and a failure here is not a failure of the caller's work. */
function releaseGapsLock(dir) {
  try {
    rmSync(join(dir, GAPS_LOCK_DIR), { recursive: true, force: true });
  } catch {
    // Already gone (a stale-breaker took it) or undeletable. The next caller's stale bound covers it.
  }
}

/**
 * Remembers the exact bytes the last `readGaps()` call saw, so `clearGaps()` can remove PRECISELY
 * those — never the whole file — even if another process appended a new hole in between. This is
 * safe because the two are always called from the same run of `rule()` in `pre-tool-use.mjs`, in
 * that order, with no other `readGaps()` between them; it is not a cross-process lock and does not
 * need to be one, because the file itself is never read-then-rewritten from a stale copy any more.
 */
let lastReadRaw = null;

/** The holes waiting for a call that succeeds, oldest first. A corrupt file reads as empty. */
export function readGaps() {
  const dir = dataDir();
  if (dir === null) {
    lastReadRaw = null;
    return [];
  }
  let raw;
  try {
    raw = readFileSync(join(dir, GAPS_FILE), 'utf8');
  } catch {
    // Absent or unreadable. `clearGaps` after this reads nothing back out either — both agree.
    lastReadRaw = null;
    return [];
  }
  lastReadRaw = raw;
  const gaps = [];
  for (const line of raw.split(GAP_LINE_SEPARATOR)) {
    const parsed = parseGapLine(line);
    if (parsed !== null) gaps.push(parsed);
  }
  // The ceiling is now a SCAN bound, not a write-time trim (see the note above `GAP_LINE_SEPARATOR`).
  return gaps.slice(-GAPS_MAX);
}

/**
 * Add one hole to the queue — one `appendFileSync`, and nothing before it is read.
 *
 * The write happens on the same run as the allow, so a session that ends immediately afterwards
 * still has the record on disk for the next one — *"journaled on return"* means the next successful
 * request, not the next moment of good luck.
 *
 * ── AND IT TAKES THE LOCK, BUT IT DOES NOT NEED IT (round 3, 2026-09-02) ──────────────────────────
 *
 * The append was already atomic against another append. What it was NOT protected against is a
 * concurrent `clearGaps()`, which reads the file and writes back a remainder: a line appended
 * between that read and that write is overwritten by it. So this side takes the lock too — that is
 * the only way the other side's read-modify-write can be made to exclude it.
 *
 * When the lock cannot be had inside the budget, this appends ANYWAY. D103 decides it and it is not
 * close: losing a hole is the failure this whole queue exists to prevent, and a duplicate is a line
 * the register can dedupe against `packet_id` + `path`.
 *
 * SUPERSEDED 2026-09-02 (D41): the worst an unlocked append can meet is not that description any
 * more — measured, it is this same append landing inside a concurrent `clearGaps()`'s own locked
 * read and write (see the supersession on that function below), overwritten by the write it lands
 * ahead of, reached only when a peer holds `GAPS_LOCK_DIR` past this call's own 250 ms budget, and
 * kept rather than closed because closing it would give this fail-open append the very wait D103
 * says it must not take.
 */
export function queueGap(gap) {
  const dir = dataDir();
  if (dir === null) return false;
  const held = acquireGapsLock(dir);
  try {
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, GAPS_FILE), `${JSON.stringify(gap)}${GAP_LINE_SEPARATOR}`, 'utf8');
    return true;
  } catch {
    return false;
  } finally {
    if (held) releaseGapsLock(dir);
  }
}

/**
 * Empty the queue — called only after the register has ACCEPTED the batch `readGaps()` last
 * returned, and it removes exactly THOSE bytes, never the file wholesale: a hole another process
 * appended between that `readGaps()` and this call survives, to be posted on the NEXT round trip
 * rather than discarded unposted.
 *
 * ── B-83-2, ROUND 2 — CORRECTED 2026-08-28: A MISMATCH IS A NO-OP, NEVER A WIPE ───────────────────
 *
 * Round one made `queueGap`'s append atomic, but left THIS function doing read-then-conditional-
 * wipe: `current.startsWith(consumed) ? current.slice(consumed.length) : ''`. Two concurrent
 * `pre-tool-use.mjs` processes routinely see the SAME pending batch — this hook flushes on ANY
 * write once the queue is non-empty, in-zone or not (`pre-tool-use.mjs`'s own comment on that
 * branch), and Claude Code fires several tool calls per turn — both flush it, and both call
 * `clearGaps()`. Whichever runs SECOND finds the file has moved on: a THIRD process appended a
 * genuinely new hole while the first two were in flight to the server, so `current` no longer starts
 * with that process's now-stale `consumed` snapshot. The old `else` branch answered
 * `remainder = ''` — it wiped the file, the new hole included, discarding data `readGaps()` never
 * handed back to anyone. MEASURED cross-process against the shipped file:
 * `.build/tmp-verify/83-rev2-clearrace.mjs` (+ `-reader.mjs`) — `FAIL — g4 was WIPED by a concurrent
 * clearGaps()`.
 *
 * The fix: on a mismatch, this function now touches NOTHING. A `consumed` snapshot that no longer
 * matches means this process has been overtaken — someone else's `clearGaps()` already ran the
 * removal, or a batch this process never read has arrived — and the only safe move left is to leave
 * the file exactly as it stands for whoever reads it next. The cost is bounded and never silent: a
 * line this process's OWN successful POST already flushed can survive to be posted again on the next
 * round trip (a duplicate the register can dedupe against `packet_id` + `path`), which is a small,
 * visible waste — never the alternative this correction closes, a hole a builder was never told about
 * because a wipe destroyed it before any of the two processes could hand it to the register.
 *
 * ── SUPERSEDED 2026-09-02 (D41) — ROUND 2 CLOSED THE WIPE AND LEFT THE WINDOW OPEN ────────────────
 *
 * The paragraph above stands as written and is kept verbatim: the no-op on mismatch is still the
 * belt, and it is still what stops a batch this process never read from being discarded. What it did
 * NOT close is the gap between the `readFileSync` and the `writeFileSync` two lines apart in this
 * very function. A THIRD process appending inside that window has its line read into `current` by
 * nobody and written back by no one — the `slice` that follows was computed from bytes taken before
 * the append, so the append is overwritten. Round 2 moved the loss from a wipe of the whole file to
 * a wipe of one line, which is smaller and just as silent.
 *
 * MEASURED as a flake rather than as a repro, which is why it survived a round: the suite's own
 * cross-process test (`pre-tool-use-hook.test.ts`, the round-2 describe) reddened FOUR times under
 * load across two days and passed alone every time — `8.3-final-verify` § 5, then
 * `8.9-final-verify`, whose words were *"the correction moved the problem, it did not solve it"*.
 *
 * ROUND 3 closes it with a lock rather than with a cleverer comparison, because there is no
 * comparison to be clever with: the file can change between any two syscalls, and only mutual
 * exclusion makes read-then-write one step. `queueGap` and this function both take
 * `GAPS_LOCK_DIR`; `readGaps` does not, and does not need to — a stale read is still correct,
 * because THIS function re-reads under the lock and no-ops on the mismatch that a stale read
 * produces.
 *
 * SUPERSEDED 2026-09-02 (D41, same day): "a bounded duplicate, never a loss" was not quite the whole
 * cost either — measured, an unlocked fail-open append from `queueGap` (see its own supersession
 * above) landing between this function's read and its write is overwritten by that write, a genuine
 * loss rather than a duplicate, bounded to the same regime as that one — a peer holding the lock past
 * the 250 ms budget — and kept for the reason `queueGap`'s own comment gives: closing it would mean
 * locking the one append this queue promises never to make anybody wait for. What retires this lock
 * one day is the queue ceasing to be a file two processes share — nothing smaller.
 */
export function clearGaps() {
  const dir = dataDir();
  if (dir === null) return false;
  const consumed = lastReadRaw;
  lastReadRaw = null;
  // Nothing was ever read (`readGaps` found no file, or was never called) — there is nothing this
  // call knows it may remove, so it removes nothing. `pre-tool-use.mjs` never reaches this branch in
  // practice: it calls `clearGaps` only after `readGaps().length > 0`, which cannot be true here.
  if (consumed === null) return true;
  /*
   * The budget ran out with somebody else holding the queue. This does NOTHING — the opposite
   * choice from `queueGap`'s, and for the same reason: the lines this call would have removed are
   * lines the register has already accepted, so leaving them costs one re-POST on the next round
   * trip, while removing them without exclusion is how a hole disappears. Fail-open here means
   * *"do not touch it"*, and it answers like the other no-op branches: nothing failed.
   */
  if (!acquireGapsLock(dir)) return true;
  try {
    const current = readFileSync(join(dir, GAPS_FILE), 'utf8');
    // A mismatch means the file moved on since this process's own `readGaps()` — leave it untouched
    // rather than guess at what is safe to discard (see the block comment above).
    if (!current.startsWith(consumed)) return true;
    writeFileSync(join(dir, GAPS_FILE), current.slice(consumed.length), 'utf8');
    return true;
  } catch {
    return false;
  } finally {
    releaseGapsLock(dir);
  }
}
