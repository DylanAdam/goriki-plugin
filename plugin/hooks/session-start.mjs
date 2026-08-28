/**
 * `SessionStart` — THE RULES ARRIVE BEFORE THE FIRST TURN. Story 8.2 · FR-35, AD-31, D103.
 *
 * ── WHAT THIS RETIRES, AND WHEN (D41 — an addition names its retraction) ───────────────────────
 *
 * Until 2026-08-28 this file was Story 8.1's STUB. It drained stdin, exited 0, and its header said
 * why in as many words: *"Story 8.1 is the CONTAINER … the BEHAVIOUR of this particular hook is
 * Story 8.2's (the launch context injection). So this file exists, `/hooks` lists it, and it does
 * nothing at all."* That sentence is now spent: this is the behaviour it was holding a place for.
 * The stub's own rules survive it whole — nothing here decides, nothing here writes a file, nothing
 * here keeps state between two sessions.
 *
 * ── WHAT IT DOES ───────────────────────────────────────────────────────────────────────────────
 *
 *   1. read the address and the token the install carried;
 *   2. `GET <origin>/api/agent/context` with the token as a bearer, aborting after five seconds,
 *      never following a redirect;
 *   3. write what came back into `hookSpecificOutput.additionalContext` — but only when it answered
 *      `200` with its OWN content type, `text/plain`;
 *   4. if any of that fails — no address, no token, no network, a timeout, a refusal, a redirect, an
 *      answer in a content type this route never sends — write the honest line instead, and start
 *      the session anyway.
 *
 * **It exits 0 in every single one of those cases.** `SessionStart` is classified *context only* by
 * the client and cannot carry a blocking decision at all, but exit code 2 is the blocking code on
 * every other event and a hook that wrote it here would be D103 broken in a diff. There is exactly
 * one `process.exit` in this file and its argument is the literal `0`.
 *
 * ── AND IT IS NOT GENERATED, WHICH IS A DECISION ([PROP-82-7] (a), memo 82-7) ──────────────────
 *
 * `plugin/` is DATA: it is copied onto a user's disk verbatim and there is no `node_modules` beside
 * it, so nothing here can `import` from `@goriki/shared`. Two ways to keep the copy honest: generate
 * this file from the constants, or write it out and have a gate compare it back. Generating it was
 * refused — generated executable code makes a diff illegible, and the file a person runs stops being
 * the file a reviewer reads. So the sentences below are spelled out, and
 * `packages/claude-plugin/src/session-start-hook.test.ts` reads these BYTES back and compares them
 * to `packages/shared/src/contracts/session-start.ts`. Change one without the other and the gate
 * says which line moved.
 *
 * ── THE TOKEN ([PROP-82-2], memo 82-2) — AND THE ANSWER IS MEASURED, 2026-08-28 ────────────────
 *
 * The MCP entry gets its token through `headers` in `.mcp.json`, which the client substitutes. A
 * hook is a SEPARATE PROCESS and the `command` type has no `env` field, so the memo said: probe
 * `${user_config.goriki_pat}` in the command first, document `GORIKI_PAT` as the fallback.
 *
 * **The probe answered, and it answered by refusing.** With
 * `node "…/session-start.mjs" "${user_config.goriki_url}" "${user_config.goriki_pat}"` installed,
 * Claude Code 2.1.246 did not run the hook at all:
 *
 *     Failed to run: Hook from plugin goriki@goriki-plugin references ${user_config.*} in a
 *     shell-form command. The substituted value would be re-parsed by the shell. Use exec form
 *     instead — {"command": "<executable>", "args": ["${user_config.KEY}", ...]} — or read
 *     $CLAUDE_PLUGIN_OPTION_<KEY> from the hook's environment.
 *
 * The client named two channels and the second is better than anything the memo weighed: the values
 * arrive as ENVIRONMENT VARIABLES, so **the token is never on the process command line** — the one
 * cost [PROP-82-2] (a) asked to have named is gone rather than accepted. Measured with a throwaway
 * probe plugin that printed the NAMES (never the values) of every `CLAUDE_*` variable a hook
 * receives: `CLAUDE_PLUGIN_OPTION_GORIKI_PAT`, `CLAUDE_PLUGIN_OPTION_GORIKI_URL` — the userConfig
 * key, upper-cased — beside `CLAUDE_PROJECT_DIR` and `CLAUDE_PLUGIN_ROOT`.
 *
 * So this file reads, in order:
 *
 *   1. `CLAUDE_PLUGIN_OPTION_GORIKI_URL` / `CLAUDE_PLUGIN_OPTION_GORIKI_PAT` — the client's own
 *      channel for what the install carried;
 *   2. `GORIKI_URL` / `GORIKI_PAT` — the documented fallback, for a by-hand setup with no plugin.
 *
 * It reads **no command-line argument at all**, and a gate asserts that by grepping this file for
 * the name of the array they would come from — so no future edit can put a token back on a command
 * line without first deleting the assertion that says it may not.
 *
 * Reading `~/.claude.json` — where 8.1 MEASURED the value actually living — was refused: it is an
 * undocumented, non-contractual file, and depending on its shape would break silently on the day it
 * changes, which is the exact class of failure 8.1's acceptance criterion exists to forbid.
 *
 * **Nothing in this file prints, logs or stores the token.** It is put in one header and dropped.
 */
import process from 'node:process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The route the agent plane answers on. It is `AGENT_CONTEXT_PATH` in
 * `apps/api/src/routes/agent-context.ts`, and the gate compares this literal to that one.
 */
const AGENT_CONTEXT_PATH = '/api/agent/context';

/**
 * Five seconds, and the hook's declared `timeout` is ten.
 *
 * The route's family budget is fifteen seconds, so the hook lets go BEFORE the server does — on
 * purpose. A session held at the prompt while a broken network is retried is a session that is
 * blocked in the only sense a person experiences, and *"a SessionStart failure is never blocking"*
 * is about what the builder gets to do next.
 */
const ABORT_MS = 5000;

/** AC-2, VERBATIM. Superseded copy `ses01b` v2, 2026-08-09 — never a sentence to improve. */
const DEGRADED_HEAD =
  'Goriki unreachable — live pending/frozen state unavailable · ' +
  'the block last written to CLAUDE.md still applies';

/** The server answered and refused. Its own sentence is relayed; this file writes no prose. */
const REFUSED_PREFIX = 'Goriki reached, live state not served — ';

/** The clause both lines close on. `(rev N)` is added if and only if a revision was READ. */
const STILL_APPLIES = 'the block last written to CLAUDE.md still applies';

/** The managed block's fence — Story 8.5 writes it, this only ever reads the revision out of it. */
const FENCE_OPEN = '<!-- goriki:rules';
const REV_KEY = 'rev';

/**
 * WHERE THE INSTALL'S TWO VALUES ARRIVE — MEASURED (Claude Code 2.1.246, 2026-08-28).
 *
 * The client exports each `userConfig` key to a hook's environment as `CLAUDE_PLUGIN_OPTION_<KEY>`,
 * the key upper-cased. `pluginOptionEnvVar()` in `packages/shared/src/contracts/plugin.ts` is the
 * same rule written once for the repository, and a gate compares these two literals to it.
 */
const OPTION_URL = 'CLAUDE_PLUGIN_OPTION_GORIKI_URL';
const OPTION_PAT = 'CLAUDE_PLUGIN_OPTION_GORIKI_PAT';

/** The by-hand fallback, for a setup with no plugin at all. `MCP_TOKEN_ENV_VAR` is the second. */
const FALLBACK_URL = 'GORIKI_URL';
const FALLBACK_PAT = 'GORIKI_PAT';

/**
 * The revision of the managed block on this disk, or `null`.
 *
 * `$CLAUDE_PROJECT_DIR` is exported to hooks, and it is the only path by which a real revision can
 * be known when the server cannot be reached. Every failure answers `null` and none throws: a
 * missing file, an unreadable one, no block, a hand-edited fence, a `rev` that is not a number. A
 * crash while composing the message that says the server is down would be a failure inside a
 * failure handler.
 *
 * The FIRST opening fence wins, and only that fence's own line is ever searched for `rev` — a file
 * with two managed blocks never falls through to a LATER one to find a value, even one it has. This
 * is the identical two-step algorithm `readManagedBlockRev` in `packages/shared/src/contracts/
 * managed-block.ts` runs (corrected together, blocker B-3, corr. wave 11 manche 1); the fence
 * marker, the `rev` key and this grammar are pinned against that module's exports in
 * `session-start-hook.test.ts`, so the two copies this file cannot avoid having cannot drift again.
 */
function readManagedBlockRev() {
  try {
    const dir = process.env.CLAUDE_PROJECT_DIR;
    if (typeof dir !== 'string' || dir === '') return null;
    const text = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
    const start = text.indexOf(FENCE_OPEN);
    if (start === -1) return null;
    const lineEnd = text.indexOf('\n', start);
    const fence = text.slice(start, lineEnd === -1 ? text.length : lineEnd);
    const match = fence.match(new RegExp(`\\b${REV_KEY}="?([^\\s">]+)"?`));
    const token = match === null ? null : match[1];
    if (token === null || token === undefined) return null;
    // Decimal, no sign, no leading zero: `007` and `7` must not be two spellings of one revision.
    return /^(?:0|[1-9][0-9]{0,18})$/.test(token) ? token : null;
  } catch {
    return null;
  }
}

/** ` (rev N)`, or nothing at all. D82: calculated or absent — never a placeholder, never a zero. */
function revSuffix() {
  const rev = readManagedBlockRev();
  return rev === null ? '' : ` (rev ${rev})`;
}

/** AC-2's line, whole. The state AC-2 describes: the call did not reach an answer. */
function degraded() {
  return `${DEGRADED_HEAD}${revSuffix()}`;
}

/** The state AC-2 does not describe: the server answered and refused, in its own words. */
function refused(message) {
  return `${REFUSED_PREFIX}${message} · ${STILL_APPLIES}${revSuffix()}`;
}

/**
 * The first of two environment names that carries a real value, or `null`.
 *
 * A blank variable and an absent one are ONE state — the rule `env.ts` states for the application
 * and the reason is the same here: a `.env` copied with an empty line is not a configuration. A
 * value still wearing `${user_config.…}` is refused too: the client refuses to run a hook shaped
 * that way at all, but a by-hand setup could still export the literal text, and posting it at a
 * server as though it were a token is the one thing this function exists to prevent.
 */
function fromEnv(primary, fallback) {
  for (const name of [primary, fallback]) {
    const value = process.env[name];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed === '' || trimmed.includes('${user_config.')) continue;
    return trimmed;
  }
  return null;
}

/**
 * The deployment's origin, from the one address the install carries.
 *
 * `goriki_url` ends in `/mcp` — the manifest says so. This is that function's literal inverse, and
 * it is strict on purpose: an address this file does not recognise answers `null` and the session
 * degrades, rather than a bearer token being posted at a path nobody chose. It is the same rule as
 * `agentPlaneOrigin` in the contracts — the twelve-shape refusal table and the five-origin
 * round-trip live there, in full, over the pure function directly
 * (`packages/shared/src/contracts/session-start.test.ts`). This copy's own suite exercises a
 * narrower slice — a trailing slash and one unrecognised path — through the real subprocess
 * (`session-start-hook.test.ts`), because a run per case there is a process spawn, not a function
 * call. The two bodies agree today by inspection, not by a gate that would catch them drifting.
 */
function agentPlaneOrigin(mcpUrl) {
  try {
    const url = new URL(mcpUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.pathname !== '/mcp' && url.pathname !== '/mcp/') return null;
    if (url.search !== '' || url.hash !== '') return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * ONE CALL. Answers the text to inject, whatever happens.
 *
 * Every branch returns a string and none of them throws: the caller has no error path because there
 * is nothing left for it to catch.
 */
async function contextBlock(mcpUrl, token) {
  const origin = mcpUrl === null ? null : agentPlaneOrigin(mcpUrl);
  // No address this file recognises, or no token: the server was never reachable from here.
  if (origin === null || token === null) return degraded();

  let response;
  try {
    response = await fetch(`${origin}${AGENT_CONTEXT_PATH}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}`, accept: 'text/plain' },
      signal: AbortSignal.timeout(ABORT_MS),
      // NEVER follow a redirect (blocker B-2, corr. manche 1). `agentPlaneOrigin` already picked the
      // ONE origin the install carries; a 3xx off that origin is not this route answering, it is a
      // captive portal, a corporate proxy or a load-balancer's error page sending the request
      // somewhere nobody named. `fetch` rejects when a redirect arrives under this setting, which the
      // `catch` below already turns into the honest degraded line — nothing third-party is ever read.
      redirect: 'error',
    });
  } catch {
    // No network, no host, no route, a redirect refused above, or five seconds gone. All of them are
    // "unreachable" from here.
    return degraded();
  }

  if (!response.ok) {
    // The server ANSWERED. Relay its own named sentence — this file composes none of its own.
    let message = '';
    try {
      const body = await response.json();
      const named = body?.error?.message;
      if (typeof named === 'string' && named !== '') message = named;
    } catch {
      message = '';
    }
    // An answer with no sentence in it tells a builder nothing, so it degrades to AC-2's line.
    return message === '' ? degraded() : refused(message);
  }

  // A `200` in a content type this route never sends is not this route's answer (blocker B-2, corr.
  // manche 1) — it is whatever sits on this origin's path today, read as though it were trusted
  // context. `agent-context.ts` always states `text/plain`; anything else — `text/html` from a
  // Wi-Fi sign-in page, a proxy's own placeholder — degrades exactly like an empty body, and none of
  // it is ever written into a session's context.
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  if (!contentType.startsWith('text/plain')) return degraded();

  try {
    const text = await response.text();
    return text.trim() === '' ? degraded() : text;
  } catch {
    return degraded();
  }
}

/**
 * Drain stdin without waiting on it.
 *
 * The client writes the event JSON there and a process that closes the pipe under the writer is a
 * broken pipe on the other side — 8.1's stub learned that and the lesson survives. Nothing in this
 * file READS that payload: `SessionStart` carries a matcher and a session id, and this hook does the
 * same thing on all five matchers (F17 — `startup`, `resume`, `clear`, `compact`, `fork`), which is
 * *"every session"* read as the criterion writes it.
 */
process.stdin.resume();
process.stdin.on('data', () => {});
process.stdin.on('error', () => {});

/**
 * THE ONE EXIT, AND ITS ARGUMENT IS `0`.
 *
 * `additionalContext` is the measured injection channel: the research bench had an agent restate an
 * injected Rule with **no tool call at all**. `initialUserMessage` is deliberately not used — it
 * injects a USER turn, so the agent would speak before the builder and spend tokens on every single
 * session opening. The story is *"the Rules arrive before the first turn"*, not *"speak first"*.
 */
async function main() {
  let context;
  try {
    context = await contextBlock(
      fromEnv(OPTION_URL, FALLBACK_URL),
      fromEnv(OPTION_PAT, FALLBACK_PAT),
    );
  } catch {
    // Nothing above should be able to reach this. If something does, the session still starts and
    // it is told the truth about what it has.
    context = DEGRADED_HEAD;
  }

  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context },
    })}\n`,
  );
  process.exit(0);
}

void main();
