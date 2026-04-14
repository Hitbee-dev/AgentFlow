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

/**
 * Remove and return the first task for this agent from the queue.
 * Only removes entries matching agentName (or unassigned if agentName omitted).
 * Entries for OTHER agents are left in place — critical for multi-agent correctness.
 */
export function dequeue(agentName?: string): DispatchEntry | null {
  const entries = readAllEntries();
  if (entries.length === 0) return null;

  const idx = entries.findIndex(e =>
    !agentName || !e.targetAgent || e.targetAgent === agentName,
  );
  if (idx === -1) return null;

  const entry = entries[idx]!;
  const remaining = [...entries.slice(0, idx), ...entries.slice(idx + 1)];
  ensureQueueDir();
  fs.writeFileSync(
    DISPATCH_FILE,
    remaining.map(e => JSON.stringify(e)).join('\n') + (remaining.length > 0 ? '\n' : ''),
    'utf-8',
  );
  return entry;
}

/** Return the current number of items in the dispatch queue. */
export function peekQueue(): number {
  return readAllEntries().length;
}
