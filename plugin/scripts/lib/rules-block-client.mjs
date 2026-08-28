/**
 * THE CLIENT HALF OF THE MANAGED BLOCK — PURE, and pure so that it can be MEASURED (Story 8.5).
 *
 * ── WHY THERE IS A CLIENT HALF AT ALL ──────────────────────────────────────────────────────────
 *
 * The plugin ships as bare files on a builder's disk with NO `node_modules`, so it cannot import
 * `@goriki/core` — which is why the block is RENDERED on the server and only WRITTEN here
 * ([PROP-85-4]). But finding the fence that is already in a file, and hashing what is between its
 * markers, has to happen where the file is. So this module mirrors two things and nothing else:
 * locating the fence, and taking its hash.
 *
 * **It re-spells no literal.** Every marker, the closing line's two halves and the hash length
 * arrive in the SERVER's answer (`fence` in `agentRulesBlockSchema`), so the day one of them
 * changes there is one place it changes. A marker typed twice is two markers.
 *
 * **And the mirror is pinned by a test rather than by discipline**:
 * `packages/core/src/context/rules-block-client.test.ts` imports this file and `@goriki/core` and
 * requires them to answer the same thing on the same corpus — the same hash, the same offsets, the
 * same decision. The pattern is 83-8's (*"logique pure dans une lib, importée par des tests
 * Vitest"*), and it is the only shape in which two implementations of one identity stay one.
 *
 * ── THE HASH USES `node:crypto`, AND THAT IS NOT A SECOND IMPLEMENTATION ───────────────────────
 *
 * `packages/shared` computes SHA-256 in pure TypeScript because it has to run in a BROWSER, where
 * `node:crypto` does not exist and `crypto.subtle` is async. Neither constraint applies here: this
 * file only ever runs under Node. Writing FIPS 180-4 out a second time to avoid one import would be
 * the duplication the brief forbids, arrived at backwards. The cross-check test is what makes the
 * claim *"the same 12 hex"* a measurement instead of an assumption.
 *
 * Nothing in this file touches a filesystem, a network or a clock. Its entry point does.
 */
import { createHash } from 'node:crypto';

/**
 * The hash of a body, truncated to the length the server declares. Hex, lower case.
 *
 * ── CORRECTED, BLOCKER B-4 (corr. wave 11, manche 1) — CRLF NORMALIZED BEFORE HASHING ────────────
 *
 * `@goriki/core`'s `rulesBlockSha` carries the identical fold, for the identical reason: the server
 * always composes a body with `\n`, but `CLAUDE.md` is a COMMITTED file and Git for Windows's default
 * `core.autocrlf=true` renders any checkout in `\r\n` — fence included. Hashing the raw bytes made an
 * untouched, just-checked-out block look diverged FOREVER, and `--restore` would have rewritten a
 * block nobody had actually edited. `\r\n` is folded to `\n` before the hash is taken — a no-op on a
 * body this script itself just wrote, and only ever a difference for one it did not.
 */
/** `\r\n` → `\n`, and nothing else — mirrors `normalizeBodyLineEndings` in `@goriki/core`. */
export function normalizeBodyLineEndings(body) {
  return body.replace(/\r\n/g, '\n');
}

export function bodyHash(body, length) {
  const normalized = normalizeBodyLineEndings(body);
  return createHash('sha256').update(normalized, 'utf8').digest('hex').slice(0, length);
}

/**
 * Every index at which a marker BEGINS A LINE and is followed by a separator.
 *
 * ── GUARDED, BLOCKER B-1 (corr. wave 11, manche 1) — AN EMPTY MARKER CANNOT HANG THIS ────────────
 *
 * `fence.start_marker` / `fence.end_marker` arrive over the wire, in a 200 response this script does
 * not control. An empty string makes `text.indexOf('', from)` answer `from` forever, so `from =
 * index + marker.length` never advances and this loop never returns — measured (annexe § A1): a
 * `fence.start_marker` of `''` hung the process for the full smoke timeout. `write-rules-block.mjs`
 * now refuses a payload whose fence carries an empty marker before this function ever sees one; the
 * guard stays here too, because a primitive that hangs on the one input its own caller forbids is
 * not a primitive this repository trusts twice — `@goriki/core`'s mirror carries the same guard.
 */
function markerStarts(text, marker) {
  if (marker.length === 0) return [];
  const found = [];
  let from = 0;
  for (;;) {
    const index = text.indexOf(marker, from);
    if (index === -1) return found;
    const atLineStart = index === 0 || text[index - 1] === '\n';
    // `\r` is a valid separator too (blocker B-4): on a CRLF checkout the CLOSE marker's own `-->`
    // ends its line in `\r\n`, not `\n` alone, and rejecting `\r` made that line invisible to this
    // reader — no end marker found, a fence nobody had touched read as malformed.
    const next = text[index + marker.length];
    if (
      atLineStart &&
      (next === undefined || next === ' ' || next === '\n' || next === '\t' || next === '\r')
    ) {
      found.push(index);
    }
    from = index + marker.length;
  }
}

function headerValue(header, key) {
  const match = new RegExp(`(?:^|\\s)${key}=([^\\s]+)`).exec(header);
  return match === null ? null : (match[1] ?? null);
}

/**
 * READ A FILE FOR ITS FENCE. Every answer is NAMED; none is a guess.
 *
 * Two fences are REFUSED rather than resolved. A script that picks one of two blocks is a script
 * that silently deletes the other, and *"Goriki never deletes their text"* has no small print.
 */
export function findFence(text, fence) {
  const starts = markerStarts(text, fence.start_marker);
  const ends = markerStarts(text, fence.end_marker);
  if (starts.length === 0 && ends.length === 0) return { state: 'absent' };
  if (starts.length > 1 || ends.length > 1) return { state: 'duplicate' };
  const start = starts[0];
  const endMarker = ends[0];
  if (start === undefined || endMarker === undefined || endMarker < start) {
    return { state: 'malformed' };
  }
  const headerClose = text.indexOf(fence.comment_close, start);
  if (headerClose === -1 || headerClose > endMarker) return { state: 'malformed' };
  const headerEndOfLine = text.indexOf('\n', headerClose);
  if (headerEndOfLine === -1 || headerEndOfLine > endMarker) return { state: 'malformed' };

  const header = text.slice(start, headerClose);
  const body = text.slice(headerEndOfLine + 1, endMarker);
  const endOfEndLine = text.indexOf('\n', endMarker);
  const declaredSha = headerValue(header, 'sha');
  const computedSha = bodyHash(body, fence.sha_length);
  return {
    state: 'found',
    start,
    end: endOfEndLine === -1 ? text.length : endOfEndLine,
    body,
    declaredSha,
    computedSha,
    diverged: declaredSha !== computedSha,
    closed: isClosedBody(body, fence),
    rev: headerValue(header, 'rev'),
  };
}

/**
 * Does this body carry the dated closing line? The state lives in the file ([PROP-85-6]).
 *
 * ── CORRECTED, BLOCKER B-4 (corr. wave 11, manche 1) — CRLF-INSENSITIVE ─────────────────────────
 *
 * On a CRLF checkout every line here carries a trailing `\r`, and `line.endsWith(fence.closed_suffix)`
 * failed on a line that actually ended `…_\r` — a closed block read as NOT closed, so `--restore`
 * would have reopened it and dropped the dated line it was checking for. Stripped before the test;
 * nothing else about the line moves. Mirrors `isRulesBlockClosedText` in `@goriki/core`.
 */
export function isClosedBody(body, fence) {
  return body.split('\n').some((rawLine) => {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    return line.startsWith(fence.closed_prefix) && line.endsWith(fence.closed_suffix);
  });
}

/**
 * PUT THE BLOCK IN THE FILE — in place if a fence is there, at the end if it is not.
 *
 * Offsets rather than lines, so that a CRLF file stays CRLF, a BOM stays a BOM and a file with no
 * final newline keeps having none. Outside the fence, nothing moves.
 */
export function spliceFence(text, blockText, found) {
  if (found.state === 'found') {
    return text.slice(0, found.start) + blockText + text.slice(found.end);
  }
  if (text.length === 0) return `${blockText}\n`;
  return `${text}${text.endsWith('\n') ? '\n' : '\n\n'}${blockText}\n`;
}

/**
 * WHO EDITED INSIDE THE FENCE — D130, and the only proof a filesystem can carry.
 *
 * If THIS execution wrote a block whose body hashed to X and the body on disk now hashes to
 * something else, the change happened inside this agent turn: provenance PROVEN, CRITICAL path.
 * Anything else is UNKNOWN, and unknown is CALM — a calm question asked wrongly costs a question,
 * a CRITICAL raised wrongly costs an interruption, a packet and a register entry.
 */
export function provenanceOf(shaWrittenThisExecution, shaOnDisk) {
  if (shaWrittenThisExecution === null || shaWrittenThisExecution === undefined) return 'unknown';
  return shaWrittenThisExecution === shaOnDisk ? 'unknown' : 'agent-proven';
}

/** WRITE / REFUSE / DO NOTHING — the same order of questions the server-side decision asks. */
export function decideWrite({ fileText, payload, shaWrittenThisExecution = null, restore = false }) {
  const fence = payload.fence;
  const found = fileText === null ? { state: 'absent' } : findFence(fileText, fence);

  if (found.state === 'duplicate') return { kind: 'refuse', reason: 'two-fences' };
  if (found.state === 'malformed') return { kind: 'refuse', reason: 'malformed' };

  if (found.state === 'absent') {
    if (payload.rev === null) return { kind: 'skip', reason: 'nothing-sealed' };
    return {
      kind: 'write',
      reason: 'created',
      fileText: spliceFence(fileText ?? '', payload.block, found),
    };
  }

  if (found.closed) return { kind: 'refuse', reason: 'closed' };

  if (found.diverged) {
    if (!restore) {
      return {
        kind: 'refuse',
        reason: 'diverged',
        provenance: provenanceOf(shaWrittenThisExecution, found.computedSha),
      };
    }
    return {
      kind: 'write',
      reason: 'restored',
      fileText: spliceFence(fileText, payload.block, found),
    };
  }

  // `generated` is deliberately not part of this comparison: it moves on every call, and a fence
  // that rewrote itself because a second had passed would be noisy rather than idempotent. `rev` IS
  // part of it, because Story 8.2 quotes it and a stale one there is a wrong statement to a builder.
  //
  // ── CORRECTED, BLOCKER B-5 (corr. wave 11, manche 2) — CRLF NORMALIZED HERE TOO ─────────────────
  // `bodyHash` (blocker B-4) folds `\r\n` to `\n` before hashing, which is why a CRLF checkout is
  // never `diverged`. This identity check compared the raw bodies instead, with no fold — a body
  // that reached here CRLF for the same reason B-4 names (`core.autocrlf` on Windows) never equaled
  // `rendered.body` (always `\n`), so it fell through to `write`/`updated`: a silent CRLF→LF rewrite
  // of a block nothing new was sealed for, on a script whose own header promises "in every case" it
  // writes only what changed. Same fold, same side of the question, both bodies.
  const rendered = findFence(payload.block, fence);
  if (
    rendered.state === 'found' &&
    normalizeBodyLineEndings(rendered.body) === normalizeBodyLineEndings(found.body) &&
    found.rev === payload.rev
  ) {
    return { kind: 'no-write', reason: 'identical' };
  }
  return {
    kind: 'write',
    reason: 'updated',
    fileText: spliceFence(fileText, payload.block, found),
  };
}

/**
 * STOP MANAGING — the dated line is appended, the content stays, the hash is re-taken.
 *
 * ── CORRECTED, BLOCKER B-3 (corr. wave 11, manche 1) ────────────────────────────────────────────
 *
 * The server's `fence.end_marker` is now Story 8.2's `MANAGED_BLOCK_CLOSE_MARKER` — whole and exact,
 * nothing follows it on its line — so the footer is that literal alone, never `${end_marker} sha=…`.
 * The header keeps `project` and `generated` and takes the new `sha`, and — B-3, item 4 — DROPS its
 * `rev`: 8.2's `SessionStart` hook has no notion of "closed" and would otherwise keep stating "the
 * block last written to CLAUDE.md still applies (rev N)" about a block that stopped being managed.
 * Dropping the token makes that reader's own already-correct `null` case fire; no file this story
 * does not own is touched. Mirrors `decideRulesBlockClose` in `@goriki/core`.
 */
export function decideClose({ fileText, payload, date }) {
  const fence = payload.fence;
  if (fileText === null) return { kind: 'refuse', reason: 'absent' };
  const found = findFence(fileText, fence);
  if (found.state === 'absent') return { kind: 'refuse', reason: 'absent' };
  if (found.state === 'duplicate') return { kind: 'refuse', reason: 'two-fences' };
  if (found.state === 'malformed') return { kind: 'refuse', reason: 'malformed' };
  if (found.closed) return { kind: 'no-write', reason: 'already-closed' };

  const body = `${found.body}${fence.closed_prefix}${date}${fence.closed_suffix}\n`;
  const sha = bodyHash(body, fence.sha_length);
  const headerClose = fileText.indexOf(fence.comment_close, found.start);
  const header = fileText.slice(found.start, fileText.indexOf('\n', headerClose) + 1);
  const rewritten = header
    .replace(/sha=[0-9a-f]+/, `sha=${sha}`)
    .replace(/\srev=[^\s>]+/, '');
  const footer = fence.end_marker;
  return {
    kind: 'write',
    fileText: fileText.slice(0, found.start) + rewritten + body + footer + fileText.slice(found.end),
  };
}

/**
 * THE AGENT PLANE'S ADDRESS, FROM THE BRIDGE'S — and it REFUSES an unexpected shape by name.
 *
 * `goriki_url` is the MCP endpoint the install carries. The agent plane lives beside it, and the
 * derivation is one suffix. It is done here, defensively, because Story 8.2 owns the shared
 * `agentPlaneUrl` helper (memo 82-3) and had not merged when this was written: at the rebase this
 * function's rule and 8.2's become one, and the debt is named in the implementation report.
 *
 * `null` — never a guessed address — when the value does not end in the bridge's own path. A script
 * that invented a host would be a script that sent a project token somewhere nobody chose.
 */
export function agentPlaneBase(bridgeUrl) {
  let parsed;
  try {
    parsed = new URL(bridgeUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  const path = parsed.pathname.replace(/\/+$/, '');
  if (path !== '/mcp' && path !== '/api/mcp') return null;
  return parsed.origin;
}

/**
 * A required, non-empty string field of an object under scrutiny — `null` on anything else,
 * including a value that only LOOKS like a string of length zero.
 */
function requiredString(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * DOES THIS 200 RESPONSE ANSWER THE SHAPE THIS SCRIPT IS ABOUT TO TRUST WITH A WRITE?
 *
 * ── ADDED, BLOCKER B-1 (corr. wave 11, manche 1) ────────────────────────────────────────────────
 *
 * Before this function existed, `write-rules-block.mjs` handed `response.json()` straight to
 * `decideWrite`/`findFence` with no contract of its own between the two. Measured (annexe § A1,
 * `85-rev1-forge.mjs`) against a bogus local bridge answering 200 with a chosen body: a payload
 * missing `fence`/`block` threw a `TypeError` reading `undefined.start_marker`, uncaught, past the
 * script's own `process.exit(0)` — the very guarantee its header promises "in every case"; a
 * well-formed fence with a missing `block` wrote the literal FOUR-CHARACTER STRING `"undefined"`
 * into the builder's `CLAUDE.md`, because `${payload.block}` stringifies `undefined` rather than
 * refusing it; an empty `fence.start_marker` hung the process (see `markerStarts`'s own guard); a
 * top-level array or `null` threw the same uncaught `TypeError` one property access later.
 *
 * The server's own contract is `agentRulesBlockSchema` (`z.strictObject`, every string field
 * `min(1)`) — this is that SAME shape, checked by hand because the plugin ships as bare files with
 * no `node_modules` and cannot import `zod`. It answers a NAMED reason rather than `true`/`false`,
 * so the caller can say what was wrong rather than just that something was — and it validates the
 * WHOLE shape before `main()`'s loop ever calls `decideWrite`/`decideClose`/`findFence` on it, so
 * none of those functions is ever handed a value they were not written to expect.
 */
export function validateAgentRulesBlockPayload(payload) {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { ok: false, reason: 'not an object' };
  }
  if (requiredString(payload.project) === null) return { ok: false, reason: 'missing project' };
  if (payload.rev !== null && requiredString(payload.rev) === null) {
    return { ok: false, reason: 'rev is neither a non-empty string nor null' };
  }
  if (requiredString(payload.generated) === null) return { ok: false, reason: 'missing generated' };
  if (requiredString(payload.sha) === null) return { ok: false, reason: 'missing sha' };
  if (requiredString(payload.block) === null) return { ok: false, reason: 'missing block' };

  const fence = payload.fence;
  if (typeof fence !== 'object' || fence === null || Array.isArray(fence)) {
    return { ok: false, reason: 'missing fence' };
  }
  for (const key of ['start_marker', 'end_marker', 'comment_close', 'closed_prefix', 'closed_suffix']) {
    if (requiredString(fence[key]) === null) return { ok: false, reason: `fence.${key} is missing` };
  }
  if (!Number.isInteger(fence.sha_length) || fence.sha_length <= 0) {
    return { ok: false, reason: 'fence.sha_length is not a positive integer' };
  }
  return { ok: true };
}

/**
 * THE REPOSITORY THIS SCRIPT SHOULD WRITE INTO, WHEN NOBODY SAID `--dir`.
 *
 * ── ADDED, BLOCKER B-2 (corr. wave 11, manche 1) ────────────────────────────────────────────────
 *
 * The default used to be `process.cwd()`, unconditionally — measured (annexe § A2, `85-rev1-cwd.mjs`)
 * to write a NEW `CLAUDE.md` inside `apps/web/` when the command (as SKILL.md and `commands/rules.md`
 * both actually instruct: no `--dir`) was run from a subdirectory of a repository whose root
 * `CLAUDE.md` is the one file every certified client actually reads. Since 8.2's merge, the client
 * exports `CLAUDE_PROJECT_DIR` to every hook and to this session's Bash tool alike, and it is the
 * value `session-start.mjs` already trusts for the identical question — so it is asked FIRST here
 * too. Failing that, the repository root is found by walking up for `.git` (a plain repo's directory
 * OR a worktree's file — `existsSync` answers either). Failing THAT, `process.cwd()` is still the
 * answer, but it is now a NAMED fallback rather than a silent default — the caller says so.
 *
 * @returns `{ dir, source }` — `source` is `'CLAUDE_PROJECT_DIR' | 'git-root' | 'cwd'`.
 */
export function resolveRepoDir({ cwd, env, existsSync, joinPath, dirname }) {
  const fromProjectDir = env.CLAUDE_PROJECT_DIR;
  if (typeof fromProjectDir === 'string' && fromProjectDir.trim() !== '') {
    return { dir: fromProjectDir, source: 'CLAUDE_PROJECT_DIR' };
  }
  let dir = cwd;
  for (;;) {
    if (existsSync(joinPath(dir, '.git'))) return { dir, source: 'git-root' };
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return { dir: cwd, source: 'cwd' };
}
