/**
 * `PreCompact` — A COMPACTED SESSION RE-SERVES THE RULES. Story 8.9 · AC-2 · D120, D115, D103.
 *
 * ── WHAT THIS RETIRES, AND WHEN (D41 — an addition names its retraction) ───────────────────────
 *
 * Until 2026-08-28 this file did not exist: `PLUGIN_HOOK_EVENTS` held three events and the plugin
 * shipped three hooks. It is a fourth, and the count moved with it in one operation — the
 * constant, the on-screen legend, the generated documents and the one literal assertion.
 *
 * ── WHAT IT DOES ───────────────────────────────────────────────────────────────────────────────
 *
 *   1. read the address and the token the install carried (the same two environment names every
 *      hook in this package reads — measured by 8.2, never a command-line argument);
 *   2. `GET <origin>/api/agent/context` — **8.2's route, reused whole.** The compaction is about to
 *      drop the block `SessionStart` injected, so the same served text goes back in;
 *   3. `GET <origin>/api/agent/statusline` — the snapshot the status line renders, written to the
 *      plugin's data directory;
 *   4. if a Gate crossing arrived that this client has not pointed at yet, add ONE line naming it;
 *   5. exit 0.
 *
 * ── IT NEVER BLOCKS A COMPACTION, AND THAT IS THE ACCEPTANCE CRITERION ────────────────────────
 *
 * `PreCompact` is the one event of the four that CAN stop the client. The binary carries the
 * failure path by name — *"Compaction blocked by PreCompact hook"*, telemetry key
 * `compaction-blocked-by-hook` (measured, CLI 2.1.246, 2026-08-28) — and a compaction that does not
 * happen is a long session that dies at the context limit. That is the precise opposite of this
 * story.
 *
 * So, absolutely:
 *
 *   · **there is exactly one `process.exit` in this file and its argument is the literal `0`.**
 *     Exit code 2 is the blocking code on every event that has one;
 *   · **none of the three blocking keys is ever written to stdout** — the verdict word, the
 *     carry-on flag, and the reason a stop would carry. A gate in `plugin-files.test.ts` greps
 *     these bytes for all three, which is why this comment DESCRIBES them instead of spelling
 *     them: a rule written as an example ships its own counter-example;
 *   · every failure — no address, no token, no network, a timeout, a refusal, a redirect, a content
 *     type this route never sends, an unwritable cache — ends in the same place: the compaction
 *     proceeds untouched. **A crash must never be able to look like a decision.**
 *
 * ── WHAT IT RE-SERVES IS WHAT THE SERVER SERVES ([PROP-89-8] (a), memo 89-8) ──────────────────
 *
 * The block comes from the SAME route and the SAME assembler `SessionStart` reads, already inside
 * the FR-18/A4 budget when it arrives — the budget is applied server-side by `assembleContext`, and
 * an omission is announced there by `contextBudgetLine()` rather than trimmed silently here.
 *
 * **The seam with Story 8.5 is one sentence and it is deliberate: 8.9 re-serves what the SERVER
 * serves, 8.5 materialises that same state into `CLAUDE.md`. Both read one served truth and neither
 * reads the other.** There is no dependency between them in either direction, and the executable is
 * identical whichever merges first.
 *
 * ── [NON MESURÉ], AND SAID RATHER THAN ASSUMED ────────────────────────────────────────────────
 *
 * Whether `additionalContext` is HONOURED on `PreCompact` is the question the architecture has had
 * open since 2026-08-01, and this bench could not close it: answering it needs a real compaction in
 * a live session, and the CLI could not be authenticated on 2026-08-28 (*"OAuth session expired and
 * could not be refreshed"* — the wall is in the implementation report). What IS measured is that
 * the field is the documented generic channel (*"additionalContext — Text injected into model
 * context"*, with only the permission verdict and the modified-input field marked as restricted to
 * `PreToolUse`) and that unknown keys are dropped rather than fatal (*"Hook JSON output had
 * unrecognized keys (ignored)"*).
 *
 * So the hook emits it, and **nothing here depends on it being honoured**: the status line snapshot
 * is written to disk either way, and a compaction is followed by `SessionStart` with the `compact`
 * matcher — which 8.2's hook already answers by injecting the same block. The Rules survive a
 * compaction by two independent roads, and this file is the one the criterion names.
 */
import process from 'node:process';
import {
  gateIsNew,
  pluginDataDir,
  readGateMarker,
  writeGateMarker,
  writeSnapshot,
} from './lib/statusline-cache.mjs';

/** 8.2's route, REUSED. Pinned to `AGENT_CONTEXT_PATH` by a gate — never a second address. */
const AGENT_CONTEXT_PATH = '/api/agent/context';

/** 8.9's own route, and it serves state 8.2's does not. Pinned to `AGENT_STATUSLINE_PATH`. */
const AGENT_STATUSLINE_PATH = '/api/agent/statusline';

/**
 * Five seconds, and the hook's declared `timeout` is ten.
 *
 * The same figure `SessionStart` uses, for the same reason: this runs once per compaction, at a
 * moment when a person is already waiting, and letting go early is the safe direction — the
 * compaction then happens without the block rather than not at all. It is not 8.3's tighter two
 * seconds, because nothing is being held hostage here: `PreToolUse` sits in front of a write.
 */
const ABORT_MS = 5000;

/** Where the install's two values arrive. MEASURED by 8.2; a gate pins both to the contracts. */
const OPTION_URL = 'CLAUDE_PLUGIN_OPTION_GORIKI_URL';
const OPTION_PAT = 'CLAUDE_PLUGIN_OPTION_GORIKI_PAT';

/** The by-hand fallback, for a setup with no plugin at all. */
const FALLBACK_URL = 'GORIKI_URL';
const FALLBACK_PAT = 'GORIKI_PAT';

/**
 * WHAT A COMPACTED SESSION IS TOLD WHEN THE BLOCK COULD NOT BE FETCHED.
 *
 * The same shape as 8.2's degraded line and for the same reason: the session is about to lose the
 * context it had, and *"I could not refresh this"* is a materially different thing to be told than
 * silence. It never promises freshness and it never invents a value.
 */
const DEGRADED =
  'Goriki unreachable — the sealed Rules could not be re-served after this compaction · ' +
  'the block last written to CLAUDE.md still applies';

/**
 * THE GATE MARKER — AC-3, and the sentence is careful about what it is claiming.
 *
 * [PROP-89-6], tranched: **there is no programmatic checkpoint mechanism at CLI 2.1.246.** It was
 * looked for and the search is in the report — `claude --help` carries no `checkpoint` and no
 * `rewind` option, the plugin manifest has no such component, and `claude plugin validate` answers
 * *"Unknown field"* for every spelling tried. So the marker is **the agent's own gesture**, asked
 * for once, by the client package — never by the server (D84 intact).
 *
 * The wording asks and does not instruct a mechanism into existence. It is the client package
 * saying *"a Gate was crossed, put a marker here"*, which is what (b) is; the story does NOT call
 * it native, and neither does any document this package ships.
 */
function gateLine(gate) {
  return (
    `Goriki — Gate crossed: ${gate.phase} · ${gate.verdict}. ` +
    `Lay a named checkpoint for this point in the session, so it can be returned to: ` +
    `"return to the ${gate.phase} Gate state".`
  );
}

/**
 * The first of two environment names carrying a real value, or `null`. 8.2's function, whole.
 *
 * A blank variable and an absent one are ONE state. A value still wearing `${user_config.…}` is
 * refused: the client refuses to run a hook shaped that way at all, but a by-hand setup could
 * export the literal text, and posting it at a server as though it were a token is exactly what
 * this guard exists to prevent.
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
 * The deployment's origin, from the one address the install carries. 8.2's function, whole.
 *
 * Strict on purpose: an address this file does not recognise answers `null`, and the hook then does
 * nothing at all rather than posting a bearer token at a path nobody chose.
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

/** One request, every failure turned into `null`. Never throws, never follows a redirect. */
async function get(origin, token, path, accept) {
  try {
    const response = await fetch(`${origin}${path}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}`, accept },
      signal: AbortSignal.timeout(ABORT_MS),
      /*
       * NEVER follow a redirect. The origin is the ONE the install carries; a 3xx off it is not
       * this route answering, it is a captive portal or a proxy. `fetch` rejects under this
       * setting, which the `catch` turns into `null`, which degrades honestly.
       */
      redirect: 'error',
    });
    if (!response.ok) return null;
    /*
     * A `200` in a content type the route never sends is not the route's answer — 8.2's blocker
     * B-2, and the reason transfers whole. Reading a Wi-Fi sign-in page into a session's context
     * is the failure this check exists for.
     */
    const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
    if (!contentType.startsWith(accept)) return null;
    return accept === 'application/json' ? await response.json() : await response.text();
  } catch {
    return null;
  }
}

/**
 * Drain stdin without waiting on it — 8.1's stub learned this and every hook since keeps it.
 *
 * The client writes the event JSON there (`PreCompact` carries a `"manual"`/`"auto"` matcher —
 * measured from the client's own table). Nothing here READS it: this hook does the same thing on
 * both triggers, because a compaction loses the same context whoever asked for it.
 */
process.stdin.resume();
process.stdin.on('data', () => {});
process.stdin.on('error', () => {});

/**
 * THE ONE EXIT, AND ITS ARGUMENT IS `0`.
 *
 * Every branch above it returns a value. The `catch` is unreachable by construction and is here
 * because "unreachable" describes today's code: a compaction may never fail because of this file.
 */
async function main() {
  let context = DEGRADED;

  try {
    const mcpUrl = fromEnv(OPTION_URL, FALLBACK_URL);
    const token = fromEnv(OPTION_PAT, FALLBACK_PAT);
    const origin = mcpUrl === null ? null : agentPlaneOrigin(mcpUrl);

    if (origin !== null && token !== null) {
      const [block, snapshot] = await Promise.all([
        get(origin, token, AGENT_CONTEXT_PATH, 'text/plain'),
        get(origin, token, AGENT_STATUSLINE_PATH, 'application/json'),
      ]);

      if (typeof block === 'string' && block.trim() !== '') context = block;

      if (snapshot !== null && typeof snapshot === 'object') {
        const dataDir = pluginDataDir();
        /*
         * The snapshot is written whether or not the block arrived, and whether or not
         * `additionalContext` is honoured. It is the half of this hook that is measured to work.
         */
        writeSnapshot(dataDir, snapshot);

        // [PROP-89-7] (a): compare with what was already pointed at, and say it ONCE.
        const gate = snapshot.gate ?? null;
        if (gateIsNew(gate, readGateMarker(dataDir)) && writeGateMarker(dataDir, gate)) {
          /*
           * The marker line is appended only once the memory of it is SAFELY ON DISK. Writing it
           * into the context first and failing to record it would ask for the same marker again at
           * the next compaction — and a marker laid twice for one crossing is noise the product
           * does not make (D130, in spirit).
           */
          context = `${context}\n\n${gateLine(gate)}`;
        }
      }
    }
  } catch {
    context = DEGRADED;
  }

  /*
   * `hookSpecificOutput` and NOTHING ELSE. The three keys that could stop a compaction are absent
   * from this object by construction, and a gate asserts they are absent from this whole FILE —
   * which is why none of the three is named anywhere in it, comments included.
   */
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreCompact', additionalContext: context },
    })}\n`,
  );
  process.exit(0);
}

void main();
