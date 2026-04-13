/**
 * Inter-Agent Inbox/Outbox Messaging for AgentFlow
 *
 * Each agent has an inbox: .agent-cli/messages/<agentName>/inbox.jsonl
 * Messages are appended (JSONL) and read back as an array.
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export type MessageType = 'task' | 'result' | 'info';

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: MessageType;
  content: string;
  timestamp: string;
}

function inboxDir(agentName: string): string {
  return path.join('.agent-cli', 'messages', agentName);
}

function inboxPath(agentName: string): string {
  return path.join(inboxDir(agentName), 'inbox.jsonl');
}

/** Send a message to an agent's inbox. Appends a JSONL line. */
export function sendMessage(
  to: string,
  from: string,
  type: MessageType,
  content: string,
): void {
  const dir = inboxDir(to);
  fs.mkdirSync(dir, { recursive: true });
  const msg: AgentMessage = {
    id: randomUUID(),
    from,
    to,
    type,
    content,
    timestamp: new Date().toISOString(),
  };
  fs.appendFileSync(inboxPath(to), JSON.stringify(msg) + '\n', 'utf-8');
}

/** Read all messages from an agent's inbox. Returns parsed messages, skipping malformed lines. */
export function readMessages(agentName: string): AgentMessage[] {
  const filePath = inboxPath(agentName);
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const messages: AgentMessage[] = [];
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        messages.push(JSON.parse(trimmed) as AgentMessage);
      } catch {
        // skip malformed lines
      }
    }
    return messages;
  } catch {
    return [];
  }
}

/** Clear all messages in an agent's inbox. */
export function clearMessages(agentName: string): void {
  const filePath = inboxPath(agentName);
  if (fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '', 'utf-8');
  }
}
