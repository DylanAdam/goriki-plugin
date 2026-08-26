/**
 * `SessionStart` — REGISTERED, SILENT, AND THAT IS THE WHOLE OF IT (Story 8.1 · D103).
 *
 * Story 8.1 is the CONTAINER. Acceptance criterion 1 asks that one install register "the MCP
 * server, the three hooks, the escalation skill, and the commands in one operation" — the
 * REGISTRATION is this story's; the BEHAVIOUR of this particular hook is Story 8.2's (the launch
 * context injection). So this file exists, `/hooks` lists it, and it does nothing at all.
 *
 * Nothing at all is a decision rather than an omission. D103 is fail-open: a guardrail that cannot
 * run must never be a guardrail that stops the work. A stub that wrote a file, cached a token,
 * printed a line into the transcript or reached the network would be a behaviour nobody has
 * decided yet, shipped under the word "stub" — and on this event it would be a behaviour that runs
 * before the builder has typed anything.
 *
 * It drains stdin instead of exiting on the spot: the CLI writes the event JSON there, and a
 * process that closes the pipe under the writer is a broken pipe on the other side. Draining costs
 * nothing and leaves the caller with a clean write.
 */
import process from 'node:process';

process.stdin.resume();
process.stdin.on('data', () => {});
process.stdin.on('end', () => process.exit(0));
process.stdin.on('error', () => process.exit(0));
