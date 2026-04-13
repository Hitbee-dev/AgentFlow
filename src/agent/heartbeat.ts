/**
 * Agent Liveness Heartbeat for AgentFlow
 *
 * Each agent writes a heartbeat file to .agent-cli/state/<agentName>/heartbeat.json
 * Dead agent = heartbeat not updated in 30 seconds (default).
 */

import fs from 'fs';
import path from 'path';
import type { HeartbeatPayload, AgentStatus } from '../types/index.js';

const DEFAULT_MAX_AGE_MS = 30_000;

function heartbeatDir(agentName: string): string {
  return path.join('.agent-cli', 'state', agentName);
}

function heartbeatPath(agentName: string): string {
  return path.join(heartbeatDir(agentName), 'heartbeat.json');
}

/** Write or update a heartbeat file for an agent. */
export function writeHeartbeat(payload: HeartbeatPayload): void {
  const dir = heartbeatDir(payload.agentName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(heartbeatPath(payload.agentName), JSON.stringify(payload, null, 2), 'utf-8');
}

/** Read the heartbeat file for an agent. Returns null if not found or malformed. */
export function readHeartbeat(agentName: string): HeartbeatPayload | null {
  const filePath = heartbeatPath(agentName);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as HeartbeatPayload;
  } catch {
    return null;
  }
}

/** Returns true if the agent's heartbeat was updated within maxAgeMs. */
export function isAlive(agentName: string, maxAgeMs: number = DEFAULT_MAX_AGE_MS): boolean {
  const heartbeat = readHeartbeat(agentName);
  if (!heartbeat) return false;
  try {
    const ts = new Date(heartbeat.timestamp).getTime();
    if (isNaN(ts)) return false;
    return Date.now() - ts < maxAgeMs;
  } catch {
    return false;
  }
}

/** Start a recurring heartbeat timer for an agent. Returns the timer handle. */
export function startHeartbeat(
  agentName: string,
  status: AgentStatus,
  taskId?: string,
): ReturnType<typeof setInterval> {
  const write = () => {
    writeHeartbeat({
      agentName,
      status,
      timestamp: new Date().toISOString(),
      ...(taskId ? { taskId } : {}),
    });
  };
  write(); // write immediately
  return setInterval(write, 10_000);
}

/** Stop a heartbeat timer. */
export function stopHeartbeat(timer: ReturnType<typeof setInterval>): void {
  clearInterval(timer);
}
