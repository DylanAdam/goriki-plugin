/**
 * THE TERMINAL ENTRY — run by the builder's OWN agent (Story 8.8 · FR-43 · D116, D117, D125).
 *
 * ── D86 IS THE WHOLE ARCHITECTURE OF THIS FILE, AGAIN ──────────────────────────────────────────
 *
 * *"le jour où il détient une clé d'écriture sur le dépôt … il n'est plus l'arbitre, il est un
 * joueur."* This script writes NOTHING on this machine: no file, no directory, no cache. It asks a
 * bridge what to ask, hands the answers back, and prints what comes out. Every byte of method, of
 * copy and of computation is on the other side of that wire (D125 — the server engine stays the
 * only path to a generation).
 *
 *     node scripts/start-project.mjs --questions
 *     node scripts/start-project.mjs --idea "<what they want to build>" \
 *                                    --stakes toy|tool|product \
 *                                    --option <n> [--repo owner/name]
 *
 *   · `--questions` — what to ask, in the method's own words, and whether there is anything to fill;
 *   · the second form — the answers. It spends ONE generation and comes back with the map.
 *
 * ── IT NEVER FAILS THE WORK (D103) ─────────────────────────────────────────────────────────────
 *
 * It exits 0 in every case — no bridge, no token, no network, a refusal, nothing to do. A guardrail
 * that cannot run must never be a guardrail that stops the work. What it has to say, it says on
 * stdout, and the skill beside it tells the agent to read that out rather than act on an exit code.
 *
 * ── AND IT NEVER PRINTS THE TOKEN ──────────────────────────────────────────────────────────────
 *
 * Not on success, not in an error, not in `--json`. The project token is held by the client's own
 * plugin configuration; this script reads it through the one function that knows where that is
 * (`lib/plugin-config.mjs`, moved out of 8.5's script so there is one search and not two), sends it
 * in one header, and never writes it anywhere.
 *
 * ── THE WAIT IS REAL AND IT IS ANNOUNCED ───────────────────────────────────────────────────────
 *
 * A generation has been measured at 6.8 s – 11.9 s end to end, and the entry chains both of its
 * halves server-side ([PROP-88-11]), so this request is genuinely long. The waiting line is printed
 * BEFORE the call and it is the SERVER's sentence, fetched with the questions — a client that
 * invented its own estimate would be a second promise about somebody else's provider.
 */
import process from 'node:process';

import {
  envelopeMessage,
  parseEntryArgs,
  renderQuestions,
  submitBody,
  validateAnswerPayload,
  validateQuestionsPayload,
} from './lib/entry-client.mjs';
import { agentPlaneBase } from './lib/rules-block-client.mjs';
import { readPluginConfig } from './lib/plugin-config.mjs';

const ROUTE_PATH = '/api/agent/entry';

/**
 * TWO TIMEOUTS, because the two calls are not the same kind of call.
 *
 * Asking what to ask is a read and it is 8.5's five seconds. Submitting the answers runs a model on
 * the other end — measured at up to 11.9 s, and the entry chains the two halves of the pipeline —
 * so a five-second bound would abort the very thing this script exists to do. Ninety seconds is the
 * budget the generation surfaces already use, and going past it is a refusal to read, not a crash.
 */
const QUESTIONS_TIMEOUT_MS = 5000;
const SUBMIT_TIMEOUT_MS = 90000;

const say = [];
const record = (line) => say.push(line);

/** The three sentences that are about THIS SCRIPT rather than about the product. */
const UNCONFIGURED =
  'Goriki: no bridge address or project token is configured here, so nothing was started. Nothing ' +
  'else changed.';
const BAD_ADDRESS =
  'Goriki: the configured bridge address is not the shape this plugin expects, so no address was ' +
  'derived from it and nothing was started.';
const UNREACHABLE =
  'Goriki: the bridge could not be reached, so nothing was started. Nothing else changed.';

async function call(base, pat, path, init, timeoutMs) {
  try {
    return await fetch(`${base}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${pat}`, accept: 'application/json', ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    // D103, fail-open: unreachable is not a reason to stop somebody's work.
    return null;
  }
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function main() {
  const args = parseEntryArgs(process.argv.slice(2));
  const config = readPluginConfig();

  if (config.url === null || config.pat === null) {
    record(UNCONFIGURED);
    return { status: 'unconfigured' };
  }
  const base = agentPlaneBase(config.url);
  if (base === null) {
    record(BAD_ADDRESS);
    return { status: 'bad-address' };
  }

  if (args.mode === 'questions') {
    const response = await call(base, config.pat, ROUTE_PATH, { method: 'GET' }, QUESTIONS_TIMEOUT_MS);
    if (response === null) {
      record(UNREACHABLE);
      return { status: 'unreachable' };
    }
    const payload = await readJson(response);
    if (!response.ok) {
      // The server's own sentence, VERBATIM. A refusal re-worded here is a second refusal.
      record(envelopeMessage(payload) ?? `Goriki: the bridge answered ${response.status}.`);
      return { status: 'refused', http: response.status };
    }
    if (payload === undefined) {
      record('Goriki: the bridge answered 200 but not with JSON, so there is nothing to ask.');
      return { status: 'bad-response' };
    }
    const validity = validateQuestionsPayload(payload);
    if (!validity.ok) {
      record(
        `Goriki: the bridge answered 200 with a shape this script does not recognise ` +
          `(${validity.reason}), so there is nothing to ask.`,
      );
      return { status: 'bad-shape', reason: validity.reason };
    }
    if (payload.fillable === false) {
      record(payload.refusal);
      return { status: 'not-fillable' };
    }
    record(renderQuestions(payload));
    record(payload.waiting);
    return { status: 'ok', questions: payload.questions, waiting: payload.waiting };
  }

  const prepared = submitBody(args);
  if (!prepared.ok) {
    record(
      'Goriki: the answers are incomplete, so nothing was started and no generation was spent. A ' +
        'start needs --idea, --stakes and --option.',
    );
    return { status: 'incomplete', reason: prepared.reason };
  }

  const response = await call(
    base,
    config.pat,
    ROUTE_PATH,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(prepared.body),
    },
    SUBMIT_TIMEOUT_MS,
  );
  if (response === null) {
    record(UNREACHABLE);
    return { status: 'unreachable' };
  }
  const payload = await readJson(response);
  if (!response.ok) {
    record(envelopeMessage(payload) ?? `Goriki: the bridge answered ${response.status}.`);
    return { status: 'refused', http: response.status };
  }
  if (payload === undefined) {
    record('Goriki: the bridge answered 200 but not with JSON, so there is no map to print.');
    return { status: 'bad-response' };
  }
  const validity = validateAnswerPayload(payload);
  if (!validity.ok) {
    record(
      `Goriki: the bridge answered 200 with a shape this script does not recognise ` +
        `(${validity.reason}), so there is no map to print.`,
    );
    return { status: 'bad-shape', reason: validity.reason };
  }

  // The whole announcement — the computed line, the tree, the link, the relay when there is one,
  // and the sentence that makes it contestable — composed on the server and printed AS IT STANDS.
  record(payload.block);
  return { status: 'ok', kata: payload.kata, map_url: payload.map_url, project_id: payload.project_id };
}

function report(answer, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify({ ...answer, say }, null, 2)}\n`);
    return;
  }
  for (const line of say) process.stdout.write(`${line}\n`);
}

/*
 * BELT AND SUSPENDERS, the shape 8.5 arrived at after its blocker B-1.
 *
 * `main()` refuses an unrecognised shape before anything downstream trusts it, which is what closes
 * the class. This wrapper is the second layer the header promises: an exception from ANYWHERE —
 * this script's own defect included — still answers 0 and a line to read, rather than an unhandled
 * rejection past this file's one contract.
 */
try {
  const answer = await main();
  report(answer, process.argv.includes('--json'));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ status: 'internal-error', say: [...say] }, null, 2)}\n`);
  } else {
    for (const line of say) process.stdout.write(`${line}\n`);
    process.stdout.write(`Goriki: an unexpected error was caught, so nothing was started (${message}).\n`);
  }
}
// Always 0 — see the header. A refusal is something to READ, never a build that failed.
process.exit(0);
