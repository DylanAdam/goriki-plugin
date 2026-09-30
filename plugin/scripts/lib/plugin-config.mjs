/**
 * WHERE A SHIPPED SCRIPT FINDS THE BRIDGE AND THE TOKEN — ONE function, now TWO callers.
 *
 * ── WHY THIS FILE EXISTS (Story 8.8, 2026-09-02 · D41: the addition names its retraction) ──────
 *
 * This function was `readConfig()` inside `write-rules-block.mjs` (Story 8.5, 2026-08-28). Story
 * 8.8 ships a SECOND script that needs exactly the same two values by exactly the same route, and
 * the brief is explicit that it *"reuses that function and does not write a second one"*. A copy
 * would be two searches of one config store, diverging the first time a client version moves a key
 * — which the 8.5 header below says out loud is a thing client versions do.
 *
 * So the function MOVED, whole, with its measurement, and `write-rules-block.mjs` imports it. Its
 * behaviour is unchanged: the same order, the same four candidate files, the same bounded depth,
 * the same silence about what it finds.
 *
 * ── THE TWO VALUES THE INSTALL CARRIES, found without either being typed by a person ───────────
 *
 * The environment is asked FIRST and it is the documented route: `GORIKI_URL` and `GORIKI_PAT`. The
 * client's own configuration store is asked second, because `claude plugin install --config` writes
 * the two `userConfig` values there and asking the builder to re-type a token they already gave the
 * client would be a worse experience than this search.
 *
 * ── WHERE THE CLIENT PUTS THEM — MEASURED 2026-08-28, Claude Code 2.1.246, Windows 11 ──────────
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
 * ── AND WHAT IS **NOT** MEASURED, said so nobody assumes it (Story 8.8, régime RE-VERIFY D107) ──
 *
 * A HOOK receives `CLAUDE_PLUGIN_OPTION_GORIKI_URL` / `_PAT` in its environment — measured by Story
 * 8.2 with a probe plugin. **Whether a script the model launches with its Bash tool inherits those
 * same variables is NOT MEASURED**, and this function therefore does not depend on it. If a smoke
 * ever measures that it does, this is the one place a third route would be added.
 *
 * The search is BOUNDED, it reads only the client's own configuration directory, and it never
 * prints what it finds. If neither route answers, the caller says what is missing and stops — it
 * does not guess an address, and it does not go looking for a credential anywhere else.
 */
import { existsSync as defaultExistsSync, readFileSync as defaultReadFileSync } from 'node:fs';
import { homedir as defaultHomedir } from 'node:os';
import { join as defaultJoin } from 'node:path';
import process from 'node:process';

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

/**
 * `{url, pat, source}` — `source` is `null` when either half is missing, and it is what a caller
 * prints instead of a value. Every dependency is injectable so a Vitest can drive the search over a
 * fixture tree without a real client on the machine (the 83-8 pattern).
 */
export function readPluginConfig(deps = {}) {
  const env = deps.env ?? process.env;
  const homedir = deps.homedir ?? defaultHomedir;
  const existsSync = deps.existsSync ?? defaultExistsSync;
  const readFileSync = deps.readFileSync ?? defaultReadFileSync;
  const join = deps.joinPath ?? defaultJoin;

  /*
   * AN EMPTY VARIABLE MEANS ABSENT, and it is a supersession of 8.5's reading (2026-09-02, D41).
   *
   * `readConfig()` took `env.GORIKI_URL ?? null`, so `GORIKI_URL=` — the shape this repository uses
   * everywhere to BLANK a value for a probe, `OPENROUTER_API_KEY=` included — read as "configured
   * with the empty string" and produced the WRONG refusal one function later: *"the configured
   * bridge address is not the shape this plugin expects"* instead of *"nothing is configured
   * here"*. Measured on 2026-09-02 while writing 8.8's first spawn test, which blanks both
   * variables to make the child hermetic. Nothing that was working stops working: a value that was
   * present and non-empty is still present.
   */
  const nonEmpty = (value) => (typeof value === 'string' && value.trim().length > 0 ? value : null);
  const fromEnv = {
    url: nonEmpty(env.GORIKI_URL),
    pat: nonEmpty(env.GORIKI_PAT),
  };
  if (fromEnv.url !== null && fromEnv.pat !== null) return { ...fromEnv, source: 'environment' };

  const root = env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude');
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
