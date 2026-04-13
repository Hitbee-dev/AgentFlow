import { listAgents } from '../agent/registry.ts';
import type { AgentConfig } from '../types/index.ts';

export interface ParsedCommand {
  type: 'manual' | 'auto' | 'system';
  agentName?: string;     // for type='manual'
  task?: string;          // for type='manual' | 'auto'
  command?: string;       // for type='system' (e.g., ':ns core')
}

// Parse command bar input
export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();

  // System commands: :quit, :ns <name>, :help
  if (trimmed.startsWith(':')) {
    return { type: 'system', command: trimmed.slice(1).trim() };
  }

  // Manual routing: @agent-name task description
  if (trimmed.startsWith('@')) {
    const spaceIdx = trimmed.indexOf(' ');
    if (spaceIdx === -1) {
      return { type: 'manual', agentName: trimmed.slice(1) };
    }
    return {
      type: 'manual',
      agentName: trimmed.slice(1, spaceIdx),
      task: trimmed.slice(spaceIdx + 1).trim(),
    };
  }

  // Broadcast: 공지! or /broadcast
  if (trimmed.startsWith('공지!') || trimmed.startsWith('/broadcast ')) {
    const message = trimmed.startsWith('공지!') ? trimmed.slice(3).trim() : trimmed.slice(11).trim();
    return { type: 'system', command: `broadcast ${message}` };
  }

  // Auto distribution
  return { type: 'auto', task: trimmed };
}

// Validate manual agent target
export function resolveManualAgent(agentName: string): AgentConfig | null {
  return listAgents().find(a => a.name === agentName) ?? null;
}
