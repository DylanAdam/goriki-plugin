/**
 * `/goriki:contest <GRK-n>` — THE GESTURE THAT FILES ONE ENTRY AND CHANGES NOTHING. Story 8.3 · AC-6.
 *
 * ── WHAT IT IS, AND EVERY WORD OF WHAT IT IS NOT ───────────────────────────────────────────────
 *
 * AC-6: *"a contest affordance — 'zone too wide? contest it' — which files **one entry in the
 * register** and nothing else: it is **never an override**, never a flag, never a bypass; the zone
 * changes only by a decision, and the refusal also says plainly that nothing is broken."*
 *
 * So this script posts one reference and prints what the register answered. There is no argument it
 * accepts that unblocks anything, no environment variable it reads that relaxes anything, and no
 * file it writes that any hook consults. If somebody ever needs to know whether a contestation can
 * be turned into a permission, the answer is in the shape: it returns a reference and a boolean
 * about whether a ROW was written, and the freeze reads no row.
 *
 * ── WHY A SCRIPT AND NOT A SENTENCE IN THE COMMAND FILE ───────────────────────────────────────
 *
 * `commands/contest.md` is a prompt: the model reads it and acts. A command that asked the model to
 * compose an HTTP call would put the address, the header and the body in a place nothing tests, and
 * would spend a model's tokens on a POST. So the markdown names ONE command line and this file is
 * what it runs — the shape memo 85-2 chose for the Rules block, one story earlier in the same wave.
 *
 * It lives in `scripts/` rather than in `hooks/lib/` because it is an ENTRY, not a library: it has
 * an `argv`, it prints, and it exits. It nonetheless spends the hook's client — the same origin
 * rule, the same token channel, the same two-second budget, the same refusal to follow a redirect.
 * A second client for a command would be the second client the couture C-2 forbids.
 *
 * ── AND IT EXITS 0 ON EVERY PATH ───────────────────────────────────────────────────────────────
 *
 * It is not a hook, so no exit code of its own would block anything. It exits 0 anyway, and says
 * what happened in words: a non-zero exit inside a model's `Bash` call becomes an error the model
 * tries to work around, and there is nothing here worth working around — a contestation that could
 * not be filed is a fact to report, not a failure to retry.
 */
import process from 'node:process';

import { credentials, postContest } from '../hooks/lib/client.mjs';

/** What the builder typed, normalised only in case — `grk-12` and `GRK-12` are one reference. */
function referenceFrom(argv) {
  const raw = (argv[2] ?? '').trim().toUpperCase();
  return /^GRK-[1-9][0-9]{0,8}$/.test(raw) ? raw : null;
}

async function main() {
  const reference = referenceFrom(process.argv);
  if (reference === null) {
    process.stdout.write(
      'Name the decision the refusal printed, like this: /goriki:contest GRK-12\n',
    );
    process.exit(0);
  }

  const { origin, token } = credentials();
  if (origin === null || token === null) {
    process.stdout.write(
      'This machine has no Goriki address or token configured, so nothing could be filed. ' +
        'Nothing is blocked by that: frozen zones fail open when Goriki cannot be reached.\n',
    );
    process.exit(0);
  }

  const answer = await postContest(origin, token, reference);
  if (!answer.ok) {
    process.stdout.write(
      `${reference} could not be filed right now (${answer.reason}). Nothing is blocked by that, ` +
        'and nothing was lost — running this again later files it.\n',
    );
    process.exit(0);
  }

  /*
   * `filed: false` means the register already held one. It is SAID rather than reported as a fresh
   * success: a command that claims to have filed the same thing twice teaches a builder to distrust
   * the count, and the count is the only thing this gesture produces.
   */
  const filed = answer.body?.filed === true;
  process.stdout.write(
    filed
      ? `${reference}: filed. The builder will see it in the register. The zone has not changed — ` +
          'only a decision changes a zone.\n'
      : `${reference}: already filed, so nothing was added. The zone has not changed — only a ` +
          'decision changes a zone.\n',
  );
  process.exit(0);
}

void main();
