/**
 * THE FREEZE, AS PURE FUNCTIONS — Story 8.3 · FR-35, AR32 · D82, D84-D86, D94, D102, D103, D105.
 *
 * ── WHY THIS FILE IS `.mjs` AND NOT COMPILED FROM TYPESCRIPT ([PROP-83-8] (a), memo 83-8) ──────
 *
 * `plugin/` is DATA. It is copied onto a user's disk verbatim, there is no `node_modules` beside it
 * and there is no build on their machine, so this file cannot `import` from `@goriki/shared` and
 * cannot be transpiled on the way in. Two ways to keep it honest existed: compile TypeScript into
 * `plugin/hooks/`, or write `.mjs` and have a gate compare it back. The first was refused for the
 * reason `write-plugin-docs.ts` exists — a committed artefact that can go stale against its source
 * is the debt this repository already paid off once — and because a compiled file makes a diff
 * illegible: the file a person RUNS stops being the file a reviewer READS.
 *
 * So the sentences and the tool list are spelled out here, and `freeze-lib.test.ts` imports THESE
 * BYTES and compares them to `packages/shared/src/contracts/freeze.ts`. Change one without the other
 * and the gate says which line moved. It is 8.2's answer to the identical problem, one hook over.
 *
 * ── AND NOTHING HERE COMPUTES A ZONE (AR32, D94) ──────────────────────────────────────────────
 *
 * *"reads, never computes"* permits comparing a path to a glob — that comparison is the whole job.
 * It forbids MAKING a zone: no derivation from the D77 cone, no widening, no normalisation, no
 * completion of a partial glob, no *"this folder looks like the zone"*. Every transformation this
 * file does not perform is written where it would have gone, because an omission nobody wrote down
 * is an omission somebody will helpfully repair.
 *
 * ── AND NOTHING HERE DECIDES `allow` ──────────────────────────────────────────────────────────
 *
 * `decideFreeze` answers a refusal or answers `null`. There is no third value and there will not be
 * one: Story 8.1's third acceptance criterion is *"where both rule on the same event, a deny is
 * never overridden"*, and a hook that emitted an explicit `allow` would be voting on every write in
 * the session — overturning a `deny` the builder wrote themselves, for a plugin they installed for
 * an unrelated reason.
 */

/**
 * The tools that write. MEASURED against the client's own inventory at the smoke, and NAMED rather
 * than matched by a pattern (D105).
 *
 * The `PreToolUse` matcher in `hooks.json` stays `*` — 8.1's deliberate registration — and the
 * decision is made HERE. A matcher of `Edit|Write|Bash` would let a writing tool nobody listed cross
 * a frozen zone WITHOUT THE HOOK EVER RUNNING; with `*`, an unknown tool reaches this list, is not
 * on it, and is allowed — the same outcome, except the product can see it.
 *
 * `MultiEdit` is listed although the measured 2.1.246 inventory does not carry it: a list that is
 * wrong by being too cautious costs one string comparison, and one wrong the other way is a hole.
 *
 * Byte-for-byte identical to `WRITER_TOOL_NAMES` in the contracts — a gate asserts it.
 */
export const WRITER_TOOL_NAMES = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Bash'];

/** The one tool whose input is a COMMAND rather than a path. */
export const COMMAND_TOOL_NAME = 'Bash';

/** Is this tool one the freeze looks at? Anything else is allowed without another thought. */
export function isWriterTool(toolName) {
  return WRITER_TOOL_NAMES.includes(toolName);
}

/**
 * THE SENTENCES OF THE REFUSAL — spelled out, and compared to `FREEZE_COPY` by a gate.
 *
 * The person reading them has just been stopped mid-task. The order is fixed: which decision, which
 * zone, that nothing is broken, then the two gestures — and *"nothing is broken"* comes BEFORE the
 * instructions, because somebody who thinks they have broken something does not read instructions.
 *
 * Nothing here claims this product inspected, ran or rated anything (D84-D86), and the brand D135
 * names appears nowhere in this tree. The words are chosen that way ON PURPOSE: the guard in
 * `plugin-files.test.ts` greps every shipped byte for the forbidden vocabulary, so even a sentence
 * SAYING this product does not do a thing may not use that thing's word. A blunt guard is the
 * right kind — it cannot be talked around, and it caught this paragraph's first draft.
 */
const COPY = {
  UNSEALED: 'is unsealed',
  FROZEN_UNTIL: 'is frozen until it is sealed',
  NOTHING_BROKEN: 'Nothing is broken — every other path is open, and no work was lost.',
  SEAL_IT: 'Seal it:',
  CONTEST: 'Zone too wide? Contest it:',
  CONTEST_EFFECT:
    'That files one entry in the register and changes no zone — only a decision does that.',
  BASH_LITERAL:
    'This reads the command literally: a path held in a variable, a heredoc or find -exec is not ' +
    'seen at all.',
};

/** `/goriki:contest` — the command D105 requires be named. `CONTEST_COMMAND` in the contracts. */
export const CONTEST_COMMAND = '/goriki:contest';

/**
 * THE REFUSAL — the same composition as `composeFreezeRefusal`, and a gate proves it byte for byte.
 *
 * It drops the segment it was not served and never fills one: no `GRK-null`, no question this
 * product wrote on a builder's behalf (D82). What it always states are facts about the refusal
 * rather than about the packet — which glob bit, that nothing is broken, and how to disagree.
 */
export function composeRefusal(input) {
  const named =
    input.reference === null ? 'A pending CRITICAL decision' : `${input.reference} (CRITICAL)`;
  const asked = input.question === null ? '.' : `: “${input.question}”.`;

  const lines = [
    `${named} ${COPY.UNSEALED}${asked}`,
    `${input.glob} ${COPY.FROZEN_UNTIL}.`,
    COPY.NOTHING_BROKEN,
    `${COPY.SEAL_IT} ${input.deepLink}`,
    `${COPY.CONTEST} ${CONTEST_COMMAND}${input.reference === null ? '' : ` ${input.reference}`}`,
    COPY.CONTEST_EFFECT,
  ];

  if (input.tool === COMMAND_TOOL_NAME) lines.push(COPY.BASH_LITERAL);

  // ONE FACT PER LINE — see `composeFreezeRefusal` in the contracts for the argument. The gate
  // compares the two compositions byte for byte, so this join and that one move together or fail.
  return lines.join('\n');
}

/**
 * ONE GLOB AGAINST ONE PATH — literal, anchored, and it transforms NEITHER SIDE.
 *
 * Supported, because it is what a packet is allowed to store (`decision-packet.ts` refuses a leading
 * `/`, a `..`, a backslash and an empty segment at the creation): `**` crosses a separator, `*` does
 * not, `?` is one non-separator character, and everything else is itself.
 *
 * NOT supported, and each one is a way this function could have invented a zone:
 *
 *   · no case folding — `APPS/api` does not match `apps/api/**` even on a filesystem that would call
 *     them one file. Folding is a judgement about what the builder meant, and a freeze that widens
 *     itself on one operating system is a freeze nobody can reason about;
 *   · no separator normalisation — a packet may not store a backslash, so a path carrying one is not
 *     a path this zone describes;
 *   · no `..` resolution, no `realpath`, no disk access of any kind. Asking the filesystem where a
 *     path really points is computing the zone from something the packet never said;
 *   · no brace expansion, no character classes, no negation — a packet cannot store them, so
 *     honouring them would be inventing a grammar and then obeying it.
 *
 * A glob this function does not understand matches nothing, which is the fail-open direction.
 *
 * ── B-83-3, CORRECTED 2026-08-28: TWO ADJACENT `**` COMPILED TO TWO ADJACENT `.*` ────────────────
 *
 * MEASURED: `glob = 'a' + '**'.repeat(N) + 'b'` against a path of length L — N=6, L=200 did not
 * return in 25 s; N=24, L=400 took 196,916 ms. The loop below used to emit ONE `.*` per `**` TOKEN
 * rather than one per RUN of them, so a glob with no separator between two `**` — legal at the
 * packet (`decision-packet.ts` refuses a leading `/`, `..`, a backslash and an empty segment, none
 * of which this shape is) — compiled to `/^a.*.*b$/`: two unbounded quantifiers over the same
 * character class with nothing between them, which is textbook catastrophic backtracking. A REAL
 * glob is fine — five `**` segments each separated by a slash from the next answer in 0 ms — only
 * true adjacency, with no separator at all between two `**`, is the hole.
 *
 * The fix does not change what a glob MATCHES (AR32: this is not a transformation of the zone).
 * `**` already means "any run of characters, including separators", so two of them back to back
 * describe exactly the same language as one — `lastWasAnyRun` folds a run of adjacent `**` into a
 * SINGLE `.*` at compile time, which is a fact about regular languages, not a widening of anybody's
 * frozen zone.
 */
const MAX_GLOB_LENGTH = 200; // `frozenPathSchema` — `decision-packet.ts:324` — is `text(200, …)`.
const GLOB_REGEXP_CACHE = new Map();

/**
 * The glob, compiled once and reused — B-83-3's second half.
 *
 * MEASURED: 20,000 Bash tokens × 50 zones × 20 globs (`decideFreeze` runs twice per write, cache
 * then confirmation) rebuilt a fresh `RegExp` for every one of those pairs — 98,858 ms. A glob string
 * is reused across every path and every call in one process, so it is compiled once per distinct
 * string and read back from a `Map` the rest of the time; `matchesGlob` itself is unchanged in what
 * it answers, only in how many times it does the work to answer.
 *
 * A glob LONGER than a legitimate packet can ever carry (`MAX_GLOB_LENGTH`) compiles to a pattern
 * that matches NOTHING — the same fail-open answer `malformed` already gets, never a wall built from
 * an oversized string nobody's `decision-packet.ts` validation could have produced.
 */
function globRegExp(glob) {
  const cached = GLOB_REGEXP_CACHE.get(glob);
  if (cached !== undefined) return cached;

  let regexp;
  if (glob.length > MAX_GLOB_LENGTH) {
    regexp = /(?!)/; // never matches — the fail-open answer for a glob no packet could have stored.
  } else {
    let pattern = '';
    let lastWasAnyRun = false; // true right after a `.*` was emitted — folds an adjacent `**`.
    for (let index = 0; index < glob.length; index += 1) {
      const character = glob[index] ?? '';
      if (character === '*') {
        if (glob[index + 1] === '*') {
          if (!lastWasAnyRun) pattern += '.*';
          lastWasAnyRun = true;
          index += 1;
        } else {
          pattern += '[^/]*';
          lastWasAnyRun = false;
        }
      } else if (character === '?') {
        pattern += '[^/]';
        lastWasAnyRun = false;
      } else {
        // Escaped, so a dot in `*.env` is a dot. A metacharacter honoured by accident is a widening.
        pattern += character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        lastWasAnyRun = false;
      }
    }
    regexp = new RegExp(`^${pattern}$`);
  }

  // A bound on the CACHE itself — a session that saw thousands of distinct glob strings does not
  // get to grow this `Map` without limit. Clearing it costs one round of recompilation, never a wall.
  if (GLOB_REGEXP_CACHE.size >= 512) GLOB_REGEXP_CACHE.clear();
  GLOB_REGEXP_CACHE.set(glob, regexp);
  return regexp;
}

export function matchesGlob(glob, path) {
  return globRegExp(glob).test(path);
}

/**
 * THE PATHS A `Bash` COMMAND NAMES — literally ([PROP-83-3] (a), memo 83-3).
 *
 * Whitespace splits, quotes hold a path with a space together, and NOTHING is expanded: `$VAR`, `~`
 * and `*` come back as opaque characters and are compared as such.
 *
 * The hole is real and it is NAMED rather than papered over — in the refusal itself
 * (`COPY.BASH_LITERAL`), in the guide and in the report: `bash -c "$CMD"`, a variable, a heredoc or
 * a `find -exec` can write inside a frozen zone without ever being seen. That is the direction D103
 * chose. The alternative is interpreting a shell, which is the *"computes"* of this story's title,
 * and a parser that is ninety per cent right refuses legitimate work unpredictably.
 */
export function bashPathTokens(command) {
  const tokens = [];
  let current = '';
  let quote = null;
  let started = false;
  for (const character of command) {
    if (quote !== null) {
      if (character === quote) quote = null;
      else current += character;
      started = true;
    } else if (character === '"' || character === "'") {
      quote = character;
      started = true;
    } else if (/\s/.test(character)) {
      if (started) tokens.push(current);
      current = '';
      started = false;
    } else {
      current += character;
      started = true;
    }
  }
  if (started) tokens.push(current);
  return tokens.filter((token) => token !== '');
}

/** A field of the tool's input, if it is a non-empty string. Anything else is not a path. */
function stringField(input, name) {
  const value = input === null || typeof input !== 'object' ? undefined : input[name];
  return typeof value === 'string' && value !== '' ? value : null;
}

/** How many tokens of ONE `Bash` command this function will compare against a zone. B-83-3. */
const MAX_BASH_TOKENS_EXAMINED = 512;

/**
 * ONE PATH, MADE RELATIVE TO THE PROJECT — B-83-1, corrected 2026-08-28.
 *
 * ── WHAT WAS WRONG, MEASURED ON THIS BENCH ────────────────────────────────────────────────────
 *
 * `Edit`'s and `Write`'s own schemas say `file_path` is *"the absolute path"*; the CLI never sends
 * a relative one. This function used to compare that absolute string to a glob a packet may only
 * ever store RELATIVE (`decision-packet.ts` refuses a leading `/`) — so it could never match, and
 * four of `WRITER_TOOL_NAMES`' five tools (every one that names a `file_path`) froze nothing.
 *
 * ── WHY THIS IS "READING", NOT "COMPUTING" (AR32, D94) ────────────────────────────────────────
 *
 * `event.cwd` is a field the client's own stdin already carries — the corpus's one verbatim example
 * lists it (`_raw-claude-code.md:334-345`) — so subtracting it from a tool's own path is reading a
 * second field of the SAME event, not deriving anything from the D77 cone or from a filesystem. It
 * is the literal inverse of what a shell does when it resolves a relative path against its own
 * working directory, applied backwards, using only what the event already stated.
 *
 * Only the PATH's own separators are unified for the prefix comparison — never the glob's. A path
 * that is not under `cwd` (a different drive, a parent directory, no `cwd` on the event at all) is
 * left exactly as it arrived: still absolute, still unable to match a relative glob, the same
 * fail-open answer as before this correction for the case that genuinely is outside the project.
 */
function relativizeToCwd(cwd, rawPath) {
  if (typeof cwd !== 'string' || cwd === '') return rawPath;
  const normalizedCwd = cwd.replace(/\\/g, '/').replace(/\/+$/, '');
  if (normalizedCwd === '') return rawPath;
  const normalizedPath = rawPath.replace(/\\/g, '/');
  if (normalizedPath === normalizedCwd) return '';
  const prefix = `${normalizedCwd}/`;
  return normalizedPath.startsWith(prefix) ? normalizedPath.slice(prefix.length) : rawPath;
}

/**
 * THE PATHS ONE TOOL CALL NAMES — read off the event, never inferred from it.
 *
 * ── [NON MESURÉ] on this bench, corrected 2026-08-28 (B-83-4) ────────────────────────────────
 *
 * This comment used to claim the field names below were "a MEASUREMENT of the client's `PreToolUse`
 * stdin at 2.1.246, quoted verbatim in the implementation report" — no `claude -p` session on this
 * bench ever captured that payload (the CLI could not authenticate here; see the implementation
 * report §1), and no such verbatim quote exists in it. What the names ARE grounded in: `Edit`'s and
 * `Write`'s own tool schemas, read directly (they say `file_path` in as many words), and
 * `NotebookEdit`'s `notebook_path`, from the same source — a reading of the platform's documented
 * shape, not a capture on this machine. The smoke role re-verifies this against a real session
 * (regime RE-VERIFY, D107) and the report states which it was.
 *
 * `cwd`, added by the B-83-1 correction above, is read the same way: the corpus's one verbatim
 * `PreToolUse` example (`_raw-claude-code.md:334-345`) names it as a field of the event.
 *
 * A missing field, a blank one or one of the wrong type answers an EMPTY LIST. It never answers a
 * guess, and an empty list freezes nothing — the fail-open direction, again.
 */
export function pathsFromToolInput(toolName, toolInput, cwd) {
  if (toolName === COMMAND_TOOL_NAME) {
    const command = stringField(toolInput, 'command');
    if (command === null) return [];
    // B-83-3: an attacker- or accident-sized command does not get to multiply the matching loop
    // below without bound. Tokens beyond the cap are not examined — named here, in the guide and
    // in the report, the same direction as every other Bash hole this file already states.
    //
    // Each token is relativized exactly as a file tool's `file_path` is — B-83-1's fix applies
    // uniformly, because it is one act (subtract `cwd` from a path THIS event already named) done
    // in one place, not a second rule invented for `Bash`. This is not the expansion PROP-83-3
    // refuses: a token that is already a literal absolute path is compared literally, the same way
    // a relative token already was. It closes one more of the repro's named holes for free (a
    // literal absolute path typed in a command, not merely a relative one).
    return bashPathTokens(command)
      .slice(0, MAX_BASH_TOKENS_EXAMINED)
      .map((token) => relativizeToCwd(cwd, token));
  }

  const paths = [];
  for (const field of ['file_path', 'notebook_path']) {
    const value = stringField(toolInput, field);
    if (value !== null) paths.push(relativizeToCwd(cwd, value));
  }

  /*
   * `MultiEdit` carries a list of edits and EACH one is a write. Reading only the outer `file_path`
   * would let a batch touch a frozen zone while the hook looked at one path it happened to name
   * first. The list is read defensively — a member that is not an object with a string path is
   * skipped rather than assumed.
   */
  const edits = toolInput === null || typeof toolInput !== 'object' ? undefined : toolInput.edits;
  if (Array.isArray(edits)) {
    for (const entry of edits) {
      const value = stringField(entry, 'file_path');
      if (value === null) continue;
      const relative = relativizeToCwd(cwd, value);
      if (!paths.includes(relative)) paths.push(relative);
    }
  }

  return paths;
}

/**
 * DOES THIS CALL WRITE SOMEWHERE THIS PRODUCT CAN SEE? — `{tool, paths}`, or `null`.
 *
 * ── WHY IT IS ITS OWN FUNCTION, AND IT IS A CORRECTION (2026-08-28, found by the suite) ────────
 *
 * This check lived INSIDE `decideFreeze`, and the hook therefore only reached it AFTER deciding
 * whether to refresh its cache — so a `Read` on a cold cache made a network call to answer a
 * question about a tool that writes nothing. The header of `pre-tool-use.mjs` had promised the
 * opposite in as many words (*"not a writing tool … no disk, no network"*), and the assertion that
 * caught it is `a tool that does not write is not looked at` in `pre-tool-use-hook.test.ts`.
 *
 * Exported so the hook can ask FIRST and stop, and used by `decideFreeze` too — one function reads
 * the event, so the cheap check and the real one can never disagree about what a write is.
 *
 * `null` covers: a tool that is not on the named list, a tool input that is missing or of the wrong
 * shape, and a call that names no path at all. None of them freezes anything.
 */
export function writeIntent(event) {
  const toolName = stringField(event, 'tool_name');
  if (toolName === null || !isWriterTool(toolName)) return null;

  const toolInput = event === null || typeof event !== 'object' ? null : (event.tool_input ?? null);
  // B-83-1: `cwd` is the event's own field (corpus example, `_raw-claude-code.md:334-345`) — reading
  // it and subtracting it from the tool's own absolute path is the SAME act as comparing a path to a
  // glob: application, not computation of a zone (AR32).
  const cwd = stringField(event, 'cwd');
  const paths = pathsFromToolInput(toolName, toolInput, cwd);
  return paths.length === 0 ? null : { tool: toolName, paths };
}

/** The globs of one zone, in the three named cases. `absent` and `malformed` freeze NOTHING. */
function globsOf(zone) {
  const frozen = zone === null || typeof zone !== 'object' ? undefined : zone.frozen_paths;
  if (frozen === null || typeof frozen !== 'object') return [];
  if (frozen.kind !== 'globs' || !Array.isArray(frozen.globs)) return [];
  return frozen.globs.filter((glob) => typeof glob === 'string' && glob !== '');
}

/**
 * THE DECISION — a refusal, or `null`. There is no third answer.
 *
 * ── WHAT IT RETURNS, AND WHY IT DOES NOT RETURN THE SENTENCE ──────────────────────────────────
 *
 * `{zone, glob, path}`. The caller composes the refusal, because the caller is the one file that
 * knows which tool is running and a `Bash` refusal carries one clause more than an `Edit` one. It
 * also means this function can be exercised on the FACT — *which zone, which glob, which path* —
 * without a test having to read prose to find out whether the freeze fired.
 *
 * ── AND `malformed` FREEZES NOTHING, WHICH IS THE INTERESTING CASE ───────────────────────────
 *
 * A packet storing something unreadable where its zone should be is a FAULT, and the session brief
 * says so in words. What it is not is a licence to freeze broadly: turning a typo into a wall is
 * exactly the hostage situation D103 exists to forbid, and this product cannot know what the builder
 * meant. `globsOf` answers an empty list and nothing matches it.
 *
 * ── THE FIRST MATCH WINS ───────────────────────────────────────────────────────────────────────
 *
 * One refusal names one reason. The zones arrive `seq`-ascending from the server, so *"the first"*
 * is *"the oldest unsealed decision that froze this path"* — deterministic, and the same answer on
 * every call rather than one that depends on which glob happened to be compared first.
 */
export function decideFreeze(event, zones) {
  const intent = writeIntent(event);
  if (intent === null) return null;
  const { tool: toolName, paths } = intent;

  for (const zone of Array.isArray(zones) ? zones : []) {
    for (const glob of globsOf(zone)) {
      for (const path of paths) {
        if (matchesGlob(glob, path)) return { zone, glob, path, tool: toolName };
      }
    }
  }
  return null;
}
