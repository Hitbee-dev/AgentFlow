import type { AgentStatus } from '../types/index.ts';

export interface AgentRow {
  name: string;
  status: AgentStatus;
  task: string;
  provider: string;
  namespace: string;
  model: string;
}

export const MOCK_AGENTS: AgentRow[] = [
  { name: 'planner', status: 'idle', task: '—', provider: 'anthropic', namespace: 'core', model: 'claude-opus-4-6' },
  { name: 'coder', status: 'running', task: 'Implementing auth layer', provider: 'anthropic', namespace: 'core', model: 'claude-sonnet-4-6' },
  { name: 'reviewer', status: 'idle', task: '—', provider: 'anthropic', namespace: 'review', model: 'claude-sonnet-4-6' },
  { name: 'security', status: 'stopped', task: '—', provider: 'anthropic', namespace: 'review', model: 'claude-opus-4-6' },
  { name: 'qa', status: 'error', task: 'Test suite failed', provider: 'anthropic', namespace: 'review', model: 'claude-sonnet-4-6' },
];
