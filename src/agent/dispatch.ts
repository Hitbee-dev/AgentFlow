/**
 * Task Dispatch Queue for AgentFlow
 *
 * Simple JSONL append-only queue: .agent-cli/queue/dispatch.jsonl
 * Dequeue pops the first entry by rewriting the file.
 */

import fs from 'fs';
import path from 'path';

export interface DispatchEntry {
  taskId: string;
  targetAgent?: string;
}

const DISPATCH_FILE = path.join('.agent-cli', 'queue', 'dispatch.jsonl');

function ensureQueueDir(): void {
  fs.mkdirSync(path.dirname(DISPATCH_FILE), { recursive: true });
}

function readAllEntries(): DispatchEntry[] {
  if (!fs.existsSync(DISPATCH_FILE)) return [];
  try {
    const raw = fs.readFileSync(DISPATCH_FILE, 'utf-8');
    const entries: DispatchEntry[] = [];
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        entries.push(JSON.parse(trimmed) as DispatchEntry);
      } catch {
        // skip malformed
      }
    }
    return entries;
  } catch {
    return [];
  }
}

/** Add a task to the dispatch queue. */
export function enqueue(taskId: string, targetAgent?: string): void {
  ensureQueueDir();
  const entry: DispatchEntry = { taskId, ...(targetAgent ? { targetAgent } : {}) };
  fs.appendFileSync(DISPATCH_FILE, JSON.stringify(entry) + '\n', 'utf-8');
}

/** Remove and return the first task in the queue, or null if empty. */
export function dequeue(): DispatchEntry | null {
  const entries = readAllEntries();
  if (entries.length === 0) return null;
  const [first, ...rest] = entries;
  ensureQueueDir();
  fs.writeFileSync(DISPATCH_FILE, rest.map(e => JSON.stringify(e)).join('\n') + (rest.length > 0 ? '\n' : ''), 'utf-8');
  return first;
}

/** Return the current number of items in the dispatch queue. */
export function peekQueue(): number {
  return readAllEntries().length;
}
