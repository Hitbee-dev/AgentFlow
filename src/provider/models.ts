import type { ModelInfo } from './types.ts';
import { toProviderID, toModelID } from './types.ts';
import type { ModelID } from './types.ts';

export const MODEL_CATALOG: ModelInfo[] = [
  // Claude
  { id: toModelID('claude-haiku-4-5-20251001'), providerId: toProviderID('anthropic'), name: 'Claude Haiku 4.5', tier: 'fast', contextWindow: 200000, supportsTools: true, supportsStreaming: true },
  { id: toModelID('claude-sonnet-4-6'), providerId: toProviderID('anthropic'), name: 'Claude Sonnet 4.6', tier: 'standard', contextWindow: 200000, supportsTools: true, supportsStreaming: true },
  { id: toModelID('claude-opus-4-6'), providerId: toProviderID('anthropic'), name: 'Claude Opus 4.6', tier: 'deep', contextWindow: 200000, supportsTools: true, supportsStreaming: true },
  // Gemini
  { id: toModelID('gemini-2.0-flash'), providerId: toProviderID('google'), name: 'Gemini 2.0 Flash', tier: 'fast', contextWindow: 1000000, supportsTools: true, supportsStreaming: true },
  { id: toModelID('gemini-2.5-pro'), providerId: toProviderID('google'), name: 'Gemini 2.5 Pro', tier: 'deep', contextWindow: 1000000, supportsTools: true, supportsStreaming: true },
  // OpenAI
  { id: toModelID('gpt-4o-mini'), providerId: toProviderID('openai'), name: 'GPT-4o Mini', tier: 'fast', contextWindow: 128000, supportsTools: true, supportsStreaming: true },
  { id: toModelID('gpt-4o'), providerId: toProviderID('openai'), name: 'GPT-4o', tier: 'standard', contextWindow: 128000, supportsTools: true, supportsStreaming: true },
  { id: toModelID('o1'), providerId: toProviderID('openai'), name: 'OpenAI o1', tier: 'deep', contextWindow: 128000, supportsTools: false, supportsStreaming: false },
];

// Tier aliases per provider
export const TIER_ALIASES: Record<string, Record<string, ModelID>> = {
  anthropic: { fast: toModelID('claude-haiku-4-5-20251001'), standard: toModelID('claude-sonnet-4-6'), deep: toModelID('claude-opus-4-6') },
  google: { fast: toModelID('gemini-2.0-flash'), standard: toModelID('gemini-2.5-pro'), deep: toModelID('gemini-2.5-pro') },
  openai: { fast: toModelID('gpt-4o-mini'), standard: toModelID('gpt-4o'), deep: toModelID('o1') },
};
