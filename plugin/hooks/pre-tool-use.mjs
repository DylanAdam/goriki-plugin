/**
 * `PreToolUse` — REGISTERED, SILENT, AND NEVER A DENY (Story 8.1 · D103).
 *
 * The registration is Story 8.1's; the behaviour — the frozen-path guardrail — is Story 8.3's.
 * Until then this hook returns no decision, which is the only shape that keeps two promises at
 * once:
 *
 *   · **D103, fail-open.** The guardrail this plugin will eventually carry must never stop work it
 *     cannot rule on. A stub that denied anything would be a guardrail nobody wrote;
 *   · **acceptance criterion 3, composition.** "Where both rule on the same event, a deny is never
 *     overridden." A hook that returns no decision cannot override a user's own deny — the clause
 *     is trivially true here, and it is written down rather than left to be discovered.
 *
 * The matcher in `hooks/hooks.json` is `*` because that is the registration the install promises:
 * three hooks, on their three events, visible in `/hooks`. It is not a narrower matcher chosen to
 * make the stub cheap — a matcher that only ever matched Goriki's own tools would be a guardrail
 * pointed at itself.
 */
import process from 'node:process';

process.stdin.resume();
process.stdin.on('data', () => {});
process.stdin.on('end', () => process.exit(0));
process.stdin.on('error', () => process.exit(0));
