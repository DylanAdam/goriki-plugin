/**
 * THE GUIDED PHASE DIALOGUE — run by the builder's OWN agent (Story 8.12 · FR-10 · D118, D125,
 * D126, D127, D129, D131, D135).
 *
 * ── D86 IS THE WHOLE ARCHITECTURE OF THIS FILE, AGAIN ──────────────────────────────────────────
 *
 * *"le jour où il détient une clé d'écriture sur le dépôt … il n'est plus l'arbitre, il est un
 * joueur."* This script writes NOTHING on this machine: no file, no directory, no cache. It asks a
 * bridge what to ask, hands the answers back, and prints what comes out. Every byte of method, of
 * copy and of computation is on the other side of that wire (D125 — the server engine stays the only
 * path to a document).
 *
 *     node scripts/phase-dialogue.mjs --questions
 *     node scripts/phase-dialogue.mjs --answer <id>=<what they said> [--answer …] [--skip <id> …]
 *     node scripts/phase-dialogue.mjs --skip-all
 *     node scripts/phase-dialogue.mjs --moves
 *
 *   · `--questions` — what to ask in the phase this project is IN, in the method's own order;
 *   · the second form — the answers and the skips. It spends ONE generation and comes back with the
 *     document;
 *   · `--skip-all` — the whole phase skipped at once. NOT a detected mode: the same gesture of
 *     skipping, reached explicitly, for the session where the questions could not be put at all.
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
 * (`lib/plugin-config.mjs`, shared with 8.5 and 8.8 so there is one search and not three), sends it
 * in one header, and never writes it anywhere.
 *
 * ── THE WAIT IS REAL AND IT IS ANNOUNCED ───────────────────────────────────────────────────────
 *
 * The submit runs a model on the other end — the same pipeline the web draft runs, measured at
 * 6.8 s – 11.9 s — so its bound is the generation surfaces' ninety seconds and not the five that a
 * read gets. The waiting line is the SERVER's sentence, fetched with the questions, because a client
 * that invented its own estimate would be a second promise about somebody else's provider.
 */
import { randomUUID } from 'node:crypto';
import process from 'node:process';

import {
  parsePhaseArgs,
  phaseEnvelopeMessage,
  phaseSubmitBody,
  renderPhaseMoves,
  renderPhaseQuestions,
  validatePhaseAnswerPayload,
  validatePhasePayload,
  FALLBACK_SAID,
} from './lib/phase-client.mjs';
import { agentPlaneBase } from './lib/rules-block-client.mjs';
import { readPluginConfig } from './lib/plugin-config.mjs';

const ROUTE_PATH = '/api/agent/phase';

/**
 * TWO TIMEOUTS, because the two calls are not the same kind of call.
 *
 * Asking what to ask is a read and it is 8.5's five seconds. Submitting runs a model on the other
 * end, so a five-second bound would abort the very thing this script exists to do. Ninety seconds is
 * the budget the generation surfaces already use, and going past it is a refusal to read, not a
 * crash.
 */
const QUESTIONS_TIMEOUT_MS = 5000;
const SUBMIT_TIMEOUT_MS = 90000;

const say = [];
const record = (line) => say.push(line);

/** The three sentences that are about THIS SCRIPT rather than about the product. */
const UNCONFIGURED =
  'Goriki: no bridge address or project token is configured here, so no questions were asked. ' +
  'Nothing else changed.';
const BAD_ADDRESS =
  'Goriki: the configured bridge address is not the shape this plugin expects, so no address was ' +
  'derived from it and no questions were asked.';
const UNREACHABLE =
  'Goriki: the bridge could not be reached, so no questions were asked. Nothing else changed.';

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
  const args = parsePhaseArgs(process.argv.slice(2));
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

  if (args.mode === 'questions' || args.mode === 'moves') {
    const response = await call(base, config.pat, ROUTE_PATH, { method: 'GET' }, QUESTIONS_TIMEOUT_MS);
    if (response === null) {
      record(UNREACHABLE);
      return { status: 'unreachable' };
    }
    const payload = await readJson(response);
    if (!response.ok) {
      // The server's own sentence, VERBATIM. A refusal re-worded here is a second refusal.
      record(phaseEnvelopeMessage(payload) ?? `Goriki: the bridge answered ${response.status}.`);
      return { status: 'refused', http: response.status };
    }
    if (payload === undefined) {
      record('Goriki: the bridge answered 200 but not with JSON, so there is nothing to ask.');
      return { status: 'bad-response' };
    }
    const validity = validatePhasePayload(payload);
    if (!validity.ok) {
      record(
        `Goriki: the bridge answered 200 with a shape this script does not recognise ` +
          `(${validity.reason}), so there is nothing to ask.`,
      );
      return { status: 'bad-shape', reason: validity.reason };
    }
    if (args.mode === 'moves') {
      // The menu ALONE. No questions, no waiting line: this call happens after the document exists.
      record(renderPhaseMoves(payload));
      return { status: 'ok', moves: payload.moves.length };
    }
    record(renderPhaseQuestions(payload));
    record(payload.waiting);
    return { status: 'ok', ask: payload.ask.length, carried: payload.carried.length };
  }

  /*
   * The idempotence token is minted HERE, at the edge, and handed to the pure half — which has no
   * clock and no randomness, and could therefore not mint one and stay testable. One press writes
   * one document, however many times a flaky terminal retries the request.
   */
  const prepared = phaseSubmitBody(args, randomUUID());
  if (!prepared.ok) {
    record(
      'Goriki: there is nothing to record, so no document was written and no generation was ' +
        'spent. Pass --answer <question>=<what they said>, --skip <question>, or --skip-all.',
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
    record(phaseEnvelopeMessage(payload) ?? `Goriki: the bridge answered ${response.status}.`);
    return { status: 'refused', http: response.status };
  }
  if (payload === undefined) {
    record('Goriki: the bridge answered 200 but not with JSON, so there is no document to name.');
    return { status: 'bad-response' };
  }
  const validity = validatePhaseAnswerPayload(payload);
  if (!validity.ok) {
    record(
      `Goriki: the bridge answered 200 with a shape this script does not recognise ` +
        `(${validity.reason}), so there is no document to name.`,
    );
    return { status: 'bad-shape', reason: validity.reason };
  }

  /*
   * THE FALLBACK IS SAID NOW, RIGHT BEFORE THE DOCUMENT IT DESCRIBES — quick-fix, round 4.
   *
   * It used to be said BEFORE the request went out, on the theory that the gesture had already
   * happened by the time the network call could fail. Measured on the bench against a project at
   * its generation cap: the terminal printed *"every one of them is being skipped … the draft marks
   * each as a guess"* and then, on the SAME exchange, *"10 of 10 used today."* — nothing had been
   * skipped, nothing had been drafted, and the fallback sentence had already promised both. Saying
   * it here, only once a 200 with the expected shape has actually arrived, means it is never printed
   * over an exchange that produced no document — the same rule the block below is already held to.
   */
  if (prepared.skipAll) record(FALLBACK_SAID);
  // The whole announcement — the document, what it still guesses, and where to read it — composed on
  // the server and printed AS IT STANDS.
  record(payload.block);
  return { status: 'ok', hypotheses: payload.hypotheses, recorded: payload.recorded };
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
 * the class. This wrapper is the second layer the header promises: an exception from ANYWHERE — this
 * script's own defect included — still answers 0 and a line to read, rather than an unhandled
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
    process.stdout.write(
      `Goriki: an unexpected error was caught, so nothing was written (${message}).\n`,
    );
  }
}
// Always 0 — see the header. A refusal is something to READ, never a build that failed.
process.exit(0);
