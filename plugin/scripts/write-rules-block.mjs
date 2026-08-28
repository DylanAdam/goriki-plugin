/**
 * WRITE THE MANAGED RULES BLOCK — the scribe, run by the builder's OWN agent (Story 8.5 · FR-36).
 *
 * ── D86 IS THE WHOLE ARCHITECTURE OF THIS FILE ─────────────────────────────────────────────────
 *
 * *"le jour où il détient une clé d'écriture sur le dépôt … il n'est plus l'arbitre, il est un
 * joueur."* So the server holds no key and no repository API: it renders BYTES, and this script —
 * running on the builder's machine, on the builder's subscription, launched by the builder's agent
 * — is what puts them on a disk. Every byte written here is written by the person who owns the file.
 *
 *     node scripts/write-rules-block.mjs [--dir <path>] [--close] [--restore] [--json]
 *
 *   · no flag   — refresh the block from the register;
 *   · --close   — stop managing: the block closes with a dated line and everything in it STAYS;
 *   · --restore — the builder chose *restore* / *discard*: rewrite a block that was edited by hand.
 *                 It is the only flag under which an edit inside the fence is ever lost, and it is
 *                 never taken on this script's own judgement.
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
 * plugin configuration; this script reads it, sends it in one header, and never writes it anywhere.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

import {
  agentPlaneBase,
  bodyHash,
  decideClose,
  decideWrite,
  findFence,
  resolveRepoDir,
  validateAgentRulesBlockPayload,
} from './lib/rules-block-client.mjs';

const ROUTE_PATH = '/api/agent/rules-block';
const REQUEST_TIMEOUT_MS = 5000;

/**
 * THE FILES THIS SCRIPT MAY TOUCH — and the one it is allowed to CREATE ([PROP-85-7], memo 85-7).
 *
 * `CLAUDE.md` at the root of the repository is created, because it is the file every certified
 * client reads and the one the block exists for. The other two receive the block ONLY if they are
 * already there: making a `.cursor/rules/goriki.mdc` appear in a repository that has never seen
 * that editor is this product owning somebody's files, which is the exact thing the story refuses —
 * and it would be a multi-tool promise on a public surface, which D124 forbids at launch.
 *
 * `~/.claude/CLAUDE.md` and `CLAUDE.local.md` are NEVER touched, at any time: the first is global to
 * a machine and shared with every other project on it, the second is a personal overlay. The block
 * belongs to the REPOSITORY.
 */
const TARGETS = [
  { path: 'CLAUDE.md', create: true },
  { path: 'AGENTS.md', create: false },
  { path: join('.cursor', 'rules', 'goriki.mdc'), create: false },
];

/**
 * `args.dir` is `null` when `--dir` was never given, so the caller can tell "the flag chose this"
 * from "nothing chose this and a fallback did" — see `resolveDir` below (blocker B-2).
 */
function parseArgs(argv) {
  const args = { dir: null, close: false, restore: false, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--close') args.close = true;
    else if (flag === '--restore') args.restore = true;
    else if (flag === '--json') args.json = true;
    else if (flag === '--dir') {
      index += 1;
      args.dir = resolve(argv[index] ?? process.cwd());
    }
  }
  return args;
}

/**
 * THE REPOSITORY TO WRITE INTO — `--dir`, or `resolveRepoDir`'s own order (blocker B-2).
 *
 * `record()` is called ONLY on the last-resort `cwd` fallback: `--dir` and `CLAUDE_PROJECT_DIR` are
 * both an explicit, correct answer and stay silent; a bare `git`-root walk is the ordinary case for
 * a by-hand run with no plugin and stays silent too. Only the fallback that measurably wrote into
 * the wrong directory (annexe § A2) is worth a line in what the agent reads back.
 */
function resolveDir(args) {
  if (args.dir !== null) return args.dir;
  const resolved = resolveRepoDir({
    cwd: process.cwd(),
    env: process.env,
    existsSync,
    joinPath: join,
    dirname,
  });
  if (resolved.source === 'cwd') {
    record(
      'Goriki: neither CLAUDE_PROJECT_DIR nor a .git directory was found above the working ' +
        'directory, so the managed block was written relative to where this command ran rather ' +
        "than the repository's root.",
    );
  }
  return resolved.dir;
}

/**
 * THE TWO VALUES THE INSTALL CARRIES, found without either of them ever being typed by a person.
 *
 * The environment is asked FIRST and it is the documented route: `GORIKI_URL` and `GORIKI_PAT`. The
 * client's own configuration store is asked second, because `claude plugin install --config` writes
 * the two `userConfig` values there and asking the builder to re-type a token they already gave the
 * client would be a worse experience than this search.
 *
 * ── WHERE THE CLIENT PUTS THEM — MEASURED 2026-08-28, Claude Code 2.1.246, Windows 11 ───────────
 *
 * A real install with `--config goriki_url=… --config goriki_pat=…`, then the tree read back with
 * the values never printed. The two values are NOT in one place, and that is the whole point of the
 * `sensitive: true` flag the manifest declares on the token:
 *
 *     settings.json      pluginConfigs > goriki@goriki-plugin > options > goriki_url
 *     .credentials.json  pluginSecrets > goriki@goriki-plugin > goriki_pat
 *
 * The first draft of this function looked for ONE object carrying BOTH keys and would have found
 * nothing, forever, in silence. It is written down here rather than in a report because the next
 * client version may move them: whoever reads this next needs the shape that was measured, and the
 * date it was measured on.
 *
 * The search is BOUNDED, it reads only the client's own configuration directory, and it never
 * prints what it finds. If neither route answers, the script says what is missing and stops — it
 * does not guess an address, and it does not go looking for a credential anywhere else.
 */
function readConfig() {
  const fromEnv = {
    url: process.env.GORIKI_URL ?? null,
    pat: process.env.GORIKI_PAT ?? null,
  };
  if (fromEnv.url !== null && fromEnv.pat !== null) return { ...fromEnv, source: 'environment' };

  const root = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude');
  const candidates = [
    join(root, 'settings.json'),
    join(root, '.credentials.json'),
    join(root, 'plugins', 'config.json'),
    join(root, 'config.json'),
  ];
  let url = fromEnv.url;
  let pat = fromEnv.pat;
  for (const candidate of candidates) {
    if (url !== null && pat !== null) break;
    if (!existsSync(candidate)) continue;
    let document;
    try {
      document = JSON.parse(readFileSync(candidate, 'utf8'));
    } catch {
      continue;
    }
    url = url ?? searchConfig(document, 'goriki_url', 0);
    pat = pat ?? searchConfig(document, 'goriki_pat', 0);
  }
  return { url, pat, source: url === null || pat === null ? null : 'client configuration' };
}

/** The first value this document holds under that exact key. Depth-bounded, never printed. */
function searchConfig(node, key, depth) {
  if (depth > 6 || node === null || typeof node !== 'object') return null;
  if (typeof node[key] === 'string' && node[key].length > 0) return node[key];
  for (const value of Object.values(node)) {
    const found = searchConfig(value, key, depth + 1);
    if (found !== null) return found;
  }
  return null;
}

/** Today, as the closing line dates it. Local date, because the builder reads it in their own day. */
function today(now) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const say = [];
const record = (line) => say.push(line);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = readConfig();

  if (config.url === null || config.pat === null) {
    record(
      'Goriki: no bridge address or project token is configured here, so no managed block was ' +
        'written. Nothing else changed.',
    );
    return { status: 'unconfigured', results: [] };
  }

  const base = agentPlaneBase(config.url);
  if (base === null) {
    record(
      'Goriki: the configured bridge address is not the shape this plugin expects, so no address ' +
        'was derived from it and nothing was written.',
    );
    return { status: 'bad-address', results: [] };
  }

  let response;
  try {
    response = await fetch(`${base}${ROUTE_PATH}`, {
      headers: { authorization: `Bearer ${config.pat}`, accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    // D103, fail-open: unreachable is not a reason to stop somebody's work.
    record('Goriki: the bridge could not be reached, so no block was written. Nothing else changed.');
    return { status: 'unreachable', results: [] };
  }
  if (!response.ok) {
    record(
      `Goriki: the bridge answered ${response.status} and no block was written. Nothing else ` +
        'changed.',
    );
    return { status: 'refused', http: response.status, results: [] };
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    // A 200 that is not JSON is a DIFFERENT fact than "the bridge could not be reached" — reached,
    // and answered garbage. D103 still fail-opens it: no block was written.
    record('Goriki: the bridge answered 200 but not with JSON, so no block was written.');
    return { status: 'bad-response', results: [] };
  }

  /*
   * BLOCKER B-1 (corr. wave 11, manche 1). Everything past this point trusts `payload.fence.*` and
   * `payload.block` without asking again — the SAME shape `agentRulesBlockSchema` already made the
   * server prove before it answered. Checking it HERE, once, is what stopped a malformed 200 from
   * crashing this script (uncaught, past its own "exits 0 in every case") or writing the literal
   * string `"undefined"` into somebody's `CLAUDE.md` when `block` was missing (annexe § A1).
   */
  const validity = validateAgentRulesBlockPayload(payload);
  if (!validity.ok) {
    record(
      `Goriki: the bridge answered 200 with a shape this script does not recognise (${validity.reason}), ` +
        'so no block was written. Nothing else changed.',
    );
    return { status: 'bad-shape', reason: validity.reason, results: [] };
  }

  const dir = resolveDir(args);
  const results = [];
  for (const target of TARGETS) {
    const full = join(dir, target.path);
    const exists = existsSync(full);
    if (!exists && !target.create) continue;
    const before = exists ? readFileSync(full, 'utf8') : null;

    const decision = args.close
      ? decideClose({ fileText: before, payload, date: today(new Date()) })
      : decideWrite({ fileText: before, payload, restore: args.restore });

    if (decision.kind === 'write') {
      writeFileSync(full, decision.fileText, 'utf8');
      /*
       * THE ONE PROOF OF PROVENANCE THIS PRODUCT CAN HOLD ([PROP-85-5]).
       *
       * The file is re-read in the SAME execution. If what is on disk no longer hashes to what was
       * just written, the change happened inside this agent turn — provenance PROVEN, and that is
       * the CRITICAL path's own Given. Every other divergence is UNKNOWN and takes the calm path.
       */
      const justWritten = findFence(decision.fileText, payload.fence);
      const reread = findFence(readFileSync(full, 'utf8'), payload.fence);
      const drifted =
        justWritten.state === 'found' &&
        reread.state === 'found' &&
        reread.computedSha !== bodyHash(justWritten.body, payload.fence.sha_length);
      results.push(
        drifted
          ? {
              file: target.path,
              outcome: 'diverged',
              route: 'critical',
              provenance: 'agent-proven',
            }
          : {
              file: target.path,
              outcome: args.close ? 'closed' : decision.reason,
              rev: payload.rev,
              sha: args.close ? reread.declaredSha : payload.sha,
            },
      );
      continue;
    }

    if (decision.kind === 'refuse' && decision.reason === 'diverged') {
      results.push({
        file: target.path,
        outcome: 'diverged',
        route: decision.provenance === 'agent-proven' ? 'critical' : 'calm',
        provenance: decision.provenance,
      });
      continue;
    }

    results.push({ file: target.path, outcome: `${decision.kind}:${decision.reason}` });
  }

  return { status: 'ok', project: payload.project, rev: payload.rev, results };
}

/**
 * WHAT THE AGENT READS BACK. Plain lines, one per file, plus the question when there is one.
 *
 * The question itself is NOT asked here — a Node script has no way to ask one. It is HANDED to the
 * agent, which puts it to the builder at the terminal with the client's own two-step confirmation
 * (D128). The calm path carries two options; the CRITICAL path carries three and goes through
 * `goriki_ask`, which already exists (Story 5.4). This script writes no ask of its own.
 */
function report(answer, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify({ ...answer, say }, null, 2)}\n`);
    return;
  }
  for (const line of say) process.stdout.write(`${line}\n`);
  for (const result of answer.results ?? []) {
    if (result.outcome === 'diverged') {
      if (result.route === 'critical') {
        process.stdout.write(
          `Goriki: ${result.file} was edited inside the fence, by an agent, in this session. ` +
            'Nothing was overwritten. Hand this over with goriki_ask, CRITICAL, three options: ' +
            'adopt the edit as a sealed decision' +
            ' · discard it and rewrite the block' +
            ' · stop managing this file.\n',
        );
      } else {
        process.stdout.write(
          `Goriki: ${result.file} differs from what is sealed. Nothing was overwritten. Ask the ` +
            'builder, calmly, which of two things they want — ' +
            're-seal your edit, dated' +
            ' · restore the sealed block' +
            ' — and confirm before doing either.\n',
        );
      }
      continue;
    }
    process.stdout.write(`Goriki: ${result.file} — ${result.outcome}.\n`);
  }
  if ((answer.results ?? []).length === 0 && say.length === 0) {
    process.stdout.write('Goriki: nothing to write.\n');
  }
}

/*
 * BELT AND SUSPENDERS, BLOCKER B-1 (corr. wave 11, manche 1).
 *
 * `main()` no longer hands an unvalidated payload to code that assumes its shape, which is what
 * actually closes B-1's five repro cases. This wrapper is the SECOND layer the header already
 * promises: an exception from ANYWHERE in `main()` — this validator's own defect included — still
 * answers 0 and a line to read, rather than an unhandled rejection past this file's one contract.
 */
try {
  const answer = await main();
  report(answer, process.argv.includes('--json'));
} catch (error) {
  const json = process.argv.includes('--json');
  const message = error instanceof Error ? error.message : String(error);
  if (json) {
    process.stdout.write(`${JSON.stringify({ status: 'internal-error', say: [...say] }, null, 2)}\n`);
  } else {
    for (const line of say) process.stdout.write(`${line}\n`);
    process.stdout.write(`Goriki: an unexpected error was caught, so no block was written (${message}).\n`);
  }
}
// Always 0 — see the header. A refusal is something to READ, never a build that failed.
process.exit(0);
