import { describe, test, expect } from 'bun:test';
import { MODEL_CATALOG, TIER_ALIASES } from '../src/provider/models.ts';
import { resolveModel, getModelInfo } from '../src/provider/router.ts';
import { toModelID, toProviderID } from '../src/provider/types.ts';

describe('MODEL_CATALOG', () => {
  test('all models have required fields', () => {
    for (const model of MODEL_CATALOG) {
      expect(model.id).toBeTruthy();
      expect(model.providerId).toBeTruthy();
      expect(model.name).toBeTruthy();
      expect(typeof model.supportsStreaming).toBe('boolean');
      expect(typeof model.supportsTools).toBe('boolean');
    }
  });

  test('has at least one model per provider', () => {
    const providers = new Set(MODEL_CATALOG.map(m => String(m.providerId)));
    expect(providers.has('anthropic')).toBe(true);
    expect(providers.has('google')).toBe(true);
    expect(providers.has('openai')).toBe(true);
  });

  test('all models have positive context windows', () => {
    for (const model of MODEL_CATALOG) {
      expect(model.contextWindow).toBeGreaterThan(0);
    }
  });
});

describe('TIER_ALIASES', () => {
  test('anthropic has fast/standard/deep tiers', () => {
    expect(TIER_ALIASES['anthropic']?.['fast']).toBeTruthy();
    expect(TIER_ALIASES['anthropic']?.['standard']).toBeTruthy();
    expect(TIER_ALIASES['anthropic']?.['deep']).toBeTruthy();
  });

  test('google and openai tiers exist', () => {
    expect(TIER_ALIASES['google']?.['fast']).toBeTruthy();
    expect(TIER_ALIASES['openai']?.['standard']).toBeTruthy();
  });
});

describe('resolveModel', () => {
  test('resolves standard tier to anthropic claude-sonnet', () => {
    const id = resolveModel('standard');
    expect(String(id)).toBe('claude-sonnet-4-6');
  });

  test('resolves fast tier to haiku', () => {
    const id = resolveModel('fast');
    expect(String(id)).toBe('claude-haiku-4-5-20251001');
  });

  test('resolves deep tier to opus', () => {
    const id = resolveModel('deep');
    expect(String(id)).toBe('claude-opus-4-6');
  });

  test('passes through known model ID directly', () => {
    const id = resolveModel('gpt-4o');
    expect(String(id)).toBe('gpt-4o');
  });

  test('returns default for unknown ID', () => {
    const id = resolveModel('unknown-model-xyz');
    expect(String(id)).toBe('claude-sonnet-4-6');
  });
});

describe('getModelInfo', () => {
  test('returns model info for known model', () => {
    const info = getModelInfo(toModelID('claude-sonnet-4-6'));
    expect(info).not.toBeNull();
    expect(String(info!.id)).toBe('claude-sonnet-4-6');
    expect(String(info!.providerId)).toBe('anthropic');
  });

  test('returns null for unknown model', () => {
    const info = getModelInfo(toModelID('unknown-model'));
    expect(info).toBeNull();
  });
});
