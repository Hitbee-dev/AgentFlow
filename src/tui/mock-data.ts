import type { AgentStatus } from '../types/index.ts';

export interface AgentRow {
  name: string;
  status: AgentStatus;
  task: string;
  provider: string;
  namespace: string;
}

export const MOCK_AGENTS: AgentRow[] = [
  { name: 'planner', status: 'idle', task: '—', provider: 'anthropic', namespace: 'core' },
  { name: 'coder', status: 'running', task: 'Implementing auth layer', provider: 'anthropic', namespace: 'core' },
  { name: 'reviewer', status: 'idle', task: '—', provider: 'anthropic', namespace: 'review' },
  { name: 'security', status: 'stopped', task: '—', provider: 'anthropic', namespace: 'review' },
  { name: 'qa', status: 'error', task: 'Test suite failed', provider: 'anthropic', namespace: 'review' },
];
