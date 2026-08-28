/**
 * THE STATUS LINE, OFFERED — never written. Story 8.9 · AC-1 · [PROP-89-1] (c1), memo 89-1.
 *
 * D105 (*we name what we install*), D116 (≤ 3 steps), D84-D86, D103.
 *
 * ── WHY THIS SCRIPT EXISTS INSTEAD OF AN INSTALLER ────────────────────────────────────────────
 *
 * The acceptance criterion says the status line is *"configured at install, removed entirely at
 * uninstall"*. Three roads were weighed and two are closed by MEASUREMENT (CLI 2.1.246, Windows 11,
 * 2026-08-28 — the full smoke is in the implementation report):
 *
 *   · **the plugin ships it.** Closed. `statusLine` is not a plugin component: `claude plugin
 *     validate` answers, verbatim, *"statusLine: Unknown field 'statusLine'. Claude Code ignores it
 *     at load time."* A `settings` record in the manifest DOES validate — and the installed
 *     plugin's own component inventory then lists `Skills, Agents, Hooks, MCP servers, LSP
 *     servers` and **no status line at all**. Whether the runtime would honour it could not be
 *     established: seeing a status line render needs a live session, and this bench's CLI could not
 *     be authenticated. **A capability that cannot be shown working is not one this story claims;**
 *   · **the install writes the user's own settings file.** FORBIDDEN, and not merely risky. That file
 *     holds exactly ONE `statusLine` — it is an object, not a list — so writing ours REPLACES what
 *     the person already runs. On this very bench that is the user's own HUD. The Connect Agent
 *     screen has promised in print since 8.1 that *"nothing of yours is replaced, reordered or
 *     disabled"*, and a story that broke that sentence to satisfy its own criterion would ship the
 *     exact defect the sentence exists to prevent;
 *   · **offer it.** This script. It looks, it reports what it found, it prints the configuration to
 *     paste, and **it writes nothing anywhere.**
 *
 * ── AND *"REMOVED ENTIRELY AT UNINSTALL"* IS THEN TRUE BY CONSTRUCTION ────────────────────────
 *
 * This is the part that makes the road honest rather than merely safe. Nothing was written, so
 * there is nothing orphaned to clean up, and no uninstall routine that has to be trusted or tested.
 * `claude plugin uninstall` takes the hooks, the MCP registration, the skills and the commands —
 * everything the plugin actually configured — and a line the person pasted themselves stays theirs,
 * which is the only correct behaviour for a file the product does not own.
 *
 * The measured cost is named rather than hidden: **it is one more step than an installer would be**
 * (D116 counts steps, and this one is optional and comes after the three). The trade is a step
 * against a promise, and the promise was already in print.
 *
 * ── IT WRITES NOTHING, AND A GATE PROVES IT ───────────────────────────────────────────────────
 *
 * `plugin-files.test.ts` greps this file for every filesystem call that could create, extend, move
 * or delete anything — which is why none of them is NAMED here, comments included: the guard reads
 * the source, and a rule written as an example ships its own counter-example. This script opens two
 * settings files for reading and prints. That is the whole of its power.
 */
import process from 'node:process';
import { join, dirname } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { claudeConfigDir, pluginDataDir } from '../hooks/lib/statusline-cache.mjs';

/** This package's own root, from this file rather than from a substitution that may not resolve. */
const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The two scopes a status line can be configured in. Measured; there is no third.
 *
 * The user's scope is DERIVED from where this plugin is installed rather than guessed from a home
 * directory — `claudeConfigDir` explains why in full, and the short version is that a person who
 * moved their configuration would otherwise be shown a file that is not the one in force. `null`
 * when this script is not running from an installed plugin, and the report says so rather than
 * printing a path nobody has.
 */
const CONFIG_DIR = claudeConfigDir(import.meta.url);
const USER_SETTINGS = CONFIG_DIR === null ? null : join(CONFIG_DIR, 'settings.json');
const PROJECT_SETTINGS = join(process.cwd(), '.claude', 'settings.json');

/**
 * What a settings file says about `statusLine` — and every failure is *"nothing there"*.
 *
 * A missing file, an unreadable one, JSON that will not parse: all mean this scope does not
 * configure a status line as far as anything can tell, which is the only conclusion that matters.
 * Nothing here repairs a file and nothing here reports its other keys.
 */
function existingStatusLine(path) {
  if (path === null) return null;
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'));
    if (value === null || typeof value !== 'object') return null;
    const line = value.statusLine;
    if (line === null || line === undefined || typeof line !== 'object') return null;
    return typeof line.command === 'string' ? line.command : '(configured)';
  } catch {
    return null;
  }
}

/**
 * THE CONFIGURATION TO PASTE, with both paths already resolved for THIS machine.
 *
 * The data directory is written into the command as an argument on purpose. MEASURED: *"${CLAUDE_
 * PLUGIN_DATA} is plugin-only … not in settings.json"* — a status line gets neither that
 * substitution nor `${CLAUDE_PLUGIN_ROOT}`, so a configuration that used either would silently
 * render nothing for ever. Absolute paths are correct HERE and only here: this text is composed on
 * the machine it is pasted on, and it is never a file this package ships.
 */
function configuration() {
  const script = join(PLUGIN_ROOT, 'statusline', 'goriki-statusline.mjs');
  const dataDir = pluginDataDir();
  /*
   * The data directory is written into the command as an ARGUMENT. MEASURED: `${CLAUDE_PLUGIN_DATA}`
   * is plugin-only and does not resolve in a settings file, so a configuration relying on it would
   * silently render nothing for ever. With no directory to name, the script still falls back to its
   * own derivation at run time — the argument is the braces, not the belt.
   */
  const command =
    dataDir === null ? `node "${script}"` : `node "${script}" "${dataDir}"`;
  return JSON.stringify({ statusLine: { type: 'command', command } }, null, 2);
}

const user = existingStatusLine(USER_SETTINGS);
const project = existingStatusLine(PROJECT_SETTINGS);

const out = [];
out.push('The Goriki status line');
out.push('');
out.push(
  'It reads a snapshot your PreCompact hook writes and renders one line: the phase, how many',
);
out.push(
  'decisions are waiting, and the frozen zone when there is one. It reaches no network and counts',
);
out.push('nothing — every value in it was served.');
out.push('');
out.push('What is configured on this machine right now:');
out.push('');
out.push(`  ${USER_SETTINGS ?? '(this plugin is not running from an installed copy — user scope not located)'}`);
out.push(`    ${user === null ? 'no status line configured' : `already set — ${user}`}`);
out.push(`  ${PROJECT_SETTINGS}`);
out.push(`    ${project === null ? 'no status line configured' : `already set — ${project}`}`);
out.push('');

if (user !== null || project !== null) {
  /*
   * The one sentence this whole road exists for. A person who already runs a status line is told
   * that this one REPLACES it if they paste it, because `statusLine` is single-valued and there is
   * no composing two. Saying so is the difference between an offer and a trap.
   */
  out.push('You already run a status line. There is exactly one per settings file, so pasting');
  out.push('this would replace yours — Goriki will not do that for you, and does not recommend');
  out.push('it. Keep yours, or merge the two by hand if you want both.');
  out.push('');
  out.push('For reference, this is what Goriki would have offered:');
} else {
  out.push('To turn it on, add this to one of the files above:');
}

out.push('');
for (const line of configuration().split('\n')) out.push(`  ${line}`);
out.push('');
out.push('Nothing was written. Goriki never edits your settings — removing the plugin therefore');
out.push('leaves nothing of ours behind, and never touches a line you pasted yourself.');

process.stdout.write(`${out.join('\n')}\n`);
process.exit(0);
