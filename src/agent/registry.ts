/**
 * Agent Registry for AgentFlow
 *
 * Default agents defined here; runtime registry is mutable in-memory.
 */

import type { AgentConfig } from '../types/index.js';

export const DEFAULT_AGENTS: AgentConfig[] = [
  {
    name: 'planner',
    description: 'Plans features and writes specs',
    prompt: 'You are a strategic planner. Your job is to break down complex features into clear, actionable specifications and implementation plans.',
    model: 'claude-opus-4-6',
    provider: 'anthropic',
    namespace: 'core',
  },
  {
    name: 'coder',
    description: 'Implements features',
    prompt: 'You are an expert software engineer. You implement features based on specifications, write clean code, and ensure tests pass.',
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    namespace: 'core',
  },
  {
    name: 'reviewer',
    description: 'Reviews code for quality',
    prompt: 'You are a senior code reviewer. You review pull requests for correctness, maintainability, performance, and adherence to best practices.',
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    namespace: 'review',
  },
  {
    name: 'security',
    description: 'Reviews code for security issues',
    prompt: 'You are a security expert. You audit code for vulnerabilities, insecure patterns, and compliance issues.',
    model: 'claude-opus-4-6',
    provider: 'anthropic',
    namespace: 'review',
  },
  {
    name: 'qa',
    description: 'Tests and verifies functionality',
    prompt: 'You are a QA engineer. You write tests, verify functionality, and ensure software behaves as expected.',
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    namespace: 'review',
  },
];

// Mutable runtime registry — initialized from defaults
const registry: Map<string, AgentConfig> = new Map(
  DEFAULT_AGENTS.map(agent => [agent.name, agent]),
);

/** Get an agent config by name. Returns null if not found. */
export function getAgent(name: string): AgentConfig | null {
  return registry.get(name) ?? null;
}

/** List all registered agents, optionally filtered by namespace. */
export function listAgents(namespace?: string): AgentConfig[] {
  const all = Array.from(registry.values());
  if (!namespace) return all;
  return all.filter(a => a.namespace === namespace);
}

/** Register a new agent or overwrite an existing one. */
export function registerAgent(config: AgentConfig): void {
  registry.set(config.name, config);
}
