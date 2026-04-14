import { authRegistry } from '../auth/registry.ts';
import type { AgentConfig } from '../types/index.ts';

export interface PreflightResult {
  ok: boolean;
  error?: string;
  fallbackAgent?: string;
}

// Map AgentConfig.provider to the providerId used by authRegistry
function toProviderId(provider: string): string {
  switch (provider) {
    case 'anthropic': return 'claude';
    case 'google': return 'gemini';
    case 'openai': return 'openai';
    default: return provider;
  }
}

export async function preflightCheck(agent: AgentConfig, allAgents: AgentConfig[]): Promise<PreflightResult> {
  const providerId = toProviderId(agent.provider);

  // Initial validity check
  let valid = await authRegistry.isValid(providerId);

  // Attempt refresh if not valid
  if (!valid) {
    await authRegistry.refreshIfNeeded(providerId);
    valid = await authRegistry.isValid(providerId);
  }

  if (valid) {
    return { ok: true };
  }

  // Find fallback: an agent with a different provider that is valid
  for (const candidate of allAgents) {
    if (candidate.name === agent.name) continue;
    const candidateProviderId = toProviderId(candidate.provider);
    if (candidateProviderId === providerId) continue;
    const candidateValid = await authRegistry.isValid(candidateProviderId);
    if (candidateValid) {
      return { ok: false, error: `Provider '${providerId}' credentials invalid`, fallbackAgent: candidate.name };
    }
  }

  return { ok: false, error: `Provider '${providerId}' credentials invalid` };
}
