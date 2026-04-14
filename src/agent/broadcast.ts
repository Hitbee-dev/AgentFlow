/**
 * Broadcast Queue for AgentFlow
 *
 * Append-only broadcast log: .agent-cli/queue/broadcast.jsonl
 * Per-agent pointer files: .agent-cli/queue/pointers/<agentName>.offset
 *
 * No read_by arrays — each agent tracks its own byte offset.
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface BroadcastMessage {
  id: string;
  from: string;
  message: string;
  timestamp: string;
}

const BROADCAST_FILE = path.join('.agent-cli', 'queue', 'broadcast.jsonl');
const POINTERS_DIR = path.join('.agent-cli', 'queue', 'pointers');

function pointerPath(agentName: string): string {
  return path.join(POINTERS_DIR, `${agentName}.offset`);
}

function readOffset(agentName: string): number {
  const p = pointerPath(agentName);
  if (!fs.existsSync(p)) return 0;
  try {
    const raw = fs.readFileSync(p, 'utf-8').trim();
    const n = parseInt(raw, 10);
    return isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
}

/** Append a broadcast message to the shared queue. */
export function broadcast(from: string, message: string): void {
  fs.mkdirSync(path.dirname(BROADCAST_FILE), { recursive: true });
  const msg: BroadcastMessage = {
    id: randomUUID(),
    from,
    message,
    timestamp: new Date().toISOString(),
  };
  fs.appendFileSync(BROADCAST_FILE, JSON.stringify(msg) + '\n', 'utf-8');
}

/** Read all broadcasts for an agent from its current offset forward. Updates the offset. */
export function readBroadcasts(agentName: string): BroadcastMessage[] {
  if (!fs.existsSync(BROADCAST_FILE)) return [];

  const offset = readOffset(agentName);
  const stat = fs.statSync(BROADCAST_FILE);
  if (stat.size <= offset) return [];

  const fd = fs.openSync(BROADCAST_FILE, 'r');
  try {
    const toRead = stat.size - offset;
    const buf = Buffer.alloc(toRead);
    fs.readSync(fd, buf, 0, toRead, offset);
    const raw = buf.toString('utf-8');

    const messages: BroadcastMessage[] = [];
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        messages.push(JSON.parse(trimmed) as BroadcastMessage);
      } catch {
        // skip malformed lines
      }
    }

    updateOffset(agentName, stat.size);
    return messages;
  } finally {
    fs.closeSync(fd);
  }
}

/** Update the byte offset pointer for an agent. */
export function updateOffset(agentName: string, newOffset: number): void {
  fs.mkdirSync(POINTERS_DIR, { recursive: true });
  fs.writeFileSync(pointerPath(agentName), String(newOffset), 'utf-8');
}
