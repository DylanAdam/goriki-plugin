/**
 * THE STATUS LINE — `Goriki · <phase> · k decisions pending · frozen: GRK-12`. Story 8.9 · AC-1.
 *
 * D119 (the three-storey view: status line · live artifact · app), D131 (no `story n/m`, the freeze
 * is NAMED), D84-D86 (the client computes nothing), D82 (calculated or absent), D103 (fail-open).
 *
 * ── WHAT IT DOES, WHOLE ────────────────────────────────────────────────────────────────────────
 *
 *   1. read the snapshot the `PreCompact` hook last wrote;
 *   2. render one line from it, or the honest line when it is too old, or nothing at all;
 *   3. exit 0.
 *
 * **There is no step that reaches a network, opens a repository, counts anything, or reads a
 * token.** It cannot: the only input it has is a file the server filled and the session payload on
 * stdin. *"From served data, never computed client-side"* (AC-1) is a property of this file's
 * shape rather than a promise about its behaviour.
 *
 * ── THE ONE EXIT, AND ITS ARGUMENT IS `0` ─────────────────────────────────────────────────────
 *
 * A status line command runs on EVERY RENDER. It is the single most exposed surface in the product:
 * under a person's eyes permanently, and impossible for them to dismiss. So every failure — no
 * data directory, no file, a corrupted one, a shape from another version, a clock that disagrees —
 * ends the same way: **stdout is empty, the line disappears, and the exit code is 0.** A stack
 * trace in somebody's status bar, repeated every few seconds, would be worse than no line at all,
 * and it would be a defect a person could not escape without editing their settings.
 *
 * ── WHERE THE CACHE IS, AND WHY IT IS AN ARGUMENT ─────────────────────────────────────────────
 *
 * MEASURED (CLI 2.1.246, 2026-08-28): *"${CLAUDE_PLUGIN_DATA} is plugin-only … only available in
 * hooks defined in a plugin's hooks/hooks.json file, not in settings.json."* This script IS
 * configured in `settings.json` — that is what a status line is — so neither that substitution nor
 * `${CLAUDE_PLUGIN_ROOT}` resolves for it.
 *
 * So the directory arrives as `argv[2]`, written into the line by `scripts/statusline-offer.mjs`
 * when it prints the configuration to paste, already resolved for that machine. With no argument it
 * falls back to the documented layout, which keeps a hand-written configuration working.
 *
 * **No drive letter and no absolute path is written in this file.** Both would be this machine's
 * answer shipped to everybody else's.
 */
import process from 'node:process';
import { pluginDataDir, readSnapshot, renderLine } from '../hooks/lib/statusline-cache.mjs';

/**
 * Drain stdin without waiting on it — 8.1's stub learned this and the lesson holds.
 *
 * The client writes the session payload there (`session_id`, `cwd`, `workspace`, `model`,
 * `version` — measured from the client's own documented schema, 2.1.246). A process that closes the
 * pipe under the writer is a broken pipe on the other side, so it is drained and dropped.
 *
 * **Nothing in this file reads that payload**, and that is [PROP-89-2] (c) taken only as far as it
 * needs to go: stdin is the KEY, not the data, and this cache is not keyed by session. One machine,
 * one Goriki, one snapshot — a per-session key would multiply the file without making any line of
 * it truer. The day a session needs its own snapshot, `workspace.project_dir` is where the key
 * comes from, and it is already on stdin waiting.
 */
process.stdin.resume();
process.stdin.on('data', () => {});
process.stdin.on('error', () => {});

try {
  const dataDir = (process.argv[2] ?? '').trim() || pluginDataDir();
  const line = renderLine(readSnapshot(dataDir), Date.now());
  // An empty line is written as nothing at all — not as a blank row reserving space in the bar.
  if (line !== '') process.stdout.write(`${line}\n`);
} catch {
  /*
   * Unreachable by design — every function this file calls answers instead of throwing. It is here
   * because "unreachable" is a claim about today's code and this file may never raise, ever. The
   * status bar stays empty and the session never hears about it.
   */
}

process.exit(0);
