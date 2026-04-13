import type { ModelID, ProviderID } from './types.ts';
import { MODEL_CATALOG, TIER_ALIASES } from './models.ts';
import { toModelID } from './types.ts';

export function resolveModel(
  modelIdOrTier: string,
  preferredProvider?: ProviderID,
): ModelID {
  // Check if it's a tier alias (fast/standard/deep)
  if (['fast', 'standard', 'deep'].includes(modelIdOrTier)) {
    const provider = preferredProvider ?? 'anthropic';
    return TIER_ALIASES[provider]?.[modelIdOrTier] ?? toModelID('claude-sonnet-4-6');
  }
  // Check if it's a known model ID
  const found = MODEL_CATALOG.find(m => m.id === modelIdOrTier);
  if (found) return found.id;
  // Default fallback
  return toModelID('claude-sonnet-4-6');
}

export function getModelInfo(modelId: ModelID) {
  return MODEL_CATALOG.find(m => m.id === modelId) ?? null;
}

export function getModelsForProvider(providerId: ProviderID) {
  return MODEL_CATALOG.filter(m => m.providerId === providerId);
}
