import type { ProviderConfig } from '../types/index.ts';
import { ClaudeOAuth } from './claude-oauth.ts';
import { AnthropicKeyAuth } from './anthropic-key.ts';
import { GeminiOAuth } from './gemini-oauth.ts';
import { OpenAIAuth } from './openai.ts';

export interface ProviderAuthStatus {
  provider: string;
  authMethod: 'oauth' | 'api-key';
  isValid: boolean;
  expiresAt?: string;
}

const claudeOAuth = new ClaudeOAuth();
const anthropicKeyAuth = new AnthropicKeyAuth();
const geminiOAuth = new GeminiOAuth();
const openAIAuth = new OpenAIAuth();

const PROVIDERS: ProviderConfig[] = [
  { providerId: 'claude', models: [], defaultModel: '', authMethod: 'oauth' },
  { providerId: 'gemini', models: [], defaultModel: '', authMethod: 'oauth' },
  { providerId: 'openai', models: [], defaultModel: '', authMethod: 'api-key' },
];

async function isProviderValid(providerId: string): Promise<boolean> {
  switch (providerId) {
    case 'claude':
      return claudeOAuth.isValid();
    case 'gemini':
      return geminiOAuth.isValid();
    case 'openai':
      return openAIAuth.isValid();
    default:
      return false;
  }
}

export class AuthRegistry {
  async isValid(providerId: string): Promise<boolean> {
    return isProviderValid(providerId);
  }

  async getStatus(): Promise<ProviderAuthStatus[]> {
    return Promise.all(
      PROVIDERS.map(async (p) => ({
        provider: p.providerId,
        authMethod: p.authMethod,
        isValid: await isProviderValid(p.providerId),
      })),
    );
  }

  async refreshIfNeeded(providerId: string): Promise<void> {
    if (providerId === 'claude') {
      const valid = await claudeOAuth.isValid();
      if (!valid) {
        await claudeOAuth.refresh();
      }
    }
    // Gemini and OpenAI do not have a refresh mechanism yet
  }

  /**
   * Returns the best available Anthropic API key:
   * 1. Direct API key (sk-ant-...) — set via `auth add --provider claude --key`
   * 2. OAuth session key — obtained via token exchange after login with org:create_api_key scope
   * Both unlock Sonnet/Opus. Returns null if only OAuth bearer is available.
   */
  async getAnthropicApiKey(): Promise<string | null> {
    if (await anthropicKeyAuth.isValid()) return anthropicKeyAuth.getKey();
    return claudeOAuth.getSessionKey();
  }

  async getAccessToken(providerId: string): Promise<string | null> {
    switch (providerId) {
      case 'anthropic':
        // Prefer direct API key (unlocks Sonnet/Opus) over OAuth (Haiku only)
        if (await anthropicKeyAuth.isValid()) return anthropicKeyAuth.getKey();
        return claudeOAuth.getAccessToken();
      case 'google':
        return geminiOAuth.getAccessToken();
      case 'openai':
        return openAIAuth.getKey();
      default:
        return null;
    }
  }
}

export const authRegistry = new AuthRegistry();
