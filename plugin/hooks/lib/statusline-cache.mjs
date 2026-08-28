/**
 * THE STATUS LINE'S CACHE — the only thing that stands between a served fact and a terminal row.
 * Story 8.9 · D119, D131, D103, D84-D86.
 *
 * ── WHY THERE IS A CACHE AT ALL ([PROP-89-2], tranched (b)+(c)) ────────────────────────────────
 *
 * A status line command is re-run by the client on every render. Three roads were open and two are
 * closed by measurement:
 *
 *   · a network call per render — a round trip per terminal frame, a bearer token on every one of
 *     them, and a line that flickers whenever a server is slow. Refused;
 *   · stdin alone — the client hands the script a session payload (`session_id`, `cwd`,
 *     `workspace`, `model`, `version`), and none of it is Goriki state. It is the KEY, not the data;
 *   · **a served snapshot, written by a hook, read by the script.** The hook already has the
 *     address, the token and an answer; the script then has no source of truth other than a file
 *     the server filled. *"From served data, never computed client-side"* stops being a promise and
 *     becomes a property of the shape: **there is nothing here to compute with.**
 *
 * ── AND THE DATE TRAVELS WITH THE DATA, WHICH IS THE WHOLE POINT ──────────────────────────────
 *
 * The snapshot carries `served_at`. A cache read without its date is the defect this file exists to
 * avoid: a two-hour-old count shown as though it were now, under someone's eyes all day, acted on.
 * `renderLine` therefore refuses to render an old snapshot — it says so instead. 8.2 wrote the same
 * refusal one hook over as *"never promises freshness"*.
 *
 * ── NOTHING IN HERE THROWS, AND NOTHING IN HERE IS A SECRET ───────────────────────────────────
 *
 * Every function answers a value or a null. A status line that raised would print a stack trace
 * into a status bar on every render — the single worst failure surface in the product, because it
 * is the one a person cannot dismiss and cannot ignore.
 *
 * **The PAT is never written here.** The snapshot is served state and nothing else: a phase label,
 * a count, a decision reference, a glob, a crossing, a timestamp. The hook holds the token in a
 * header and drops it; this file never sees one.
 *
 * ── IT IS PLAIN `.mjs` WITH NO DEPENDENCIES, ON PURPOSE (83-8) ────────────────────────────────
 *
 * `plugin/` is DATA — copied onto a user's disk verbatim, with no `node_modules` beside it — so
 * nothing here may `import` from `@goriki/shared`. The rendering rules are therefore SPELLED OUT
 * twice: once in `packages/shared/src/contracts/statusline.ts`, once here. They are not trusted to
 * agree: `statusline-cache.test.ts` imports both and compares them case by case.
 */
import process from 'node:process';
import { join, dirname, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';

/** The plugin's own name. Pinned to `PLUGIN_NAME` (`@goriki/shared/contracts`) by a gate. */
const PLUGIN_NAME = 'goriki';

/**
 * The marketplace it installs through. Pinned to `PLUGIN_MARKETPLACE_NAME` by the same gate.
 *
 * Duplicated rather than imported, for the reason `PLUGIN_NAME` already is (83-8): this file ships
 * as DATA, with no `node_modules` beside it on a user's disk, so it cannot `import` from
 * `@goriki/shared`. See `pluginDataDir` for why this second constant exists at all — it is not
 * decoration, it is half of the folder name a corrected measurement proved this file needed.
 */
const PLUGIN_MARKETPLACE_NAME = 'goriki-plugin';

/** The snapshot's filename inside the data directory. One file, one purpose. */
export const SNAPSHOT_FILE = 'statusline.json';

/** What the client package has already told an agent about. See `markGate`. */
export const GATE_MARKER_FILE = 'gate-marker.json';

/** The grammar, spelled here and compared to the contract's copies by a gate. */
export const SEPARATOR = ' · ';
export const BRAND = 'Goriki';
export const NOT_SERVED = `${BRAND}${SEPARATOR}state not served`;
export const FROZEN_PREFIX = 'frozen: ';
export const GLOB_MAX = 24;
export const ELLIPSIS = '…';
export const STALE_AFTER_MS = 15 * 60 * 1000;

/**
 * THE CLIENT'S CONFIGURATION DIRECTORY, DERIVED FROM WHERE THIS FILE IS INSTALLED.
 *
 * An installed plugin lives at `<config>/plugins/cache/<marketplace>/<plugin>/<version>/…`, so a
 * file inside it can find `<config>` by walking up to the directory that CONTAINS `plugins`. That
 * is what this does, and it answers `null` when it is not installed — running from a checkout, for
 * instance, which is the only other place these files ever are.
 *
 * ── WHY IT IS DERIVED AND NOT GUESSED FROM A HOME DIRECTORY ────────────────────────────────────
 *
 * Reading a home directory would be a GUESS, and a wrong one for anybody who has moved their
 * configuration with `CLAUDE_CONFIG_DIR`: the guess would point at a folder that does not hold this
 * install, the status line would read `NOT_SERVED` for ever, and nothing would say why. Walking up
 * from this file cannot be wrong about which installation it belongs to, because it IS that
 * installation. The shipped-file guard forbids a home-relative path for the same family of reasons,
 * and it is right to — this answer is strictly better than the one it refuses.
 */
export function claudeConfigDir(fromUrl = import.meta.url) {
  try {
    let dir = dirname(fileURLToPath(fromUrl));
    const { root } = parse(dir);
    while (dir !== root) {
      const parent = dirname(dir);
      // `<config>/plugins/<...>` — the directory whose child we came up through is `plugins`.
      if (dir.split(/[\\/]/).at(-1) === 'plugins') return parent;
      if (parent === dir) break;
      dir = parent;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * WHERE THE SNAPSHOT LIVES — and the two ends of this cache have to agree on it exactly.
 *
 * MEASURED (Claude Code 2.1.246, 2026-08-28), and it is the fact that shaped this whole file:
 *
 *     "${CLAUDE_PLUGIN_DATA} is plugin-only" · "This variable is only available in hooks defined in
 *     a plugin's hooks/hooks.json file, not in settings.json."
 *
 * The HOOK runs from `hooks/hooks.json` and gets the substitution. **The STATUS LINE does not** —
 * it is configured in `settings.json`, where neither `${CLAUDE_PLUGIN_DATA}` nor
 * `${CLAUDE_PLUGIN_ROOT}` resolves at all. So one end is handed the directory and the other has to
 * arrive at the same string by itself, or the line reads `NOT_SERVED` for ever while a perfectly
 * good snapshot sits on the disk.
 *
 * Three roads in, in order: the environment variable when the client set it; the layout derived
 * from this file's own install location; and — for the status line specifically — the directory
 * written into the pasted configuration as an ARGUMENT by `scripts/statusline-offer.mjs`, which
 * resolves it here and prints what it found. `null` when none of them answers, which the callers
 * turn into silence rather than into a guess.
 *
 * ── THE LEAF FOLDER'S NAME — CORRECTED 2026-08-28, AGAINST A MEASUREMENT AND NOT A GUESS ─────────
 *
 * This used to end the path at `PLUGIN_NAME` alone, on the strength of a claim `plugin.ts` printed
 * without ever running a real install: *"`{id}` is this name normalised."* MEASURED on this bench,
 * with no session and no authentication required — listing the CLI config's own `plugins`, `data`
 * directory against 25 real installs — refutes it: every one of the 25 directories is
 * `<plugin>-<marketplace>`, INCLUDING the
 * one entry where plugin and marketplace share a name and the concatenation still happens
 * (`claude-video-vision-claude-video-vision`). The keys of `installed_plugins.json` are
 * `<plugin>@<marketplace>`; the folder name is that same string with `@` replaced by `-`
 * (`_raw-claude-code.md:696-698`'s own normalisation rule, applied to the WHOLE id rather than to
 * `PLUGIN_NAME` in isolation). For this plugin that is `goriki-goriki-plugin`, not `goriki` — the
 * bug this correction closes made every derived path point at a directory nothing ever wrote to.
 *
 * **[NON MESURÉ] on this bench**: that the derived path equals the real `CLAUDE_PLUGIN_DATA` on a
 * live install of THIS plugin specifically. Reading that variable needs a running session and the
 * CLI could not be authenticated on 2026-08-28 (the auth wall is in the implementation report). The
 * CONVENTION above is measured across 25 unrelated installs; the offer script PRINTS the path it
 * resolved from it, so a person sees the answer rather than trusting this comment.
 */
export function pluginDataDir(env = process.env, fromUrl = import.meta.url) {
  const given = typeof env.CLAUDE_PLUGIN_DATA === 'string' ? env.CLAUDE_PLUGIN_DATA.trim() : '';
  if (given !== '') return given;
  const config = claudeConfigDir(fromUrl);
  return config === null
    ? null
    : join(config, 'plugins', 'data', `${PLUGIN_NAME}-${PLUGIN_MARKETPLACE_NAME}`);
}

/** The snapshot's full path, from a directory. One composer, both ends. */
export function snapshotPath(dataDir) {
  return join(dataDir, SNAPSHOT_FILE);
}

/** The marker's full path. Beside the snapshot, and deliberately NOT inside it — see `markGate`. */
export function gateMarkerPath(dataDir) {
  return join(dataDir, GATE_MARKER_FILE);
}

/**
 * THE SHAPE, CHECKED BEFORE ANYTHING IS BELIEVED — and an unknown key is a refusal.
 *
 * The file being validated sits on a user's disk and is read on every render. It could have been
 * hand-edited, half-written by a killed process, or left behind by an older version of this plugin.
 * A reader that trusted its shape would put `undefined` in somebody's status bar.
 *
 * Returns the snapshot or `null`. It never throws and it never repairs: a snapshot that is not the
 * shape this version writes is treated as absent, which degrades to the honest line.
 */
export function parseSnapshot(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;

  const { phase, pending_decisions: pending, frozen, gate, served_at: servedAt } = value;

  if (!(phase === null || (typeof phase === 'string' && phase !== ''))) return null;
  if (typeof pending !== 'number' || !Number.isInteger(pending) || pending < 0) return null;
  if (typeof servedAt !== 'string' || servedAt === '') return null;

  let frozenOut = null;
  if (frozen !== null && frozen !== undefined) {
    if (typeof frozen !== 'object' || Array.isArray(frozen)) return null;
    /*
     * BOTH halves are optional, and that is what makes the fallback reachable ([PROP-89-4]).
     * The edge always has an ordinal and so always serves a reference; requiring one here would
     * mean the *"first glob in reserve"* branch could never run, and a branch that cannot run is
     * not a fallback. A zone carrying NEITHER is refused — there would be nothing true to print.
     */
    const reference = frozen.reference;
    const glob = frozen.glob;
    const hasReference = typeof reference === 'string' && reference !== '';
    const hasGlob = typeof glob === 'string' && glob !== '';
    if (!hasReference && !hasGlob) return null;
    if (reference !== null && reference !== undefined && typeof reference !== 'string') return null;
    if (glob !== null && glob !== undefined && typeof glob !== 'string') return null;
    frozenOut = { reference: hasReference ? reference : null, glob: hasGlob ? glob : null };
  }

  let gateOut = null;
  if (gate !== null && gate !== undefined) {
    if (typeof gate !== 'object' || Array.isArray(gate)) return null;
    const { gate_id: gateId, phase: gatePhase, verdict } = gate;
    if (typeof gateId !== 'string' || gateId === '') return null;
    if (typeof gatePhase !== 'string' || gatePhase === '') return null;
    if (typeof verdict !== 'string' || verdict === '') return null;
    gateOut = { gate_id: gateId, phase: gatePhase, verdict };
  }

  return {
    phase: phase ?? null,
    pending_decisions: pending,
    frozen: frozenOut,
    gate: gateOut,
    served_at: servedAt,
  };
}

/**
 * READ IT. Answers the snapshot or `null`, and there is no third outcome and no exception.
 *
 * Every failure is one answer: no directory, no file, no permission, bytes that are not UTF-8, JSON
 * that will not parse, a shape from another version. All of them mean *"nothing served that I can
 * trust"*, and the caller has exactly one thing to do about it.
 */
export function readSnapshot(dataDir) {
  if (typeof dataDir !== 'string' || dataDir === '') return null;
  try {
    return parseSnapshot(JSON.parse(readFileSync(snapshotPath(dataDir), 'utf8')));
  } catch {
    return null;
  }
}

/**
 * WRITE IT, AND A READER NEVER SEES HALF OF IT — write-then-rename, which is the whole technique.
 *
 * The status line reads this file constantly and the hook rewrites it under them. A plain
 * `writeFileSync` truncates first, so there is a real window in which a render reads an empty or
 * half-filled file. `rename` over a same-directory temporary is atomic on both platforms this
 * product runs on: a reader sees the old bytes or the new ones, never a seam.
 *
 * The temporary carries the PID so two hooks in two sessions cannot collide on it, and it is swept
 * on failure so a crashed write leaves no litter in a user's plugin data.
 *
 * Answers `true`/`false` and never throws. A cache that could not be written is not an incident —
 * the line degrades to the honest one, and the compaction it was riding on carries on regardless.
 */
export function writeSnapshot(dataDir, snapshot) {
  if (typeof dataDir !== 'string' || dataDir === '') return false;
  const target = snapshotPath(dataDir);
  const temporary = `${target}.${process.pid}.tmp`;
  try {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(temporary, `${JSON.stringify(snapshot)}\n`, 'utf8');
    renameSync(temporary, target);
    return true;
  } catch {
    try {
      rmSync(temporary, { force: true });
    } catch {
      /* The sweep is best-effort by definition — it runs on the path where writing already failed. */
    }
    return false;
  }
}

/** `3 decisions pending`, and `1 decision pending`. The contract's function, spelled again. */
export function pendingClause(count) {
  return `${count} ${count === 1 ? 'decision' : 'decisions'} pending`;
}

/**
 * The frozen segment or `null` — [PROP-89-4] (b) with (a) behind it.
 *
 * The reference (`GRK-12`) if served, else the first glob elided, else NOTHING. There is no
 * `frozen: —`: D82 says calculated or absent, and a placeholder is a small lie read all day.
 */
export function frozenSegment(frozen) {
  if (frozen === null || frozen === undefined) return null;
  const reference = String(frozen.reference ?? '').trim();
  if (reference !== '') return `${FROZEN_PREFIX}${reference}`;
  const glob = String(frozen.glob ?? '').trim();
  if (glob === '') return null;
  const shown = glob.length <= GLOB_MAX ? glob : `${glob.slice(0, GLOB_MAX)}${ELLIPSIS}`;
  return `${FROZEN_PREFIX}${shown}`;
}

/**
 * THE LINE — `Goriki · <phase> · k decisions pending · frozen: GRK-12`.
 *
 * **The word `story` does not appear in this function and neither does any `n/m`.** D131 amends
 * D119 and forbids a permanent lag counter outright: by its spirit that is a dial, and D84 forbids
 * every dial, meter and percentage this product could show. A gate
 * greps these bytes for both, and it is written as a guard that names what it refuses.
 *
 * Three outcomes, and the caller prints whatever comes back:
 *
 *   · `''` — no snapshot at all. The line disappears. Announcing a product in a status bar because
 *     a file was missing would be advertising in the one place a person cannot close;
 *   · `NOT_SERVED` — a snapshot too old to stand behind. Said, never shown;
 *   · the line — every segment served, every absent one gone rather than apologised for.
 *
 * A snapshot stamped in the FUTURE is treated as fresh. Two machines whose clocks differ by a few
 * seconds is the ordinary case, not an error, and a status bar that blanked over it would be wrong
 * far more often than it was right.
 */
export function renderLine(snapshot, nowMs) {
  if (snapshot === null || snapshot === undefined) return '';

  const servedMs = Date.parse(snapshot.served_at);
  if (!Number.isFinite(servedMs)) return NOT_SERVED;
  if (nowMs - servedMs > STALE_AFTER_MS) return NOT_SERVED;

  const segments = [BRAND];

  const phase = String(snapshot.phase ?? '').trim();
  if (phase !== '') segments.push(phase);

  segments.push(pendingClause(snapshot.pending_decisions));

  const frozen = frozenSegment(snapshot.frozen);
  if (frozen !== null) segments.push(frozen);

  return segments.join(SEPARATOR);
}

/**
 * WHICH CROSSING THE CLIENT HAS ALREADY POINTED AT — [PROP-89-7] (a), and *"once"* is the rule.
 *
 * ── WHY IT IS A SEPARATE FILE FROM THE SNAPSHOT ───────────────────────────────────────────────
 *
 * The snapshot is REPLACED WHOLE every time the server answers. Anything remembered inside it is
 * forgotten on the next successful call — and this is precisely the thing that must not be
 * forgotten, or a marker would be laid again on every compaction for the same crossing. Two files,
 * two lifetimes: one is what the server last said, the other is what we already did about it.
 *
 * The identity of a crossing is `gate_id` + `verdict` together, not `gate_id` alone. A Gate can be
 * crossed again after a reserve is cleared, and a PASS following a PASS-WITH-RESERVES is a
 * different fact a builder is owed. Same pair twice is noise; the product never keeps a thing
 * twice (D130, in spirit).
 */
export function readGateMarker(dataDir) {
  if (typeof dataDir !== 'string' || dataDir === '') return null;
  try {
    const value = JSON.parse(readFileSync(gateMarkerPath(dataDir), 'utf8'));
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const { gate_id: gateId, verdict } = value;
    if (typeof gateId !== 'string' || gateId === '') return null;
    if (typeof verdict !== 'string' || verdict === '') return null;
    return { gate_id: gateId, verdict };
  } catch {
    return null;
  }
}

/** Remember that this crossing has been pointed at. Same atomic write, same silence on failure. */
export function writeGateMarker(dataDir, gate) {
  if (typeof dataDir !== 'string' || dataDir === '') return false;
  const target = gateMarkerPath(dataDir);
  const temporary = `${target}.${process.pid}.tmp`;
  try {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(
      temporary,
      `${JSON.stringify({ gate_id: gate.gate_id, verdict: gate.verdict })}\n`,
      'utf8',
    );
    renameSync(temporary, target);
    return true;
  } catch {
    try {
      rmSync(temporary, { force: true });
    } catch {
      /* Best effort, on the path where the write already failed. */
    }
    return false;
  }
}

/**
 * IS THIS CROSSING NEW TO THE CLIENT? The predicate `once` is built out of.
 *
 * `null` gate — nothing crossed, nothing to say. A marker never seen before — say it once. The same
 * pair as last time — say nothing, however many compactions go by.
 */
export function gateIsNew(gate, marker) {
  if (gate === null || gate === undefined) return false;
  if (marker === null || marker === undefined) return true;
  return !(marker.gate_id === gate.gate_id && marker.verdict === gate.verdict);
}
