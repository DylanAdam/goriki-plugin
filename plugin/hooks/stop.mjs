/**
 * `Stop` — REGISTERED, SILENT, AND IT NEVER HOLDS THE AGENT (Story 8.1 · D103).
 *
 * This is the event the research measured as genuinely blocking on this platform — a `Stop` hook
 * CAN keep an agent from finishing. That is exactly why the stub is empty: the story that decides
 * when Goriki holds a session back, and how many times, is Story 8.4, and it carries its own
 * migration for the counter. A stub that retained anything would ship that decision early, without
 * the counter that bounds it.
 *
 * So it returns no decision, holds nothing, writes nothing, and the session ends the way it would
 * have ended with no plugin installed.
 */
import process from 'node:process';

process.stdin.resume();
process.stdin.on('data', () => {});
process.stdin.on('end', () => process.exit(0));
process.stdin.on('error', () => process.exit(0));
