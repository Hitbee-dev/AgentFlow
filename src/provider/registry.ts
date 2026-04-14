import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { authRegistry } from '../auth/registry.ts';

// Provider instances — created lazily with credentials from keychain
export class ProviderRegistry {
  async getAnthropicProvider() {
    // Prefer direct API key (unlocks Sonnet/Opus) over OAuth (Haiku only)
    const apiKey = await authRegistry.getAnthropicApiKey();
    if (apiKey) {
      return createAnthropic({ apiKey });
    }

    const token = await authRegistry.getAccessToken('anthropic');
    if (!token) return createAnthropic({ apiKey: undefined });

    // OAuth tokens use Authorization: Bearer, not x-api-key
    const oauthFetch = async (url: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
      const headers = new Headers(options?.headers);
      headers.delete('x-api-key');
      headers.set('Authorization', `Bearer ${token}`);
      // Clamp max_tokens — OAuth accounts have lower limits
      let body = options?.body;
      try {
        let bodyStr: string | null = null;
        if (typeof body === 'string') {
          bodyStr = body;
        } else if (body instanceof Uint8Array) {
          bodyStr = new TextDecoder().decode(body);
        } else if (body instanceof ArrayBuffer) {
          bodyStr = new TextDecoder().decode(new Uint8Array(body));
        }
        if (bodyStr) {
          const parsed = JSON.parse(bodyStr);
          if (typeof parsed.max_tokens === 'number' && parsed.max_tokens > 4096) {
            parsed.max_tokens = 4096;
            body = JSON.stringify(parsed);
          }
        }
      } catch { /* leave body unchanged if parse or decode fails */ }

      // Override anthropic-beta to only oauth — strip SDK-added beta flags
      headers.set('anthropic-beta', 'oauth-2025-04-20');

      return fetch(url, { ...options, headers, body });
    };
    return createAnthropic({
      apiKey: 'oauth',  // placeholder to pass SDK validation
      headers: { 'anthropic-beta': 'oauth-2025-04-20' },
      fetch: oauthFetch as typeof fetch,
    });
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
