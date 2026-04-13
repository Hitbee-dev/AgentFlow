import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { authRegistry } from '../auth/registry.ts';

// Provider instances — created lazily with credentials from keychain
export class ProviderRegistry {
  async getAnthropicProvider() {
    const token = await authRegistry.getAccessToken('anthropic');
    return createAnthropic({ apiKey: token ?? undefined });
  }

  async getGoogleProvider() {
    const token = await authRegistry.getAccessToken('google');
    return createGoogleGenerativeAI({ apiKey: token ?? undefined });
  }

  async getOpenAIProvider() {
    const key = await authRegistry.getAccessToken('openai');
    return createOpenAI({ apiKey: key ?? undefined });
  }
}

export const providerRegistry = new ProviderRegistry();
