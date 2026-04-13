import type { AgentConfig } from '../types/index.ts';
import { listAgents } from '../agent/registry.ts';
import { isAlive } from '../agent/heartbeat.ts';
import { preflightCheck } from './preflight.ts';

export type TaskCategory = 'code' | 'review' | 'plan' | 'test' | 'security' | 'general';

// Map task categories to preferred agent names
const CATEGORY_AGENTS: Record<TaskCategory, string[]> = {
  code: ['coder'],
  review: ['reviewer'],
  plan: ['planner'],
  test: ['qa'],
  security: ['security'],
  general: ['coder', 'planner'],
};

// Classify task by keywords
export function classifyTask(description: string): TaskCategory {
  const lower = description.toLowerCase();
  if (lower.includes('review') || lower.includes('check')) return 'review';
  if (lower.includes('test') || lower.includes('verify') || lower.includes('qa')) return 'test';
  if (lower.includes('security') || lower.includes('vulnerability') || lower.includes('audit')) return 'security';
  if (lower.includes('plan') || lower.includes('design') || lower.includes('spec')) return 'plan';
  if (lower.includes('implement') || lower.includes('build') || lower.includes('fix') || lower.includes('add')) return 'code';
  return 'general';
}

// Find best available agent for a task
export async function findBestAgent(description: string): Promise<AgentConfig | null> {
  const category = classifyTask(description);
  const preferred = CATEGORY_AGENTS[category];
  const allAgents = listAgents();

  // Try preferred agents first, then any available
  const candidates = [
    ...preferred.map(name => allAgents.find(a => a.name === name)).filter(Boolean),
    ...allAgents.filter(a => !preferred.includes(a.name)),
  ] as AgentConfig[];

  for (const agent of candidates) {
    // Check if agent has active tmux session (alive)
    const alive = isAlive(agent.name);
    if (!alive) continue;

    // Credential pre-flight
    const preflight = await preflightCheck(agent, allAgents);
    if (preflight.ok) return agent;
    if (preflight.fallbackAgent) {
      const fallback = allAgents.find(a => a.name === preflight.fallbackAgent);
      if (fallback) return fallback;
    }
  }

  // No alive agent — return first preferred agent (will be started)
  return candidates[0] ?? null;
}
