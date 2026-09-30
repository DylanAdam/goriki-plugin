/**
 * THE PLUGIN'S HTTP CLIENT — one place, and NOTHING IT DOES EVER THROWS. Story 8.3 · D103.
 *
 * ── WHY IT IS BORN IN 8.3 AND NOT IN 8.2 (couture C-2, and the divergence is named) ────────────
 *
 * The brief expected Story 8.2 to have left a shared client in `plugin/hooks/lib/`, to be *"reused
 * as is — never a second client"*. It did not: 8.2 wrote its one `fetch` inline in
 * `session-start.mjs`, which was the right call for a hook that makes a single call and needs no
 * queue. So this file is written where the brief said it would be, by the story that needed it
 * second, and 8.2's inline call is deliberately NOT refactored into it — that would be this story
 * editing a neighbour's hook in the same wave, for a tidiness nobody asked for. **The divergence is
 * consigned in the implementation report.** `agentPlaneOrigin` below is 8.2's function, copied with
 * its argument intact; the two are compared by a gate rather than trusted to agree.
 *
 * ── AND THE WHOLE CONTRACT OF THIS FILE IS THAT A FAILURE IS AN ANSWER ────────────────────────
 *
 * Every function answers a discriminated result and none of them throws. That is not defensive
 * style, it is AC-4 in a file: *"telemetry NEVER conditions the refusal … a hook that cannot reach
 * Goriki denies nothing"*. An exception escaping to the hook would become an unhandled rejection, a
 * non-zero exit and — on `PreToolUse`, where exit code 2 is the BLOCKING code — a refusal this
 * product never decided. A crash must never be able to look like a guardrail.
 */
import process from 'node:process';

/** The freeze family's three addresses. `AGENT_FREEZE_PATH` and its two children, in the API. */
const FREEZE_PATH = '/api/agent/freeze';
const GAPS_PATH = '/api/agent/freeze/gaps';
const CONTEST_PATH = '/api/agent/freeze/contest';
/**
 * The session family's ONE address — `AGENT_STOP_PATH` in the API. Story 8.4, 2026-09-05.
 *
 * Exported, unlike the three above, because a gate compares it to the API's own constant: this
 * string is typed in two files that can never import each other, and its drift would be a hook
 * posting a bearer token at a path nobody serves.
 */
export const STOP_PATH = '/api/agent/session/stop';

/**
 * TWO SECONDS, and the hook's declared `timeout` is ten.
 *
 * 8.2 lets go at five for a call that happens once per session, at a moment when a person is already
 * waiting for a session to open. This one happens BEFORE A WRITE, possibly many times in a minute,
 * with an agent mid-task on the other side — so it is tighter.
 *
 * [NON MESURÉ] on this bench, corrected 2026-08-28 (B-83-4): this comment used to claim the smoke
 * measured this bench's own round trip against 2000 ms. It did not — no round trip was measured
 * here: annexe A3 measures a SPAWN cost, not a network latency, and the implementation report §12.5
 * justifies 2000 ms by an argument (below), not by a figure taken off this bench. The argument: the
 * hook's own declared `timeout` is 10,000 ms and this call has to leave room, before it, for the
 * process's own startup and for one retry-free request — so it is set well under half of it, and
 * tightened relative to 8.2's five seconds for the reason stated above. The smoke role re-verifies
 * an actual round trip on this machine (regime RE-VERIFY, D107) and the report states the figure.
 *
 * Letting go EARLY is the safe direction here and only here: the timeout answers `timeout`, which
 * lets the write through. A client that waited longer to be sure would be holding a write hostage
 * to a network, which is the shape D103 names.
 */
const ABORT_MS = 2000;

/**
 * WHERE THE INSTALL'S TWO VALUES ARRIVE — MEASURED by Story 8.2 (Claude Code 2.1.246, 2026-08-28).
 *
 * `${user_config.*}` in a hook's `command` is REFUSED by the client outright, and the client named
 * the alternative itself: each `userConfig` key is exported to a hook's environment as
 * `CLAUDE_PLUGIN_OPTION_<KEY>`, the key upper-cased. So the token is never on a process command
 * line — the one cost [PROP-82-2] asked to have named does not exist on this road.
 *
 * `pluginOptionEnvVar()` in the contracts is that rule written once for the repository, and a gate
 * compares these literals to it. Every later hook takes the same road rather than discovering it
 * again — this is 8.3 taking it.
 */
const OPTION_URL = 'CLAUDE_PLUGIN_OPTION_GORIKI_URL';
const OPTION_PAT = 'CLAUDE_PLUGIN_OPTION_GORIKI_PAT';

/** The by-hand fallback, for a setup with no plugin at all. `MCP_TOKEN_ENV_VAR` is the second. */
const FALLBACK_URL = 'GORIKI_URL';
const FALLBACK_PAT = 'GORIKI_PAT';

/**
 * The first of two environment names that carries a real value, or `null`. 8.2's function.
 *
 * A blank variable and an absent one are ONE state. A value still wearing `${user_config.…}` is
 * refused too: the client refuses to run a hook shaped that way at all, but a by-hand setup could
 * export the literal text, and posting it at a server as though it were a token is the one thing
 * this function exists to prevent.
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
 * The deployment's origin, from the one address the install carries. Story 8.2's function, whole.
 *
 * `goriki_url` ends in `/mcp` — the manifest says so — and this is that rule's literal inverse. It
 * is strict on purpose: an address this file does not recognise answers `null`, and the freeze then
 * fails open rather than a bearer token being posted at a path nobody chose.
 */
export function agentPlaneOrigin(mcpUrl) {
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

/** The address and the token this install carries, or `null` for either. Never printed, never stored. */
export function credentials() {
  const url = fromEnv(OPTION_URL, FALLBACK_URL);
  return {
    origin: url === null ? null : agentPlaneOrigin(url),
    token: fromEnv(OPTION_PAT, FALLBACK_PAT),
  };
}

/**
 * WHY A CALL DID NOT ANSWER — the four causes D103 names, and there is no fifth.
 *
 * They are read off the STATUS rather than off a body, because a body is the one part of an answer a
 * captive portal also gets to write:
 *
 *   · `401`/`403` → `unauthorized`. The PAT was revoked, or was never one. `requirePat` answers ONE
 *     401 for five different causes on purpose (it will not tell a guesser which guess was once a
 *     real token), and this side does not need to know either — the builder's sentence is the same;
 *   · `402` → `expired`. Payment required is the plan lapsing, which D93 makes real from day one;
 *   · a timeout → `timeout`;
 *   · anything else, including a 5xx, a redirect refused, a content type this route never sends, a
 *     body that will not parse, and no network at all → `unreachable`. They are one state from where
 *     a builder stands: this product could not be asked.
 */
function reasonFor(status) {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 402) return 'expired';
  return 'unreachable';
}

/** One request, with every failure turned into an answer. The only `fetch` in this plugin's freeze. */
async function call(origin, token, path, init) {
  let response;
  try {
    response = await fetch(`${origin}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, accept: 'application/json', ...init.headers },
      signal: AbortSignal.timeout(ABORT_MS),
      /*
       * NEVER follow a redirect — 8.2's blocker B-2, and the reason transfers whole. The origin is
       * the ONE the install carries; a 3xx off it is not this route answering, it is a captive
       * portal, a corporate proxy or a load balancer's error page. `fetch` rejects under this
       * setting, which the `catch` turns into `unreachable`, which lets the write through.
       */
      redirect: 'error',
    });
  } catch (error) {
    // `TimeoutError` is what `AbortSignal.timeout` raises. Distinguished because the builder's
    // sentence differs: a slow bench is not a bench that is down.
    const timedOut = error !== null && typeof error === 'object' && error.name === 'TimeoutError';
    return { ok: false, reason: timedOut ? 'timeout' : 'unreachable' };
  }

  if (!response.ok) return { ok: false, reason: reasonFor(response.status) };

  /*
   * A `200` in a content type this route never sends is not this route's answer — 8.2's other half
   * of blocker B-2. `agent-freeze.ts` always states `application/json`; anything else is whatever
   * sits on this origin's path today, and reading a zone list out of it would be letting a Wi-Fi
   * sign-in page decide what is frozen.
   */
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  if (!contentType.startsWith('application/json')) return { ok: false, reason: 'unreachable' };

  try {
    return { ok: true, body: await response.json() };
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
}

/**
 * THE ZONES — the hook's cache refresh AND its confirmation before a refusal, one call.
 *
 * A body that is not the shape this plugin expects answers `unreachable` rather than an empty list:
 * *"no zones"* and *"an answer I could not read"* are different facts, and only the second may not
 * be read as *"nothing is frozen for ever"*. Both let the write through; only one of them is worth
 * caching, and this is how the caller tells them apart.
 */
export async function fetchZones(origin, token) {
  const answer = await call(origin, token, FREEZE_PATH, { method: 'GET' });
  if (!answer.ok) return answer;
  const zones = answer.body?.frozen_zones;
  if (!Array.isArray(zones)) return { ok: false, reason: 'unreachable' };
  return { ok: true, zones };
}

/**
 * THE HOLES, POSTED ON RETURN — AC-4, and a failure here is silent BY DESIGN.
 *
 * The queue is not cleared unless this answers `true`, so a gap survives being unpostable and goes
 * out on the next successful call. What it must never do is turn a failed journal into a visible
 * problem: the write it concerns already happened, correctly, and a hook that complained about its
 * own bookkeeping in the middle of somebody's work would be noise about a thing they cannot fix.
 */
export async function postGaps(origin, token, gaps) {
  const answer = await call(origin, token, GAPS_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ gaps }),
  });
  return answer.ok === true;
}

/**
 * THE CONTESTATION — `/goriki:contest GRK-n`, and it files one entry and nothing else.
 *
 * It answers the route's own body so the command can say what happened, INCLUDING when the register
 * already held one: *"already filed"* is a truthful answer and reporting a second success would
 * teach a builder to distrust the count.
 */
export async function postContest(origin, token, reference) {
  return call(origin, token, CONTEST_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reference }),
  });
}

/**
 * THE STOP COUNTER, ASKED — Story 8.4, 2026-09-05. One question, at the end of a session.
 *
 * **No body, and no session id.** The endpoint's own header says why: *"The hook sends nothing but
 * its bearer. No session id, no body, no project"* — the PAT names one Project (D40) and the server
 * resolves *the open Session of this PAT* itself. An id an agent never has to hold is an id an agent
 * cannot get wrong, and carrying one would need the state D71 says a hook does not have.
 *
 * `ABORT_MS` is reused rather than given a budget of its own ([PROP-84-10] (a), memo 84-10): one
 * constant for the whole plugin, and if a measurement ever shows two seconds is not enough for this
 * call the new number comes from that measurement, never from an argument.
 *
 * ── AND A 503 IS AN `unreachable`, WHICH MEANS THE SESSION CLOSES ─────────────────────────────
 *
 * `agent_session_unavailable` is the named 503 the endpoint answers when the Session is open in the
 * log and its operational row is not — and `reasonFor` folds it, with every other 5xx, into
 * `unreachable`. The hook then writes nothing and the session ends. That is D103 read at the
 * CLOSING of a session rather than at a write: a hook that could not be answered holds nobody. The
 * sixty-minute sweep still owns the floor and gives that session its terminal.
 */
export async function postStopBlock(origin, token) {
  return call(origin, token, STOP_PATH, { method: 'POST' });
}
